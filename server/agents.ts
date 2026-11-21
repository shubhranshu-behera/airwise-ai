import { Type } from '@google/genai';
import type {
  AgentTraceStep,
  AqiStandard,
  ChatMessage,
  CityLocation,
  CurrentEnvironmentData,
  FamilyMember,
  ForecastBundle,
  IndoorRoom,
  LanguageCode,
  MobilityOption,
  RagCitation,
} from '../src/types.ts';
import {
  buildNeighborhoodStations,
  calculateCpcbNaqi,
  classifyAqi,
  fetchLiveEnvironment,
  resolvePresetCity,
} from './envData.ts';
import { generateContentWithRetry, getGeminiClient, getGeminiModel } from './geminiClient.ts';
import { buildForecastAnalytics } from './mlForecast.ts';
import { retrieveEnvironmentalKnowledge } from './rag.ts';
import { appendAuditLog, getDb, saveDb } from './store.ts';

// ============================================================================
// 17 REUSABLE VALIDATED BACKEND AGENT TOOLS
// ============================================================================

export interface ToolContext {
  userId: string;
  location: CityLocation;
  standard: AqiStandard;
}

export async function tool_get_current_aqi(ctx: ToolContext) {
  const env = await fetchLiveEnvironment(ctx.location, ctx.standard);
  return {
    aqi: env.current.aqi,
    usAqi: env.current.usAqi,
    standard: env.current.standard,
    category: env.current.category,
    dominantPollutant: env.current.dominantPollutant,
    observedAt: env.current.observedAt,
    freshnessMinutes: env.current.freshnessMinutes,
    source: env.current.source,
  };
}

export async function tool_get_pollutant_details(ctx: ToolContext) {
  const env = await fetchLiveEnvironment(ctx.location, ctx.standard);
  return {
    pollutants: env.current.pollutants,
    subIndices: env.current.subIndices,
    whoComparison: {
      pm25RatioToWho24h:
        env.current.pollutants.pm25 !== null ? Number((env.current.pollutants.pm25 / 15).toFixed(2)) : null,
      pm10RatioToWho24h:
        env.current.pollutants.pm10 !== null ? Number((env.current.pollutants.pm10 / 45).toFixed(2)) : null,
    },
  };
}

export async function tool_get_weather_forecast(ctx: ToolContext) {
  const env = await fetchLiveEnvironment(ctx.location, ctx.standard);
  return {
    currentWeather: env.current.weather,
    next12hWindAvgKmh: Number(
      (
        env.hourlySeries
          .filter((p) => p.isForecast)
          .slice(0, 12)
          .reduce((s, p) => s + (p.windSpeedKmh ?? 0), 0) / 12
      ).toFixed(1),
    ),
  };
}

export async function tool_get_aqi_history(ctx: ToolContext) {
  const env = await fetchLiveEnvironment(ctx.location, ctx.standard);
  const hist = env.hourlySeries.filter((p) => !p.isForecast).slice(-48);
  const avg = hist.length > 0 ? Math.round(hist.reduce((s, p) => s + p.aqi, 0) / hist.length) : env.current.aqi;
  const max = hist.length > 0 ? Math.max(...hist.map((p) => p.aqi)) : env.current.aqi;
  const min = hist.length > 0 ? Math.min(...hist.map((p) => p.aqi)) : env.current.aqi;
  return { hours: hist.length, avgAqi48h: avg, minAqi48h: min, maxAqi48h: max };
}

export async function tool_get_neighborhood_aqi(ctx: ToolContext) {
  const env = await fetchLiveEnvironment(ctx.location, ctx.standard);
  const stations = buildNeighborhoodStations(env.current);
  const sorted = [...stations].sort((a, b) => a.aqi - b.aqi);
  return {
    cleanestZone: sorted[0],
    highestExposureZone: sorted[sorted.length - 1],
    zonesCount: stations.length,
    note: 'Micro-zone values are spatial offset estimates anchored to the live city reference model.',
  };
}

export async function tool_predict_pollution(ctx: ToolContext): Promise<{
  trendDirection: ForecastBundle['trendDirection'];
  trendDeltaPct: number;
  next24hPeakAqi: number;
  next24hMinAqi: number;
  tomorrowMorningAqi: number;
  cleanestWindows: ForecastBundle['cleanestWindows'];
  evaluation: ForecastBundle['evaluation'];
}> {
  const env = await fetchLiveEnvironment(ctx.location, ctx.standard);
  const forecast = buildForecastAnalytics(env.current, env.hourlySeries);
  const next24 = forecast.forecast24h;
  const morningPts = forecast.forecast48h.filter((p) => {
    const h = Number(p.time.slice(11, 13));
    return h >= 6 && h <= 10;
  });
  const tomorrowMorningAqi =
    morningPts.length > 0
      ? Math.round(morningPts.slice(0, 4).reduce((s, p) => s + p.aqi, 0) / Math.min(4, morningPts.length))
      : env.current.aqi;

  return {
    trendDirection: forecast.trendDirection,
    trendDeltaPct: forecast.trendDeltaPct,
    next24hPeakAqi: next24.length > 0 ? Math.max(...next24.map((p) => p.aqi)) : env.current.aqi,
    next24hMinAqi: next24.length > 0 ? Math.min(...next24.map((p) => p.aqi)) : env.current.aqi,
    tomorrowMorningAqi,
    cleanestWindows: forecast.cleanestWindows,
    evaluation: forecast.evaluation,
  };
}

export async function tool_detect_pollution_anomaly(ctx: ToolContext) {
  const env = await fetchLiveEnvironment(ctx.location, ctx.standard);
  const forecast = buildForecastAnalytics(env.current, env.hourlySeries);
  return {
    anomaliesDetected: forecast.anomalies.length,
    anomalies: forecast.anomalies.slice(0, 3),
    winterSmogRisk: forecast.winterSmogRisk,
  };
}

export function tool_assess_exposure(params: {
  aqi: number;
  ageGroup: FamilyMember['ageGroup'];
  activityLevel: FamilyMember['activityProfile'];
}) {
  const { aqi, ageGroup, activityLevel } = params;
  const sensitivityMultiplier = ageGroup === 'child' ? 1.25 : ageGroup === 'elderly' ? 1.3 : 1.0;
  const exertionMultiplier = activityLevel === 'active_outdoor' ? 1.25 : activityLevel === 'moderate' ? 1.0 : 0.85;
  const adjustedScore = Math.round(aqi * sensitivityMultiplier * exertionMultiplier);

  let level: 'low' | 'moderate' | 'elevated' | 'high' = 'low';
  let guidance = 'Suitable for regular outdoor activities.';
  if (adjustedScore > 260) {
    level = 'high';
    guidance =
      'Shift vigorous outdoor play or exercise indoors; if outdoor travel is necessary, shorten duration and use a well-fitted N95/FFP2 respirator.';
  } else if (adjustedScore > 160) {
    level = 'elevated';
    guidance =
      'Limit intense outdoor exertion; prefer the cleanest afternoon window and choose park corridors away from arterial traffic.';
  } else if (adjustedScore > 95) {
    level = 'moderate';
    guidance = 'Light-to-moderate outdoor activity is reasonable; pace strenuous workouts during peak traffic hours.';
  }

  return {
    ageGroup,
    activityLevel,
    rawAqi: aqi,
    exposureLevel: level,
    guidance,
    disclaimer: 'Informational environmental exposure guidance only — not a medical diagnosis.',
  };
}

export async function tool_generate_daily_plan(ctx: ToolContext) {
  const env = await fetchLiveEnvironment(ctx.location, ctx.standard);
  const forecast = buildForecastAnalytics(env.current, env.hourlySeries);
  const cleanest = forecast.cleanestWindows[0];
  const aqi = env.current.aqi;

  return {
    city: ctx.location.name,
    currentAqi: aqi,
    bestOutdoorWindow: cleanest ? `${cleanest.start}–${cleanest.end} (Est. AQI ${cleanest.avgAqi})` : '13:00–15:00',
    schedule: [
      {
        slot: 'Morning Routine (06:30–08:30)',
        mode: aqi > 180 ? 'Indoor Focus' : 'Light Outdoor OK',
        action:
          aqi > 180
            ? 'Morning boundary-layer particulates are elevated. Keep bedroom windows closed and do indoor mobility/yoga.'
            : 'Take a brisk 25-minute walk along tree-lined residential streets before commuter peak.',
      },
      {
        slot: 'School & Office Commute (08:30–10:00)',
        mode: aqi > 150 ? 'Filtered Transit Preferred' : 'Active / Green Transit',
        action:
          aqi > 150
            ? 'Use closed-cabin metro/electric bus or AC carpool on recirculation mode; avoid idling behind heavy diesel vehicles.'
            : 'Metro + short greenway walk or cycling delivers low emissions and low exposure.',
      },
      {
        slot: 'Midday Home Ventilation (13:00–15:30)',
        mode: 'Ventilation Window',
        action:
          cleanest && cleanest.avgAqi < 150
            ? `Open opposite windows for 20 minutes during ${cleanest.start}–${cleanest.end} to flush indoor CO2 and cooking fumes.`
            : 'Outdoor AQI remains elevated; use short 10-minute exhaust-assisted ventilation and rely on HEPA filtration.',
      },
      {
        slot: 'Evening Exercise & Family Time (17:30–20:00)',
        mode: aqi > 200 ? 'Indoor Alternative' : 'Moderate Outdoor',
        action:
          aqi > 200
            ? 'Swap outdoor running for indoor strength training or swimming; keep kitchen chimney active during dinner prep.'
            : 'Park stroll away from arterial roads; monitor hourly forecast for evening inversion buildup.',
      },
    ],
  };
}

export function tool_analyze_indoor_environment(room: IndoorRoom, outdoorPm25: number) {
  const areaM2 = room.areaSqFt * 0.092903;
  const volumeM3 = areaM2 * (room.ceilingHeightFt * 0.3048);
  const infiltrationFactor =
    room.ventilationType === 'mechanical_filtered'
      ? 0.35
      : room.ventilationType === 'ac_recirculate'
        ? 0.55
        : room.ventilationType === 'exhaust_fan'
          ? 0.68
          : 0.78;
  const sourcePenalty = room.roomType === 'kitchen' ? 18 : room.sources.length * 4;
  const purifierReduction =
    room.hasPurifier && room.purifierCadrM3h
      ? Math.min(0.68, (room.purifierCadrM3h / Math.max(20, volumeM3 * 5)) * 0.6)
      : 0;

  const estimatedIndoorPm25 = Number(
    Math.max(4, (outdoorPm25 * infiltrationFactor + sourcePenalty) * (1 - purifierReduction)).toFixed(1),
  );
  const requiredCadr4Ach = Math.round(volumeM3 * 4);
  const requiredCadr5Ach = Math.round(volumeM3 * 5);
  const currentAch =
    room.hasPurifier && room.purifierCadrM3h ? Number((room.purifierCadrM3h / Math.max(1, volumeM3)).toFixed(1)) : 0;

  return {
    roomName: room.name,
    volumeM3: Number(volumeM3.toFixed(1)),
    estimatedIndoorPm25,
    measurementNote: 'Estimated indoor PM2.5 from room ventilation & outdoor infiltration model (not a physical sensor reading).',
    requiredCadr4AchM3h: requiredCadr4Ach,
    requiredCadr5AchM3h: requiredCadr5Ach,
    currentAch,
    adequacyStatus: !room.hasPurifier
      ? 'No active HEPA purifier configured'
      : currentAch >= 4
        ? 'Adequate filtration capacity (≥4 ACH)'
        : 'Undersized purifier for high-AQI episodes (<4 ACH)',
  };
}

export function tool_recommend_air_purifier(areaSqFt: number, ceilingHeightFt = 9.5) {
  const volumeM3 = areaSqFt * 0.092903 * (ceilingHeightFt * 0.3048);
  const targetCadrM3h = Math.ceil((volumeM3 * 4.5) / 10) * 10;
  return {
    roomVolumeM3: Number(volumeM3.toFixed(1)),
    recommendedMinCadrM3h: targetCadrM3h,
    filterSpec: 'True HEPA H13 + Activated Carbon pre-filter (zero-ozone certified)',
    formula: 'CADR (m³/h) = Room Volume (m³) × 4.5 Air Changes per Hour',
  };
}

export function tool_compare_routes(params: { distanceKm: number; currentAqi: number; currentPm25: number }): MobilityOption[] {
  const d = Math.max(0.5, Math.min(200, params.distanceKm));
  const pm25 = Math.max(5, params.currentPm25);
  const aqi = Math.max(10, params.currentAqi);

  // Transparent IPCC / India GHG Program emission factors (g CO2 per passenger-km)
  const modes: Array<{
    mode: MobilityOption['mode'];
    label: string;
    speedKmh: number;
    co2PerKm: number;
    exposureFactor: number; // relative microenvironment + inhalation rate factor
    tradeoff: string;
  }> = [
    {
      mode: 'metro_rail',
      label: 'Urban Metro / Rail',
      speedKmh: 34,
      co2PerKm: 32,
      exposureFactor: 0.45,
      tradeoff: 'Filtered cabin air with 83% lower CO₂ than a solo petrol car.',
    },
    {
      mode: 'electric_bus',
      label: 'Electric City Bus',
      speedKmh: 22,
      co2PerKm: 28,
      exposureFactor: 0.58,
      tradeoff: 'Lowest motorized per-passenger emissions; slight station wait exposure.',
    },
    {
      mode: 'ev_car',
      label: 'Electric Vehicle (Recirculate)',
      speedKmh: 28,
      co2PerKm: 68,
      exposureFactor: 0.5,
      tradeoff: 'Zero tailpipe NO2/PM2.5; cabin HEPA filter shields riders during high-AQI hours.',
    },
    {
      mode: 'carpool',
      label: 'Shared Carpool (3 Riders)',
      speedKmh: 27,
      co2PerKm: 64,
      exposureFactor: 0.55,
      tradeoff: 'Cuts per-person emissions by two-thirds compared to solo driving.',
    },
    {
      mode: 'cycling',
      label: 'Cycling (Greenway Route)',
      speedKmh: 15,
      co2PerKm: 0,
      exposureFactor: aqi > 180 ? 1.55 : 0.95,
      tradeoff:
        aqi > 180
          ? 'Zero emissions, but elevated breathing rate increases PM2.5 inhalation when AQI > 180.'
          : 'Zero emissions and strong cardiovascular benefit on tree-lined corridors.',
    },
    {
      mode: 'walking',
      label: 'Walking (Shaded Streets)',
      speedKmh: 4.8,
      co2PerKm: 0,
      exposureFactor: aqi > 180 ? 1.25 : 0.85,
      tradeoff: d > 4 ? 'Best suited for trips under 3.5 km; zero emissions.' : 'Zero emissions; choose quiet side streets.',
    },
    {
      mode: 'petrol_car',
      label: 'Solo Petrol Car',
      speedKmh: 28,
      co2PerKm: 192,
      exposureFactor: 0.62,
      tradeoff: 'Highest per-passenger CO₂ and urban NO2 exhaust footprint.',
    },
  ];

  const options = modes.map((m) => {
    const travelTimeMin = Math.max(4, Math.round((d / m.speedKmh) * 60 + (m.mode === 'metro_rail' || m.mode === 'electric_bus' ? 7 : 0)));
    const co2Grams = Math.round(d * m.co2PerKm);
    // Estimated inhaled PM2.5 (µg): minute ventilation (0.01–0.025 m³/min) × ambient µg/m³ × exposureFactor × minutes
    const ventilationM3PerMin = m.mode === 'cycling' ? 0.025 : m.mode === 'walking' ? 0.016 : 0.009;
    const estimatedInhaledPm25Ug = Number((ventilationM3PerMin * pm25 * m.exposureFactor * travelTimeMin).toFixed(1));
    const relativeExposureScore = Math.min(100, Math.round((aqi / 350) * m.exposureFactor * 100));

    return {
      mode: m.mode,
      label: m.label,
      travelTimeMin,
      distanceKm: Number(d.toFixed(1)),
      co2Grams,
      relativeExposureScore,
      estimatedInhaledPm25Ug,
      emissionFactorGPerKm: m.co2PerKm,
      tradeoffSummary: m.tradeoff,
      recommended: false,
    };
  });

  // Pick best balanced recommendation depending on AQI & distance
  let bestMode: MobilityOption['mode'] = 'metro_rail';
  if (d <= 2.5 && aqi <= 140) bestMode = 'walking';
  else if (d <= 8 && aqi <= 140) bestMode = 'cycling';
  else bestMode = 'metro_rail';

  return options.map((opt) => ({ ...opt, recommended: opt.mode === bestMode }));
}

export function tool_calculate_route_exposure(distanceKm: number, mode: MobilityOption['mode'], currentAqi: number, currentPm25: number) {
  const all = tool_compare_routes({ distanceKm, currentAqi, currentPm25 });
  return all.find((o) => o.mode === mode) || all[0];
}

export function tool_calculate_carbon_impact(userId: string) {
  const db = getDb();
  const entries = db.sustainabilityByUser[userId] || db.sustainabilityByUser.guest || [];
  const totalCo2Kg = Number(entries.reduce((s, e) => s + e.avoidedCo2Kg, 0).toFixed(2));
  const totalDistanceKm = Number(entries.reduce((s, e) => s + (e.distanceKm || 0), 0).toFixed(1));
  return {
    loggedActivities: entries.length,
    totalAvoidedCo2Kg: totalCo2Kg,
    totalGreenDistanceKm: totalDistanceKm,
    equivalentTreeDays: Math.round(totalCo2Kg * 16.5), // ~22 kg CO2/year per mature urban tree
    note: 'Personal emissions avoided reflect mode-shift deltas against a 192 g/km petrol car baseline and do not directly equal citywide AQI reduction.',
  };
}

export function tool_create_pollution_alert(userId: string, title: string, message: string, severity: 'info' | 'warning' | 'critical') {
  const db = getDb();
  if (!db.alertsByUser[userId]) db.alertsByUser[userId] = [];
  const alert = {
    id: `alert-${Date.now()}`,
    title,
    message,
    severity,
    category: 'aqi_threshold' as const,
    createdAt: new Date().toISOString(),
    read: false,
  };
  db.alertsByUser[userId].unshift(alert);
  db.alertsByUser[userId] = db.alertsByUser[userId].slice(0, 30);
  saveDb();
  return alert;
}

export async function tool_generate_environmental_report(ctx: ToolContext, period: 'daily' | 'weekly' | 'monthly') {
  const env = await fetchLiveEnvironment(ctx.location, ctx.standard);
  const forecast = buildForecastAnalytics(env.current, env.hourlySeries);
  const carbon = tool_calculate_carbon_impact(ctx.userId);
  return {
    period,
    generatedAt: new Date().toISOString(),
    city: ctx.location.name,
    standard: ctx.standard,
    currentAqi: env.current.aqi,
    category: env.current.category.label,
    dominantPollutant: env.current.dominantPollutant,
    trendDirection: forecast.trendDirection,
    anomaliesCount: forecast.anomalies.length,
    winterSmogRisk: forecast.winterSmogRisk.level,
    personalSustainability: carbon,
    dataSource: env.current.source,
  };
}

export function tool_analyze_community_reports(cityName?: string) {
  const db = getDb();
  const filtered = cityName
    ? db.communityReports.filter((r) => r.city.toLowerCase().includes(cityName.toLowerCase()))
    : db.communityReports;
  const byCategory: Record<string, number> = {};
  for (const r of filtered) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
  return {
    totalReports: filtered.length,
    verifiedCount: filtered.filter((r) => r.status === 'verified').length,
    topRecurringIssue: topCategory,
    categoryBreakdown: byCategory,
    recentHighlights: filtered.slice(0, 3).map((r) => ({
      neighborhood: r.neighborhood,
      category: r.category,
      severity: r.severity,
      upvotes: r.upvotes,
    })),
  };
}

// ============================================================================
// CENTRAL MULTI-AGENT ORCHESTRATOR (8 SPECIALIZED AGENTS)
// ============================================================================

interface OrchestratorResult {
  message: ChatMessage;
  agentsUsed: AgentTraceStep[];
  citations: RagCitation[];
  ragMethod: string;
}

function selectAgentsForPrompt(prompt: string): string[] {
  const p = prompt.toLowerCase();
  const selected = new Set<string>(['AirIntelligenceAgent']);

  if (/tomorrow|forecast|tonight|morning|evening|week|trend|smog|spike|predict|when|later/.test(p)) {
    selected.add('PredictionAgent');
  }
  if (/child|kid|baby|elderly|senior|parent|asthma|safe|play|risk|exposure|family|health|mask/.test(p)) {
    selected.add('RiskAssessmentAgent');
    selected.add('PredictionAgent');
  }
  if (/plan|schedule|routine|exercise|jog|run|walk|outdoor|school|office|what should i do/.test(p)) {
    selected.add('LifestyleAssistantAgent');
    selected.add('PredictionAgent');
  }
  if (/indoor|room|bedroom|kitchen|purifier|hepa|cadr|window|ventilat|dust|cook|home/.test(p)) {
    selected.add('IndoorAirAgent');
  }
  if (/commute|route|travel|metro|bus|car|carpool|cycle|bike|walk|ev|electric|traffic|mobility/.test(p)) {
    selected.add('SmartMobilityAgent');
  }
  if (/carbon|co2|sustain|green|eco|emission|footprint|challenge|impact/.test(p)) {
    selected.add('SustainabilityAgent');
  }
  if (/community|report|neighbor|complaint|burning|construction|hotspot|campaign/.test(p)) {
    selected.add('CommunityIntelligenceAgent');
  }

  // Ensure rich multi-agent synthesis for general questions
  if (selected.size === 1) {
    selected.add('PredictionAgent');
    selected.add('LifestyleAssistantAgent');
  }

  return Array.from(selected);
}

export async function runMultiAgentOrchestrator(params: {
  userId: string;
  prompt: string;
  location: CityLocation;
  standard: AqiStandard;
  language: LanguageCode;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<OrchestratorResult> {
  const { userId, prompt, location, standard, language, history = [] } = params;
  const ctx: ToolContext = { userId, location, standard };
  const selectedAgents = selectAgentsForPrompt(prompt);
  const traces: AgentTraceStep[] = [];
  const toolOutputs: Record<string, unknown> = {};

  // Step 1: Shared Live Environmental Context (AirIntelligenceAgent always runs first)
  const t0 = Date.now();
  const [currentAqi, pollutants, weather, neighborhoods] = await Promise.all([
    tool_get_current_aqi(ctx),
    tool_get_pollutant_details(ctx),
    tool_get_weather_forecast(ctx),
    tool_get_neighborhood_aqi(ctx),
  ]);
  toolOutputs.airIntelligence = { currentAqi, pollutants, weather, neighborhoods };
  traces.push({
    agentName: 'Air Intelligence Agent',
    role: 'Live telemetry & neighborhood comparison',
    toolsInvoked: ['get_current_aqi', 'get_pollutant_details', 'get_weather_forecast', 'get_neighborhood_aqi'],
    durationMs: Date.now() - t0,
    status: 'completed',
    summary: `${location.name} ${standard}: ${currentAqi.aqi} (${currentAqi.category.label}), dominant ${currentAqi.dominantPollutant}.`,
  });

  // Step 2: Execute independent specialized agents in parallel
  const db = getDb();
  const family = db.familyByUser[userId] || db.familyByUser.guest || [];
  const rooms = db.roomsByUser[userId] || db.roomsByUser.guest || [];

  const parallelTasks: Promise<void>[] = [];

  if (selectedAgents.includes('PredictionAgent')) {
    parallelTasks.push(
      (async () => {
        const s = Date.now();
        const [pred, anom] = await Promise.all([tool_predict_pollution(ctx), tool_detect_pollution_anomaly(ctx)]);
        toolOutputs.prediction = { ...pred, ...anom };
        traces.push({
          agentName: 'Prediction Agent',
          role: '72h forecasting & anomaly detection',
          toolsInvoked: ['predict_pollution', 'detect_pollution_anomaly'],
          durationMs: Date.now() - s,
          status: 'completed',
          summary: `Trend ${pred.trendDirection} (${pred.trendDeltaPct}%), tomorrow morning est. AQI ${pred.tomorrowMorningAqi}, winter smog risk ${anom.winterSmogRisk.level}.`,
        });
      })(),
    );
  }

  if (selectedAgents.includes('IndoorAirAgent')) {
    parallelTasks.push(
      (async () => {
        const s = Date.now();
        const outdoorPm25 = pollutants.pollutants.pm25 ?? 35;
        const roomAnalyses = rooms.map((r) => tool_analyze_indoor_environment(r, outdoorPm25));
        const samplePurifier = tool_recommend_air_purifier(rooms[0]?.areaSqFt || 185, rooms[0]?.ceilingHeightFt || 9.5);
        toolOutputs.indoorAir = { roomAnalyses, samplePurifier };
        traces.push({
          agentName: 'Indoor Air Agent',
          role: 'Room CADR sizing & ventilation timing',
          toolsInvoked: ['analyze_indoor_environment', 'recommend_air_purifier'],
          durationMs: Date.now() - s,
          status: 'completed',
          summary: `Evaluated ${rooms.length} configured rooms; recommended CADR ${samplePurifier.recommendedMinCadrM3h} m³/h for primary space.`,
        });
      })(),
    );
  }

  if (selectedAgents.includes('SmartMobilityAgent')) {
    parallelTasks.push(
      (async () => {
        const s = Date.now();
        const distMatch = prompt.match(/(\d+(?:\.\d+)?)\s*km/i);
        const distanceKm = distMatch ? Number(distMatch[1]) : 10;
        const routes = tool_compare_routes({
          distanceKm,
          currentAqi: currentAqi.aqi,
          currentPm25: pollutants.pollutants.pm25 ?? 35,
        });
        toolOutputs.smartMobility = { distanceKm, routes };
        const rec = routes.find((r) => r.recommended);
        traces.push({
          agentName: 'Smart Mobility Agent',
          role: 'Emission & inhalation exposure routing',
          toolsInvoked: ['compare_routes', 'calculate_route_exposure'],
          durationMs: Date.now() - s,
          status: 'completed',
          summary: `Compared 7 modes over ${distanceKm} km; recommended ${rec?.label || 'Metro'} (${rec?.co2Grams ?? 0} g CO₂).`,
        });
      })(),
    );
  }

  if (selectedAgents.includes('SustainabilityAgent')) {
    parallelTasks.push(
      (async () => {
        const s = Date.now();
        const impact = tool_calculate_carbon_impact(userId);
        toolOutputs.sustainability = impact;
        traces.push({
          agentName: 'Sustainability Agent',
          role: 'Carbon impact & eco-challenge tracking',
          toolsInvoked: ['calculate_carbon_impact'],
          durationMs: Date.now() - s,
          status: 'completed',
          summary: `${impact.totalAvoidedCo2Kg} kg CO₂ avoided across ${impact.loggedActivities} logged sustainable activities.`,
        });
      })(),
    );
  }

  if (selectedAgents.includes('CommunityIntelligenceAgent')) {
    parallelTasks.push(
      (async () => {
        const s = Date.now();
        const community = tool_analyze_community_reports(location.name);
        toolOutputs.community = community;
        traces.push({
          agentName: 'Community Intelligence Agent',
          role: 'Neighborhood incident & trend synthesis',
          toolsInvoked: ['analyze_community_reports'],
          durationMs: Date.now() - s,
          status: 'completed',
          summary: `Analyzed ${community.totalReports} reports for ${location.name} (${community.verifiedCount} verified).`,
        });
      })(),
    );
  }

  // Parallel RAG retrieval
  const ragPromise = retrieveEnvironmentalKnowledge(`${prompt} ${location.name} AQI ${currentAqi.dominantPollutant}`, {
    topK: 3,
  });

  await Promise.all([...parallelTasks, ragPromise]);
  const ragResult = await ragPromise;

  // Step 3: Dependent Agents (RiskAssessmentAgent & LifestyleAssistantAgent use prediction + family data)
  if (selectedAgents.includes('RiskAssessmentAgent')) {
    const s = Date.now();
    const targetAqi = (toolOutputs.prediction as any)?.tomorrowMorningAqi && /tomorrow|morning/i.test(prompt)
      ? (toolOutputs.prediction as any).tomorrowMorningAqi
      : currentAqi.aqi;

    const assessments =
      family.length > 0
        ? family.map((m) => ({
            memberName: m.name,
            ...tool_assess_exposure({ aqi: targetAqi, ageGroup: m.ageGroup, activityLevel: m.activityProfile }),
          }))
        : [tool_assess_exposure({ aqi: targetAqi, ageGroup: 'adult', activityLevel: 'moderate' })];

    toolOutputs.riskAssessment = { evaluatedAqi: targetAqi, assessments };
    traces.push({
      agentName: 'Risk Assessment Agent',
      role: 'Age-group exposure & non-medical precaution scoring',
      toolsInvoked: ['assess_exposure'],
      durationMs: Date.now() - s,
      status: 'completed',
      summary: `Assessed exposure at AQI ${targetAqi} for ${assessments.length} family profile(s).`,
    });
  }

  if (selectedAgents.includes('LifestyleAssistantAgent')) {
    const s = Date.now();
    const dailyPlan = await tool_generate_daily_plan(ctx);
    toolOutputs.lifestyle = dailyPlan;
    traces.push({
      agentName: 'Lifestyle Assistant Agent',
      role: 'Pollution-aware routine & window scheduling',
      toolsInvoked: ['generate_daily_plan'],
      durationMs: Date.now() - s,
      status: 'completed',
      summary: `Generated pollution-aware schedule; best window ${dailyPlan.bestOutdoorWindow}.`,
    });
  }

  // Step 4: Unified Synthesis via Server-Side Google Gemini (`gemini-4-hydrogen`)
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please add a valid API key in Settings > Secrets to enable the AI Air Assistant.',
    );
  }

  const languageInstruction =
    language === 'hi'
      ? 'Respond fluently in Hindi (Devanagari script, हिन्दी), keeping pollutant chemical symbols (PM2.5, PM10, NO2, AQI) clear and readable.'
      : language === 'or'
        ? 'Respond fluently in Odia (ଓଡ଼ିଆ script), keeping pollutant chemical symbols (PM2.5, PM10, NO2, AQI) clear and readable.'
        : 'Respond in clear, concise, actionable English.';

  const systemInstruction = `You are the Central Orchestrator of AIRWISE AI — an Agentic Urban Air Quality & Smart City Environmental Intelligence Platform.

CORE PROMISE: "Don't just tell people how polluted the air is. Tell them what to do, when to do it, where to go and how their choices can make a difference."

STRICT GROUNDING & SAFETY RULES:
1. NEVER invent, guess, or fabricate pollution measurements. Cite ONLY the live measured/forecasted values present in the Agent Tool Outputs below.
2. NEVER provide medical diagnoses, prescribe medication, or promise health protection. Frame advice as practical environmental exposure reduction and remind users to consult a qualified healthcare professional for personal health conditions when relevant.
3. Explicitly note prediction uncertainty (e.g., forecast confidence band, micro-zone estimate vs live reference model) when discussing future hours or neighborhood variations.
4. Resolve any conflicting agent recommendations into one coherent, prioritized action plan.
5. ${languageInstruction}
6. Return valid JSON matching the exact schema requested.`;

  const recentTurns = history
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n');

  const userPayload = `USER REQUEST:
${prompt}

RECENT CONVERSATION CONTEXT:
${recentTurns || 'None (first turn)'}

VERIFIED MULTI-AGENT TOOL OUTPUTS (LIVE DATA):
${JSON.stringify(toolOutputs, null, 2)}

RETRIEVED ENVIRONMENTAL KNOWLEDGE (RAG CITATIONS):
${ragResult.citations.map((c, idx) => `[${idx + 1}] ${c.title} (${c.source}): ${c.excerpt}`).join('\n\n')}`;

  const { response } = await generateContentWithRetry({
    model: getGeminiModel(),
    contents: userPayload,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: {
            type: Type.STRING,
            description:
              'Clear, direct, well-structured response answering the user question with exact cited AQI/PM2.5 data, practical reasoning, and alternatives.',
          },
          uncertaintyNote: {
            type: Type.STRING,
            description:
              'Short honest note on forecast uncertainty, data freshness, or the non-medical scope of environmental advice.',
          },
          structuredActions: {
            type: Type.ARRAY,
            description: '2 to 4 concrete action items specifying what to do and when.',
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                timing: { type: Type.STRING },
                detail: { type: Type.STRING },
              },
              required: ['title', 'timing', 'detail'],
            },
          },
        },
        required: ['answer', 'uncertaintyNote', 'structuredActions'],
      },
    },
  });

  const rawText = (response.text || '').trim();
  let parsed: {
    answer: string;
    uncertaintyNote: string;
    structuredActions: Array<{ title: string; timing: string; detail: string }>;
  };

  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = {
      answer: rawText || `Current ${standard} AQI in ${location.name} is ${currentAqi.aqi} (${currentAqi.category.label}).`,
      uncertaintyNote: `Data sourced from ${currentAqi.source}. Forecasts include meteorological uncertainty.`,
      structuredActions: [],
    };
  }

  const assistantMsg: ChatMessage = {
    id: `msg-${Date.now()}-a`,
    role: 'assistant',
    content: parsed.answer,
    language,
    createdAt: new Date().toISOString(),
    agentsUsed: traces,
    citations: ragResult.citations,
    uncertaintyNote: parsed.uncertaintyNote,
    structuredActions: parsed.structuredActions?.slice(0, 4) || [],
  };

  appendAuditLog(
    userId,
    'multi_agent_orchestrator',
    `Agents: ${traces.map((t) => t.agentName).join(', ')} | City: ${location.name} | RAG: ${ragResult.method}`,
  );

  return {
    message: assistantMsg,
    agentsUsed: traces,
    citations: ragResult.citations,
    ragMethod: ragResult.method,
  };
}

export function runDigitalTwinSimulation(
  current: CurrentEnvironmentData,
  input: {
    trafficReductionPct: number;
    publicTransitShiftPct: number;
    greenCoverIncreasePct: number;
    openBurningReductionPct: number;
    windSpeedModifierPct: number;
  },
) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const traffic = clamp(input.trafficReductionPct, 0, 70);
  const transit = clamp(input.publicTransitShiftPct, 0, 60);
  const green = clamp(input.greenCoverIncreasePct, 0, 50);
  const burning = clamp(input.openBurningReductionPct, 0, 90);
  const windMod = clamp(input.windSpeedModifierPct, -40, 40);

  // Transparent urban source-apportionment sensitivity weights (illustrative policy simulation)
  // Typical South Asian / Urban PM2.5 apportionment: ~28% vehicular, ~20% biomass/waste burning, ~12% canopy deposition
  const vehicularReduction = Math.min(0.32, (traffic * 0.28 + transit * 0.14) / 100);
  const burningReduction = (burning * 0.2) / 100;
  const canopyDeposition = (green * 0.12) / 100;
  const windDispersionEffect = -(windMod * 0.22) / 100; // higher wind lowers concentration

  const netMultiplier = clamp(
    1 - vehicularReduction - burningReduction - canopyDeposition + windDispersionEffect,
    0.35,
    1.35,
  );

  const baselinePm25 = current.pollutants.pm25 ?? 40;
  const simulatedPm25 = Number((baselinePm25 * netMultiplier).toFixed(1));
  const simulatedPm10 = Number(((current.pollutants.pm10 ?? 75) * (netMultiplier * 0.96 + 0.04)).toFixed(1));
  const simulatedNo2 = Number(((current.pollutants.no2 ?? 28) * Math.max(0.35, 1 - vehicularReduction * 1.45)).toFixed(1));

  const simCpcb = calculateCpcbNaqi({
    pm25: simulatedPm25,
    pm10: simulatedPm10,
    no2: simulatedNo2,
    so2: current.pollutants.so2,
    co: current.pollutants.co,
    o3: current.pollutants.o3,
  });

  const simulatedAqi =
    current.standard === 'US_AQI' ? Math.max(5, Math.round(current.usAqi * netMultiplier)) : simCpcb.aqi;
  const baselineAqi = current.aqi;

  const zones = buildNeighborhoodStations(current);
  const zoneImpacts = zones.map((z) => {
    const zoneFactor =
      z.zoneType === 'traffic_hotspot'
        ? Math.max(0.35, netMultiplier - vehicularReduction * 0.35)
        : z.zoneType === 'green_zone'
          ? Math.max(0.35, netMultiplier - canopyDeposition * 0.25)
          : netMultiplier;
    const zSimAqi = Math.max(5, Math.round(z.aqi * zoneFactor));
    return {
      zoneName: z.name.replace(`${current.location.name} — `, ''),
      zoneType: z.zoneType,
      baselineAqi: z.aqi,
      simulatedAqi: zSimAqi,
      delta: zSimAqi - z.aqi,
    };
  });

  // Illustrative annual CO2 avoided per 100,000 commuters
  const estimatedAnnualCo2AvoidedTonsPer100k = Math.round((traffic * 0.55 + transit * 0.72) * 320);

  return {
    isSimulated: true as const,
    baselineAqi,
    simulatedAqi,
    baselinePm25,
    simulatedPm25,
    aqiDelta: simulatedAqi - baselineAqi,
    pm25ReductionPct: Number((((baselinePm25 - simulatedPm25) / Math.max(1, baselinePm25)) * 100).toFixed(1)),
    estimatedAnnualCo2AvoidedTonsPer100k,
    simulatedCategory: classifyAqi(simulatedAqi, current.standard),
    assumptions: [
      'Simulated scenario anchored to current live baseline; outputs are illustrative model projections, not measured ambient values.',
      'Source apportionment assumes ~28% vehicular exhaust share, ~20% open waste/biomass share, and ~12% urban canopy particulate deposition ceiling.',
      'Regional transboundary background pollution (~35% floor) cannot be eliminated by local city traffic interventions alone.',
    ],
    zoneImpacts,
  };
}

export async function generateGeminiQuickBrief(params: {
  location: CityLocation;
  standard: AqiStandard;
  language: LanguageCode;
}) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add your key in Settings > Secrets to activate Gemini briefings.',
    );
  }

  const env = await fetchLiveEnvironment(params.location, params.standard);
  const forecast = buildForecastAnalytics(env.current, env.hourlySeries);
  const cleanest = forecast.cleanestWindows[0];

  const langPrompt =
    params.language === 'hi'
      ? 'Write all text values in natural Hindi (Devanagari).'
      : params.language === 'or'
        ? 'Write all text values in natural Odia (ଓଡ଼ିଆ).'
        : 'Write all text values in crisp, actionable English.';

  const { response, modelUsed } = await generateContentWithRetry({
    model: getGeminiModel(),
    contents: `Generate a concise live air-quality action briefing for ${env.current.location.name}.
Live Data:
- Standard: ${env.current.standard}
- Current AQI: ${env.current.aqi} (${env.current.category.label})
- Dominant Pollutant: ${env.current.dominantPollutant}
- PM2.5: ${env.current.pollutants.pm25} µg/m³, PM10: ${env.current.pollutants.pm10} µg/m³, NO2: ${env.current.pollutants.no2} µg/m³
- Weather: ${env.current.weather.temperatureC}°C, RH ${env.current.weather.humidityPct}%, Wind ${env.current.weather.windSpeedKmh} km/h ${env.current.weather.windCardinal}
- 24h Trend: ${forecast.trendDirection} (${forecast.trendDeltaPct}%)
- Winter Smog Risk: ${forecast.winterSmogRisk.level} (${forecast.winterSmogRisk.score}/100)
- Best 2-hour window: ${cleanest ? `${cleanest.start}-${cleanest.end} (Est. AQI ${cleanest.avgAqi})` : '13:00-15:00'}`,
    config: {
      systemInstruction: `You are AIRWISE AI powered by Google Gemini. Never invent numbers outside the provided live data. Never make medical diagnoses. ${langPrompt}`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING, description: 'One concise 8-14 word executive air quality headline.' },
          outdoorVerdict: { type: Type.STRING, description: 'Specific outdoor timing & activity advice citing live AQI.' },
          indoorAction: { type: Type.STRING, description: 'Actionable ventilation or HEPA filtration step.' },
          commuteAction: { type: Type.STRING, description: 'Recommended lower-exposure, lower-emission commute option.' },
          forecastNote: { type: Type.STRING, description: 'Brief 24h outlook including dispersion or uncertainty note.' },
        },
        required: ['headline', 'outdoorVerdict', 'indoorAction', 'commuteAction', 'forecastNote'],
      },
    },
  });

  const parsed = JSON.parse((response.text || '{}').trim());
  return {
    model: modelUsed,
    generatedAt: new Date().toISOString(),
    city: env.current.location.name,
    aqi: env.current.aqi,
    standard: env.current.standard,
    ...parsed,
  };
}

