import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  ChatMessage,
  CommunityReport,
  EnvironmentalAlert,
  FamilyMember,
  IndoorRoom,
  SustainabilityEntry,
  UserAccountPublic,
  UserPreferences,
  UserRole,
} from '../src/types.ts';

export interface StoredUser extends UserAccountPublic {
  passwordHash: string;
  passwordSalt: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  detail: string;
}

interface PersistedDatabase {
  users: StoredUser[];
  adminClaimed: boolean;
  familyByUser: Record<string, FamilyMember[]>;
  roomsByUser: Record<string, IndoorRoom[]>;
  sustainabilityByUser: Record<string, SustainabilityEntry[]>;
  chatsByUser: Record<string, ChatMessage[]>;
  alertsByUser: Record<string, EnvironmentalAlert[]>;
  communityReports: CommunityReport[];
  auditLogs: AuditLogEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), '.airwise-data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

// Session signing key (env or ephemeral in-memory randomBytes, never written to disk)
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface SessionRecord {
  token: string;
  userId: string;
  role: UserRole;
  expiresAt: number;
}

const activeSessions = new Map<string, SessionRecord>();

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultCityId: 'new-delhi',
  language: 'en',
  aqiStandard: 'CPCB_NAQI',
  aqiAlertThreshold: 150,
  notifications: {
    aqiSpikes: true,
    dailyBriefing: true,
    familyAlerts: true,
    communityUpdates: true,
  },
  privacy: {
    storeChatHistory: true,
    approximateLocationOnly: true,
    shareAnonymousImpactStats: false,
  },
  theme: 'dark',
};

function createInitialSeedData(): PersistedDatabase {
  const now = Date.now();
  return {
    users: [],
    adminClaimed: false,
    familyByUser: {
      guest: [
        {
          id: 'fam-1',
          name: 'Aarav',
          ageGroup: 'child',
          activityProfile: 'active_outdoor',
          sensitivityNote: 'Morning school commute & outdoor football practice',
          preferredOutdoorWindow: '07:00 – 08:30',
          notificationsEnabled: true,
        },
        {
          id: 'fam-2',
          name: 'Meera',
          ageGroup: 'adult',
          activityProfile: 'moderate',
          sensitivityNote: 'Daily metro + 1.2 km walk to office',
          preferredOutdoorWindow: '06:30 – 07:30',
          notificationsEnabled: true,
        },
        {
          id: 'fam-3',
          name: 'Ramesh',
          ageGroup: 'elderly',
          activityProfile: 'low',
          sensitivityNote: 'Prefers calm shaded park walks during cleaner afternoon hours',
          preferredOutdoorWindow: '15:00 – 16:30',
          notificationsEnabled: true,
        },
      ],
    },
    roomsByUser: {
      guest: [
        {
          id: 'room-1',
          name: 'Primary Bedroom',
          roomType: 'bedroom',
          areaSqFt: 185,
          ceilingHeightFt: 9.5,
          ventilationType: 'ac_recirculate',
          sources: ['Outdoor infiltration near balcony door', 'Bedding dust'],
          hasPurifier: true,
          purifierCadrM3h: 310,
          checklistCompleted: ['wet_mop', 'window_seals'],
        },
        {
          id: 'room-2',
          name: 'Family Kitchen',
          roomType: 'kitchen',
          areaSqFt: 110,
          ceilingHeightFt: 9.5,
          ventilationType: 'exhaust_fan',
          sources: ['High-heat tadka/frying aerosols', 'LPG stove NO2'],
          hasPurifier: false,
          checklistCompleted: ['exhaust_before_cook'],
        },
        {
          id: 'room-3',
          name: 'Living & Study Area',
          roomType: 'living_room',
          areaSqFt: 290,
          ceilingHeightFt: 10,
          ventilationType: 'natural_windows',
          sources: ['Roadside fine dust', 'Footwear tracked particulates'],
          hasPurifier: false,
          checklistCompleted: ['shoe_free_entry'],
        },
      ],
    },
    sustainabilityByUser: {
      guest: [
        {
          id: 'sus-1',
          date: new Date(now - 86400000 * 4).toISOString().slice(0, 10),
          activityType: 'transit_commute',
          label: 'Metro commute instead of solo petrol car',
          distanceKm: 18,
          avoidedCo2Kg: 2.86,
          notes: 'Yellow Line corridor round trip',
        },
        {
          id: 'sus-2',
          date: new Date(now - 86400000 * 2).toISOString().slice(0, 10),
          activityType: 'cycling',
          label: 'Evening errand loop by bicycle',
          distanceKm: 6.5,
          avoidedCo2Kg: 1.25,
          notes: 'Used shaded greenway during low-AQI window',
        },
        {
          id: 'sus-3',
          date: new Date(now - 86400000).toISOString().slice(0, 10),
          activityType: 'carpool',
          label: '3-person office carpool',
          distanceKm: 22,
          avoidedCo2Kg: 2.81,
          notes: 'Shared route along Ring Road',
        },
      ],
    },
    chatsByUser: {},
    alertsByUser: {},
    communityReports: [
      {
        id: 'rep-seed-1',
        authorId: 'community-seed',
        authorName: 'Ananya S.',
        city: 'New Delhi',
        neighborhood: 'Okhla Phase II Corridor',
        lat: 28.5355,
        lng: 77.2732,
        category: 'construction_dust',
        severity: 'high',
        description:
          'Uncovered gravel trucks and dry road sweeping raising heavy coarse dust plumes along the arterial service lane.',
        status: 'verified',
        upvotes: 14,
        upvotedBy: [],
        approximateLocationOnly: true,
        createdAt: new Date(now - 3600000 * 5).toISOString(),
      },
      {
        id: 'rep-seed-2',
        authorId: 'community-seed',
        authorName: 'Subham P.',
        city: 'Bhubaneswar',
        neighborhood: 'Patia Tech Corridor',
        lat: 20.3533,
        lng: 85.8266,
        category: 'waste_burning',
        severity: 'medium',
        description:
          'Evening dry leaf and packaging waste burning reported near an open plot behind the transit stop; localized smoke odor.',
        status: 'verified',
        upvotes: 9,
        upvotedBy: [],
        approximateLocationOnly: true,
        createdAt: new Date(now - 3600000 * 9).toISOString(),
      },
      {
        id: 'rep-seed-3',
        authorId: 'community-seed',
        authorName: 'Rohan K.',
        city: 'Bengaluru',
        neighborhood: 'Cubbon Park Perimeter',
        lat: 12.9763,
        lng: 77.5929,
        category: 'clean_air_zone',
        severity: 'low',
        description:
          'Tree canopy corridor noticeably cooler and clearer than outer traffic junctions; good cycling visibility early morning.',
        status: 'verified',
        upvotes: 18,
        upvotedBy: [],
        approximateLocationOnly: true,
        createdAt: new Date(now - 3600000 * 14).toISOString(),
      },
    ],
    auditLogs: [],
  };
}

let dbCache: PersistedDatabase | null = null;

function ensureDb(): PersistedDatabase {
  if (dbCache) return dbCache;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      dbCache = JSON.parse(raw) as PersistedDatabase;
      return dbCache;
    }
  } catch {
    // Fall through to clean initialization if corrupted
  }
  dbCache = createInitialSeedData();
  saveDb();
  return dbCache;
}

export function saveDb(): void {
  if (!dbCache) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(dbCache, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('[AIRWISE Store] Persistence warning:', err);
  }
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function toPublicUser(user: StoredUser): UserAccountPublic {
  const { passwordHash: _ph, passwordSalt: _ps, ...pub } = user;
  return pub;
}

export function createSession(userId: string, role: UserRole): string {
  const nonce = crypto.randomBytes(24).toString('hex');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(`${userId}:${nonce}`).digest('hex');
  const token = `${nonce}.${sig}`;
  activeSessions.set(token, {
    token,
    userId,
    role,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
  });
  return token;
}

export function verifySessionToken(token: string | undefined): SessionRecord | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

export function revokeSession(token: string | undefined): void {
  if (token) activeSessions.delete(token);
}

export function getDb(): PersistedDatabase {
  return ensureDb();
}

export function appendAuditLog(userId: string, action: string, detail: string): void {
  const db = ensureDb();
  db.auditLogs.unshift({
    id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    userId,
    action,
    detail: detail.slice(0, 240),
  });
  if (db.auditLogs.length > 250) {
    db.auditLogs = db.auditLogs.slice(0, 250);
  }
  saveDb();
}

// Simple per-IP in-memory rate limiter for auth & AI endpoints
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxRequests) return false;
  bucket.count += 1;
  return true;
}
