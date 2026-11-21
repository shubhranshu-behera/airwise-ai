import crypto from 'crypto';
import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type {
  AqiStandard,
  CityLocation,
  CommunityReport,
  EnvironmentalAlert,
  FamilyMember,
  IndoorRoom,
  LanguageCode,
  SustainabilityEntry,
  UserPreferences,
  UserRole,
} from './src/types.ts';
import {
  generateGeminiQuickBrief,
  runDigitalTwinSimulation,
  runMultiAgentOrchestrator,
  tool_analyze_community_reports,
  tool_analyze_indoor_environment,
  tool_calculate_carbon_impact,
  tool_compare_routes,
  tool_generate_daily_plan,
  tool_generate_environmental_report,
  tool_recommend_air_purifier,
} from './server/agents.ts';
import { formatGeminiError, getGeminiClient } from './server/geminiClient.ts';
import {
  buildNeighborhoodStations,
  fetchLiveEnvironment,
  PRESET_CITIES,
  resolvePresetCity,
  searchLocations,
} from './server/envData.ts';
import { buildForecastAnalytics } from './server/mlForecast.ts';
import { listKnowledgeDocuments, retrieveEnvironmentalKnowledge } from './server/rag.ts';
import {
  appendAuditLog,
  checkRateLimit,
  createSession,
  DEFAULT_PREFERENCES,
  getDb,
  hashPassword,
  revokeSession,
  saveDb,
  toPublicUser,
  verifyPassword,
  verifySessionToken,
} from './server/store.ts';

interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
  authToken?: string;
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  const session = verifySessionToken(token);
  if (session) {
    req.userId = session.userId;
    req.userRole = session.role;
    req.authToken = token;
  } else {
    req.userId = 'guest';
    req.userRole = 'citizen';
  }
  next();
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Authentication required. Please sign in to perform this action.' });
  }
  req.userId = session.userId;
  req.userRole = session.role;
  req.authToken = token;
  next();
}

function resolveRequestLocation(query: Record<string, any>): CityLocation {
  if (query.lat && query.lng) {
    const lat = Number(query.lat);
    const lng = Number(query.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return {
        id: String(query.cityId || `custom-${lat.toFixed(2)}-${lng.toFixed(2)}`),
        name: String(query.name || 'Selected Location').slice(0, 60),
        region: String(query.region || '').slice(0, 60),
        country: String(query.country || '').slice(0, 60),
        lat,
        lng,
      };
    }
  }
  return resolvePresetCity(typeof query.city === 'string' ? query.city : undefined);
}

function parseStandard(val: unknown): AqiStandard {
  return val === 'US_AQI' ? 'US_AQI' : 'CPCB_NAQI';
}

function sanitizeImageDataUrl(input: unknown): string | undefined {
  if (typeof input !== 'string' || !input) return undefined;
  // Strictly allow base64 PNG/JPEG/WEBP images up to 1.5MB
  const validPrefix = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;
  if (!validPrefix.test(input) || input.length > 2_100_000) {
    return undefined;
  }
  return input;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2.5mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // ==========================================================================
  // AUTHENTICATION & ROLE-BASED ACCESS CONTROL
  // ==========================================================================
  app.get('/api/auth/admin-status', (_req, res) => {
    const db = getDb();
    const envPasscodeConfigured = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length >= 6);
    res.json({
      adminClaimed: db.adminClaimed,
      envPasscodeConfigured,
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(`auth:${ip}`, 25, 60_000)) {
      return res.status(429).json({ error: 'Too many authentication attempts. Please wait a minute.' });
    }
    const { email, password, name, role } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim().slice(0, 60);
    const cleanPass = String(password || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (cleanName.length < 2) {
      return res.status(400).json({ error: 'Please enter your name (at least 2 characters).' });
    }
    if (cleanPass.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const db = getDb();
    if (db.users.some((u) => u.email === cleanEmail)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Only allow citizen or community_lead on self-signup; admin requires claim/passcode
    const assignedRole: UserRole = role === 'community_lead' ? 'community_lead' : 'citizen';
    const { hash, salt } = hashPassword(cleanPass);
    const userId = `usr-${crypto.randomBytes(6).toString('hex')}`;

    const newUser = {
      id: userId,
      email: cleanEmail,
      name: cleanName,
      role: assignedRole,
      createdAt: new Date().toISOString(),
      preferences: { ...DEFAULT_PREFERENCES },
      passwordHash: hash,
      passwordSalt: salt,
    };

    db.users.push(newUser);
    // Initialize starter personal workspace cloned from clean templates
    db.familyByUser[userId] = JSON.parse(JSON.stringify(db.familyByUser.guest || []));
    db.roomsByUser[userId] = JSON.parse(JSON.stringify(db.roomsByUser.guest || []));
    db.sustainabilityByUser[userId] = [];
    saveDb();

    const token = createSession(userId, assignedRole);
    appendAuditLog(userId, 'auth_register', `Registered ${cleanEmail} as ${assignedRole}`);
    res.status(201).json({ token, user: toPublicUser(newUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(`auth:${ip}`, 25, 60_000)) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait a minute.' });
    }
    const { email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');
    const db = getDb();
    const user = db.users.find((u) => u.email === cleanEmail);
    if (!user || !verifyPassword(cleanPass, user.passwordHash, user.passwordSalt)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = createSession(user.id, user.role);
    appendAuditLog(user.id, 'auth_login', `Signed in ${cleanEmail}`);
    res.json({ token, user: toPublicUser(user) });
  });

  // First-run Admin Setup / Passcode Elevation (verified strictly server-side)
  app.post('/api/auth/claim-admin', requireAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.userId);
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const submittedPasscode = String(req.body?.passcode || '').trim();

    if (envPasscode.length >= 6) {
      const a = Buffer.from(submittedPasscode);
      const b = Buffer.from(envPasscode);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(403).json({ error: 'Invalid administrator passcode.' });
      }
      user.role = 'admin';
      db.adminClaimed = true;
      saveDb();
      const token = createSession(user.id, 'admin');
      appendAuditLog(user.id, 'admin_elevated', 'Elevated via server ADMIN_PASSCODE');
      return res.json({ token, user: toPublicUser(user) });
    }

    if (db.adminClaimed) {
      return res.status(403).json({
        error: 'Initial administrator role has already been claimed. Configure ADMIN_PASSCODE on the server to add additional admins.',
      });
    }

    if (submittedPasscode.length < 8) {
      return res.status(400).json({ error: 'Confirm your account password (min 8 chars) to claim initial admin role.' });
    }
    if (!verifyPassword(submittedPasscode, user.passwordHash, user.passwordSalt)) {
      return res.status(403).json({ error: 'Current account password verification failed.' });
    }

    user.role = 'admin';
    db.adminClaimed = true;
    saveDb();
    const token = createSession(user.id, 'admin');
    appendAuditLog(user.id, 'admin_claimed_first_run', `First-run admin claimed by ${user.email}`);
    res.json({ token, user: toPublicUser(user) });
  });

  app.post('/api/auth/logout', optionalAuth, (req: AuthRequest, res) => {
    revokeSession(req.authToken);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', optionalAuth, (req: AuthRequest, res) => {
    if (!req.userId || req.userId === 'guest') {
      return res.json({ authenticated: false, user: null });
    }
    const db = getDb();
    const user = db.users.find((u) => u.id === req.userId);
    if (!user) return res.json({ authenticated: false, user: null });
    res.json({ authenticated: true, user: toPublicUser(user) });
  });

  // ==========================================================================
  // REAL-TIME ENVIRONMENTAL DATA, FORECASTING, GEOSPATIAL & DIGITAL TWIN
  // ==========================================================================
  app.get('/api/env/cities', (_req, res) => {
    res.json({ cities: PRESET_CITIES });
  });

  app.get('/api/env/search', async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const results = await searchLocations(q);
    res.json({ results });
  });

  app.get('/api/env/current', async (req, res) => {
    try {
      const location = resolveRequestLocation(req.query);
      const standard = parseStandard(req.query.standard);
      const payload = await fetchLiveEnvironment(location, standard);
      res.json(payload.current);
    } catch (err) {
      console.error('[API /env/current] Error:', err);
      res.status(502).json({ error: 'Unable to retrieve live environmental measurements from upstream API. Please retry.' });
    }
  });

  app.get('/api/env/forecast', async (req, res) => {
    try {
      const location = resolveRequestLocation(req.query);
      const standard = parseStandard(req.query.standard);
      const payload = await fetchLiveEnvironment(location, standard);
      const forecast = buildForecastAnalytics(payload.current, payload.hourlySeries);
      res.json(forecast);
    } catch (err) {
      console.error('[API /env/forecast] Error:', err);
      res.status(502).json({ error: 'Unable to generate environmental forecast from upstream time-series API.' });
    }
  });

  app.get('/api/env/neighborhoods', async (req, res) => {
    try {
      const location = resolveRequestLocation(req.query);
      const standard = parseStandard(req.query.standard);
      const payload = await fetchLiveEnvironment(location, standard);
      const stations = buildNeighborhoodStations(payload.current);
      res.json({
        city: payload.current.location,
        observedAt: payload.current.observedAt,
        source: payload.current.source,
        stations,
      });
    } catch (err) {
      console.error('[API /env/neighborhoods] Error:', err);
      res.status(502).json({ error: 'Unable to load geospatial neighborhood monitoring layers.' });
    }
  });

  app.post('/api/env/digital-twin', async (req, res) => {
    try {
      const { city, lat, lng, name, standard, scenario } = req.body || {};
      const location = resolveRequestLocation({ city, lat, lng, name });
      const std = parseStandard(standard);
      const payload = await fetchLiveEnvironment(location, std);
      const sim = runDigitalTwinSimulation(payload.current, {
        trafficReductionPct: Number(scenario?.trafficReductionPct || 0),
        publicTransitShiftPct: Number(scenario?.publicTransitShiftPct || 0),
        greenCoverIncreasePct: Number(scenario?.greenCoverIncreasePct || 0),
        openBurningReductionPct: Number(scenario?.openBurningReductionPct || 0),
        windSpeedModifierPct: Number(scenario?.windSpeedModifierPct || 0),
      });
      res.json(sim);
    } catch (err) {
      console.error('[API /env/digital-twin] Error:', err);
      res.status(502).json({ error: 'Unable to run digital twin simulation.' });
    }
  });

  // ==========================================================================
  // MULTI-AGENT GEMINI AI ORCHESTRATOR & RAG
  // ==========================================================================
  app.get('/api/ai/status', (_req, res) => {
    const configured = Boolean(getGeminiClient());
    res.json({
      configured,
      reasoningModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      embeddingModel: 'gemini-embedding-2',
      agentCount: 8,
    });
  });

  app.post('/api/ai/quick-brief', optionalAuth, async (req: AuthRequest, res) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(`ai-brief:${ip}`, 20, 60_000)) {
      return res.status(429).json({ error: 'Rate limit reached. Please wait a moment before refreshing the Gemini brief.' });
    }
    try {
      const { city, lat, lng, name, standard, language } = req.body || {};
      const location = resolveRequestLocation({ city, lat, lng, name });
      const std = parseStandard(standard);
      const lang: LanguageCode = language === 'hi' || language === 'or' ? language : 'en';
      const brief = await generateGeminiQuickBrief({ location, standard: std, language: lang });
      res.json(brief);
    } catch (err: any) {
      console.error('[API /ai/quick-brief] Error:', err);
      const status = err?.status === 429 ? 429 : err?.status === 403 ? 403 : err?.status === 503 ? 503 : 500;
      res.status(status).json({
        error: formatGeminiError(err),
      });
    }
  });

  app.get('/api/ai/knowledge', (_req, res) => {
    res.json({ documents: listKnowledgeDocuments() });
  });

  app.post('/api/ai/rag/search', async (req, res) => {
    const query = String(req.body?.query || '').trim().slice(0, 300);
    if (!query) return res.status(400).json({ error: 'Query is required.' });
    const result = await retrieveEnvironmentalKnowledge(query, { topK: 4 });
    res.json(result);
  });

  app.get('/api/ai/history', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    res.json({ messages: db.chatsByUser[uid] || [] });
  });

  app.delete('/api/ai/history', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    db.chatsByUser[uid] = [];
    saveDb();
    res.json({ ok: true });
  });

  app.post('/api/ai/chat', optionalAuth, async (req: AuthRequest, res) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(`ai:${ip}`, 20, 60_000)) {
      return res.status(429).json({ error: 'AI request rate limit reached. Please pause briefly and try again.' });
    }

    const { prompt, city, lat, lng, name, standard, language } = req.body || {};
    const cleanPrompt = String(prompt || '').trim().slice(0, 1200);
    if (!cleanPrompt) {
      return res.status(400).json({ error: 'Please enter a question for the AIRWISE AI assistant.' });
    }

    const lang: LanguageCode = language === 'hi' || language === 'or' ? language : 'en';
    const location = resolveRequestLocation({ city, lat, lng, name });
    const std = parseStandard(standard);
    const uid = req.userId || 'guest';

    const db = getDb();
    const prevMessages = db.chatsByUser[uid] || [];

    try {
      const result = await runMultiAgentOrchestrator({
        userId: uid,
        prompt: cleanPrompt,
        location,
        standard: std,
        language: lang,
        history: prevMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      });

      const userRecord = db.users.find((u) => u.id === uid);
      const shouldStore = userRecord ? userRecord.preferences.privacy.storeChatHistory : true;

      if (shouldStore) {
        if (!db.chatsByUser[uid]) db.chatsByUser[uid] = [];
        db.chatsByUser[uid].push({
          id: `msg-${Date.now()}-u`,
          role: 'user',
          content: cleanPrompt,
          language: lang,
          createdAt: new Date().toISOString(),
        });
        db.chatsByUser[uid].push(result.message);
        if (db.chatsByUser[uid].length > 50) {
          db.chatsByUser[uid] = db.chatsByUser[uid].slice(-50);
        }
        saveDb();
      }

      res.json(result);
    } catch (err: any) {
      console.error('[API /ai/chat] Error:', err);
      const status = err?.status === 429 ? 429 : err?.status === 403 ? 403 : err?.status === 503 ? 503 : 500;
      res.status(status).json({
        error: formatGeminiError(err),
      });
    }
  });

  app.get('/api/ai/daily-plan', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const location = resolveRequestLocation(req.query);
      const standard = parseStandard(req.query.standard);
      const plan = await tool_generate_daily_plan({ userId: req.userId || 'guest', location, standard });
      res.json(plan);
    } catch {
      res.status(502).json({ error: 'Unable to compute pollution-aware daily plan.' });
    }
  });

  // ==========================================================================
  // FAMILY SAFETY MANAGER
  // ==========================================================================
  app.get('/api/family', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    res.json({ members: db.familyByUser[uid] || db.familyByUser.guest || [] });
  });

  app.post('/api/family', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    const { name, ageGroup, activityProfile, sensitivityNote, preferredOutdoorWindow, notificationsEnabled } =
      req.body || {};
    const cleanName = String(name || '').trim().slice(0, 50);
    if (cleanName.length < 1) return res.status(400).json({ error: 'Member name is required.' });

    const validAge: FamilyMember['ageGroup'] =
      ageGroup === 'child' || ageGroup === 'elderly' ? ageGroup : 'adult';
    const validAct: FamilyMember['activityProfile'] =
      activityProfile === 'low' || activityProfile === 'active_outdoor' ? activityProfile : 'moderate';

    const member: FamilyMember = {
      id: `fam-${crypto.randomBytes(4).toString('hex')}`,
      name: cleanName,
      ageGroup: validAge,
      activityProfile: validAct,
      sensitivityNote: String(sensitivityNote || '').trim().slice(0, 160),
      preferredOutdoorWindow: String(preferredOutdoorWindow || '07:00 – 08:30').trim().slice(0, 40),
      notificationsEnabled: notificationsEnabled !== false,
    };

    if (!db.familyByUser[uid]) db.familyByUser[uid] = [];
    db.familyByUser[uid].push(member);
    saveDb();
    res.status(201).json({ member });
  });

  app.delete('/api/family/:id', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    const list = db.familyByUser[uid] || [];
    db.familyByUser[uid] = list.filter((m) => m.id !== req.params.id);
    saveDb();
    res.json({ ok: true });
  });

  // ==========================================================================
  // INDOOR AIR QUALITY OPTIMIZER
  // ==========================================================================
  app.get('/api/indoor', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    const rooms = db.roomsByUser[uid] || db.roomsByUser.guest || [];
    const outdoorPm25 = Number(req.query.outdoorPm25 || 45);
    const enriched = rooms.map((room) => ({
      ...room,
      analysis: tool_analyze_indoor_environment(room, Number.isFinite(outdoorPm25) ? outdoorPm25 : 45),
      purifierGuide: tool_recommend_air_purifier(room.areaSqFt, room.ceilingHeightFt),
    }));
    res.json({ rooms: enriched });
  });

  app.post('/api/indoor', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 50);
    if (!name) return res.status(400).json({ error: 'Room name is required.' });

    const room: IndoorRoom = {
      id: `room-${crypto.randomBytes(4).toString('hex')}`,
      name,
      roomType: ['bedroom', 'living_room', 'kitchen', 'study', 'nursery'].includes(b.roomType)
        ? b.roomType
        : 'bedroom',
      areaSqFt: Math.max(40, Math.min(2000, Number(b.areaSqFt) || 160)),
      ceilingHeightFt: Math.max(7, Math.min(18, Number(b.ceilingHeightFt) || 9.5)),
      ventilationType: ['natural_windows', 'exhaust_fan', 'ac_recirculate', 'mechanical_filtered'].includes(
        b.ventilationType,
      )
        ? b.ventilationType
        : 'natural_windows',
      sources: Array.isArray(b.sources) ? b.sources.map((s: any) => String(s).slice(0, 80)).slice(0, 6) : [],
      hasPurifier: Boolean(b.hasPurifier),
      purifierCadrM3h: b.hasPurifier ? Math.max(50, Math.min(1500, Number(b.purifierCadrM3h) || 300)) : undefined,
      checklistCompleted: Array.isArray(b.checklistCompleted) ? b.checklistCompleted.map(String) : [],
    };

    if (!db.roomsByUser[uid]) db.roomsByUser[uid] = [];
    db.roomsByUser[uid].push(room);
    saveDb();
    res.status(201).json({ room });
  });

  app.patch('/api/indoor/:id/checklist', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    const rooms = db.roomsByUser[uid] || [];
    const target = rooms.find((r) => r.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'Room not found.' });
    if (Array.isArray(req.body?.checklistCompleted)) {
      target.checklistCompleted = req.body.checklistCompleted.map(String).slice(0, 20);
      saveDb();
    }
    res.json({ room: target });
  });

  app.delete('/api/indoor/:id', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    db.roomsByUser[uid] = (db.roomsByUser[uid] || []).filter((r) => r.id !== req.params.id);
    saveDb();
    res.json({ ok: true });
  });

  // ==========================================================================
  // SMART MOBILITY & SUSTAINABILITY
  // ==========================================================================
  app.post('/api/mobility/compare', (req, res) => {
    const distanceKm = Math.max(0.5, Math.min(200, Number(req.body?.distanceKm) || 10));
    const currentAqi = Math.max(5, Math.min(500, Number(req.body?.currentAqi) || 120));
    const currentPm25 = Math.max(2, Math.min(400, Number(req.body?.currentPm25) || 45));
    const options = tool_compare_routes({ distanceKm, currentAqi, currentPm25 });
    res.json({
      distanceKm,
      currentAqi,
      currentPm25,
      options,
      methodology:
        'CO₂ factors follow India GHG Program / IPCC averages (petrol car 192 g/km baseline). Exposure integrates live PM2.5, travel time, ventilation rate, and cabin filtration.',
    });
  });

  app.get('/api/sustainability', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    const entries = db.sustainabilityByUser[uid] || db.sustainabilityByUser.guest || [];
    const summary = tool_calculate_carbon_impact(uid);
    res.json({ entries, summary });
  });

  app.post('/api/sustainability', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    const b = req.body || {};
    const validTypes: SustainabilityEntry['activityType'][] = [
      'transit_commute',
      'cycling',
      'walking',
      'carpool',
      'ev_trip',
      'energy_saving',
      'tree_care',
    ];
    const activityType: SustainabilityEntry['activityType'] = validTypes.includes(b.activityType)
      ? b.activityType
      : 'transit_commute';
    const distanceKm = Number(b.distanceKm) > 0 ? Number(Number(b.distanceKm).toFixed(1)) : undefined;

    // Transparent avoided CO2 calculation vs solo petrol car (0.192 kg/km)
    const factorSavedPerKm: Record<string, number> = {
      transit_commute: 0.16,
      cycling: 0.192,
      walking: 0.192,
      carpool: 0.128,
      ev_trip: 0.124,
      energy_saving: 0,
      tree_care: 0,
    };

    const computedAvoided =
      distanceKm && factorSavedPerKm[activityType] > 0
        ? Number((distanceKm * factorSavedPerKm[activityType]).toFixed(2))
        : Math.max(0.2, Math.min(50, Number(b.avoidedCo2Kg) || 1.2));

    const entry: SustainabilityEntry = {
      id: `sus-${crypto.randomBytes(4).toString('hex')}`,
      date: new Date().toISOString().slice(0, 10),
      activityType,
      label: String(b.label || 'Low-emission activity').trim().slice(0, 100),
      distanceKm,
      avoidedCo2Kg: computedAvoided,
      notes: String(b.notes || '').trim().slice(0, 160),
    };

    if (!db.sustainabilityByUser[uid]) db.sustainabilityByUser[uid] = [];
    db.sustainabilityByUser[uid].unshift(entry);
    saveDb();
    res.status(201).json({ entry, summary: tool_calculate_carbon_impact(uid) });
  });

  // ==========================================================================
  // COMMUNITY INTELLIGENCE HUB (WITH DUPLICATE GUARD, SAFE UPLOADS & RBAC)
  // ==========================================================================
  app.get('/api/community/reports', (req, res) => {
    const db = getDb();
    const cityFilter = String(req.query.city || '').trim().toLowerCase();
    const categoryFilter = String(req.query.category || '').trim();
    let list = db.communityReports;
    if (cityFilter && cityFilter !== 'all') {
      list = list.filter((r) => r.city.toLowerCase().includes(cityFilter));
    }
    if (categoryFilter && categoryFilter !== 'all') {
      list = list.filter((r) => r.category === categoryFilter);
    }
    res.json({
      reports: list,
      analytics: tool_analyze_community_reports(cityFilter && cityFilter !== 'all' ? cityFilter : undefined),
    });
  });

  app.post('/api/community/reports', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const b = req.body || {};
    const city = String(b.city || 'New Delhi').trim().slice(0, 60);
    const neighborhood = String(b.neighborhood || '').trim().slice(0, 80);
    const description = String(b.description || '').trim().slice(0, 450);

    if (neighborhood.length < 2 || description.length < 10) {
      return res.status(400).json({ error: 'Please include a neighborhood name and a description (min 10 characters).' });
    }

    const validCategories: CommunityReport['category'][] = [
      'waste_burning',
      'construction_dust',
      'traffic_congestion',
      'industrial_smoke',
      'clean_air_zone',
    ];
    const category: CommunityReport['category'] = validCategories.includes(b.category)
      ? b.category
      : 'construction_dust';
    const severity: CommunityReport['severity'] =
      b.severity === 'high' || b.severity === 'low' ? b.severity : 'medium';

    // Duplicate prevention: reject identical city + neighborhood + category within last 30 minutes
    const cutoff = Date.now() - 30 * 60 * 1000;
    const isDuplicate = db.communityReports.some(
      (r) =>
        r.city.toLowerCase() === city.toLowerCase() &&
        r.neighborhood.toLowerCase() === neighborhood.toLowerCase() &&
        r.category === category &&
        new Date(r.createdAt).getTime() > cutoff,
    );
    if (isDuplicate) {
      return res.status(409).json({
        error: 'A similar report for this neighborhood and category was submitted recently. Please upvote the existing report instead.',
      });
    }

    // Privacy safeguard: snap coordinates to ~1km grid when approximateLocationOnly is true
    const rawLat = Number(b.lat) || 28.6139;
    const rawLng = Number(b.lng) || 77.209;
    const approx = b.approximateLocationOnly !== false;
    const lat = approx ? Number(rawLat.toFixed(2)) : Number(rawLat.toFixed(4));
    const lng = approx ? Number(rawLng.toFixed(2)) : Number(rawLng.toFixed(4));

    const user = db.users.find((u) => u.id === req.userId);
    const authorName = user ? user.name : String(b.authorName || 'Community Member').trim().slice(0, 40);
    const photoDataUrl = sanitizeImageDataUrl(b.photoDataUrl);

    const report: CommunityReport = {
      id: `rep-${crypto.randomBytes(4).toString('hex')}`,
      authorId: req.userId || 'guest',
      authorName,
      city,
      neighborhood,
      lat,
      lng,
      category,
      severity,
      description,
      photoDataUrl,
      status: req.userRole === 'admin' || req.userRole === 'community_lead' ? 'verified' : 'pending',
      upvotes: 1,
      upvotedBy: [req.userId || 'guest'],
      approximateLocationOnly: approx,
      createdAt: new Date().toISOString(),
    };

    db.communityReports.unshift(report);
    saveDb();
    appendAuditLog(req.userId || 'guest', 'community_report_created', `${city} / ${neighborhood} (${category})`);
    res.status(201).json({ report });
  });

  app.post('/api/community/reports/:id/upvote', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const report = db.communityReports.find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    const voter = req.userId && req.userId !== 'guest' ? req.userId : `ip:${req.ip || 'anon'}`;
    if (!report.upvotedBy.includes(voter)) {
      report.upvotedBy.push(voter);
      report.upvotes += 1;
      saveDb();
    }
    res.json({ report });
  });

  // RBAC-protected moderation endpoint
  app.patch('/api/community/reports/:id/moderate', requireAuth, (req: AuthRequest, res) => {
    if (req.userRole !== 'admin' && req.userRole !== 'community_lead') {
      return res.status(403).json({ error: 'Moderation requires Community Lead or Admin permissions.' });
    }
    const db = getDb();
    const report = db.communityReports.find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    const nextStatus = req.body?.status;
    if (nextStatus !== 'verified' && nextStatus !== 'flagged' && nextStatus !== 'pending') {
      return res.status(400).json({ error: 'Invalid moderation status.' });
    }
    report.status = nextStatus;
    saveDb();
    appendAuditLog(req.userId!, 'community_report_moderated', `${report.id} -> ${nextStatus}`);
    res.json({ report });
  });

  // ==========================================================================
  // ALERTS, REPORTS & SETTINGS
  // ==========================================================================
  app.get('/api/alerts', optionalAuth, async (req: AuthRequest, res) => {
    const db = getDb();
    const uid = req.userId || 'guest';
    const location = resolveRequestLocation(req.query);
    const standard = parseStandard(req.query.standard);
    const user = db.users.find((u) => u.id === uid);
    const threshold = user?.preferences.aqiAlertThreshold ?? 150;

    const liveAlerts: EnvironmentalAlert[] = [];
    try {
      const env = await fetchLiveEnvironment(location, standard);
      const forecast = buildForecastAnalytics(env.current, env.hourlySeries);
      if (env.current.aqi >= threshold) {
        liveAlerts.push({
          id: `live-thresh-${location.id}`,
          title: `${location.name} AQI above configured threshold (${threshold})`,
          message: `Current ${standard} AQI is ${env.current.aqi} (${env.current.category.label}), driven by ${env.current.dominantPollutant}. ${env.current.category.advisory}`,
          severity: env.current.aqi >= 300 ? 'critical' : 'warning',
          category: 'aqi_threshold',
          createdAt: env.current.observedAt,
          read: false,
        });
      }
      if (forecast.winterSmogRisk.level === 'high') {
        liveAlerts.push({
          id: `live-smog-${location.id}`,
          title: `Elevated smog & inversion buildup risk in ${location.name}`,
          message: forecast.winterSmogRisk.factors[0] || 'Low wind dispersion detected in forecast.',
          severity: 'warning',
          category: 'forecast',
          createdAt: forecast.generatedAt,
          read: false,
        });
      }
      if (forecast.anomalies.length > 0) {
        liveAlerts.push({
          id: `live-anom-${location.id}`,
          title: `PM2.5 statistical anomaly detected (+${forecast.anomalies[0].zScore}σ)`,
          message: forecast.anomalies[0].explanation,
          severity: forecast.anomalies[0].severity === 'spike' ? 'critical' : 'warning',
          category: 'pollution_spike',
          createdAt: forecast.anomalies[0].time,
          read: false,
        });
      }
    } catch {
      // Return stored alerts even if live check fails
    }

    const stored = db.alertsByUser[uid] || [];
    res.json({ alerts: [...liveAlerts, ...stored].slice(0, 15) });
  });

  app.get('/api/reports/summary', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const period = req.query.period === 'weekly' || req.query.period === 'monthly' ? req.query.period : 'daily';
      const location = resolveRequestLocation(req.query);
      const standard = parseStandard(req.query.standard);
      const summary = await tool_generate_environmental_report(
        { userId: req.userId || 'guest', location, standard },
        period,
      );
      res.json(summary);
    } catch {
      res.status(502).json({ error: 'Failed to compile environmental analytics report.' });
    }
  });

  app.get('/api/settings', optionalAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.userId);
    res.json({
      preferences: user ? user.preferences : DEFAULT_PREFERENCES,
      authenticated: Boolean(user),
    });
  });

  app.put('/api/settings', requireAuth, (req: AuthRequest, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.userId);
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    const p = req.body?.preferences as Partial<UserPreferences> | undefined;
    if (p) {
      user.preferences = {
        ...user.preferences,
        defaultCityId: typeof p.defaultCityId === 'string' ? p.defaultCityId.slice(0, 50) : user.preferences.defaultCityId,
        language: p.language === 'hi' || p.language === 'or' || p.language === 'en' ? p.language : user.preferences.language,
        aqiStandard: p.aqiStandard === 'US_AQI' || p.aqiStandard === 'CPCB_NAQI' ? p.aqiStandard : user.preferences.aqiStandard,
        aqiAlertThreshold:
          typeof p.aqiAlertThreshold === 'number'
            ? Math.max(50, Math.min(400, Math.round(p.aqiAlertThreshold)))
            : user.preferences.aqiAlertThreshold,
        theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : user.preferences.theme,
        notifications: {
          ...user.preferences.notifications,
          ...(p.notifications || {}),
        },
        privacy: {
          ...user.preferences.privacy,
          ...(p.privacy || {}),
        },
      };
      saveDb();
      appendAuditLog(user.id, 'settings_updated', `Updated preferences (${user.preferences.language}, ${user.preferences.aqiStandard})`);
    }

    res.json({ preferences: user.preferences, user: toPublicUser(user) });
  });

  // ==========================================================================
  // VITE DEV MIDDLEWARE / PRODUCTION STATIC SERVING
  // ==========================================================================
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist/index.html'));
  if (isProd) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AIRWISE AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
