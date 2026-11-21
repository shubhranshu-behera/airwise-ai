export type UserRole = 'citizen' | 'community_lead' | 'admin';
export type LanguageCode = 'en' | 'hi' | 'or';
export type AqiStandard = 'CPCB_NAQI' | 'US_AQI';

export interface CityLocation {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  timezone?: string;
}

export interface PollutantSnapshot {
  pm25: number | null; // µg/m³
  pm10: number | null; // µg/m³
  no2: number | null; // µg/m³
  so2: number | null; // µg/m³
  co: number | null; // mg/m³
  o3: number | null; // µg/m³
}

export interface WeatherSnapshot {
  temperatureC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windCardinal: string;
  pressureHpa: number | null;
  weatherLabel: string;
}

export interface AqiCategory {
  label: string;
  level: 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very_poor' | 'severe';
  color: string;
  advisory: string;
}

export interface CurrentEnvironmentData {
  location: CityLocation;
  observedAt: string;
  fetchedAt: string;
  freshnessMinutes: number;
  source: string;
  dataType: 'live_reanalysis_api' | 'cached_live_api';
  standard: AqiStandard;
  aqi: number;
  usAqi: number;
  europeanAqi: number | null;
  dominantPollutant: string;
  category: AqiCategory;
  pollutants: PollutantSnapshot;
  weather: WeatherSnapshot;
  subIndices: Record<string, number>;
}

export interface HourlyPoint {
  time: string;
  label: string;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  aqi: number;
  usAqi: number;
  temperatureC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  isForecast: boolean;
  confidenceLow?: number;
  confidenceHigh?: number;
}

export interface PollutionAnomaly {
  time: string;
  pollutant: string;
  observedValue: number;
  baselineMean: number;
  zScore: number;
  severity: 'elevated' | 'spike';
  explanation: string;
}

export interface ModelEvaluationMetrics {
  modelName: string;
  version: string;
  trainSamples: number;
  testSamples: number;
  maePm25: number;
  rmsePm25: number;
  directionalAccuracyPct: number;
  evaluatedAt: string;
  methodology: string;
}

export interface ForecastBundle {
  location: CityLocation;
  generatedAt: string;
  source: string;
  standard: AqiStandard;
  history: HourlyPoint[];
  forecast24h: HourlyPoint[];
  forecast48h: HourlyPoint[];
  forecast72h: HourlyPoint[];
  trendDirection: 'improving' | 'stable' | 'worsening';
  trendDeltaPct: number;
  winterSmogRisk: {
    level: 'low' | 'moderate' | 'high';
    score: number;
    factors: string[];
  };
  anomalies: PollutionAnomaly[];
  evaluation: ModelEvaluationMetrics;
  cleanestWindows: Array<{
    start: string;
    end: string;
    avgAqi: number;
    avgPm25: number;
    recommendedFor: string;
  }>;
}

export interface NeighborhoodStation {
  id: string;
  name: string;
  zoneType: 'monitoring_station' | 'traffic_hotspot' | 'green_zone' | 'residential' | 'industrial';
  lat: number;
  lng: number;
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  category: AqiCategory;
  dataOrigin: 'city_reference_model' | 'estimated_microzone_offset';
  confidencePct: number;
  observedAt: string;
  note: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  ageGroup: 'child' | 'adult' | 'elderly';
  activityProfile: 'low' | 'moderate' | 'active_outdoor';
  sensitivityNote: string;
  preferredOutdoorWindow: string;
  notificationsEnabled: boolean;
}

export interface IndoorRoom {
  id: string;
  name: string;
  roomType: 'bedroom' | 'living_room' | 'kitchen' | 'study' | 'nursery';
  areaSqFt: number;
  ceilingHeightFt: number;
  ventilationType: 'natural_windows' | 'exhaust_fan' | 'ac_recirculate' | 'mechanical_filtered';
  sources: string[];
  hasPurifier: boolean;
  purifierCadrM3h?: number;
  checklistCompleted: string[];
}

export interface MobilityOption {
  mode: 'metro_rail' | 'electric_bus' | 'ev_car' | 'carpool' | 'petrol_car' | 'cycling' | 'walking';
  label: string;
  travelTimeMin: number;
  distanceKm: number;
  co2Grams: number;
  relativeExposureScore: number; // 0-100 lower is better
  estimatedInhaledPm25Ug: number;
  emissionFactorGPerKm: number;
  tradeoffSummary: string;
  recommended: boolean;
}

export interface SustainabilityEntry {
  id: string;
  date: string;
  activityType: 'transit_commute' | 'cycling' | 'walking' | 'carpool' | 'ev_trip' | 'energy_saving' | 'tree_care';
  label: string;
  distanceKm?: number;
  avoidedCo2Kg: number;
  notes: string;
}

export interface CommunityReport {
  id: string;
  authorId: string;
  authorName: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  category: 'waste_burning' | 'construction_dust' | 'traffic_congestion' | 'industrial_smoke' | 'clean_air_zone';
  severity: 'low' | 'medium' | 'high';
  description: string;
  photoDataUrl?: string;
  status: 'pending' | 'verified' | 'flagged';
  upvotes: number;
  upvotedBy: string[];
  approximateLocationOnly: boolean;
  createdAt: string;
}

export interface EnvironmentalAlert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'aqi_threshold' | 'pollution_spike' | 'forecast' | 'family' | 'community';
  createdAt: string;
  read: boolean;
}

export interface AgentTraceStep {
  agentName: string;
  role: string;
  toolsInvoked: string[];
  durationMs: number;
  status: 'completed' | 'fallback';
  summary: string;
}

export interface RagCitation {
  id: string;
  title: string;
  source: string;
  category: string;
  similarity: number;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  language: LanguageCode;
  createdAt: string;
  agentsUsed?: AgentTraceStep[];
  citations?: RagCitation[];
  uncertaintyNote?: string;
  structuredActions?: Array<{
    title: string;
    timing: string;
    detail: string;
  }>;
}

export interface UserPreferences {
  defaultCityId: string;
  language: LanguageCode;
  aqiStandard: AqiStandard;
  aqiAlertThreshold: number;
  notifications: {
    aqiSpikes: boolean;
    dailyBriefing: boolean;
    familyAlerts: boolean;
    communityUpdates: boolean;
  };
  privacy: {
    storeChatHistory: boolean;
    approximateLocationOnly: boolean;
    shareAnonymousImpactStats: boolean;
  };
  theme: 'dark' | 'light';
}

export interface UserAccountPublic {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  preferences: UserPreferences;
}

export interface DigitalTwinScenarioInput {
  trafficReductionPct: number; // 0-70
  publicTransitShiftPct: number; // 0-60
  greenCoverIncreasePct: number; // 0-50
  openBurningReductionPct: number; // 0-90
  windSpeedModifierPct: number; // -40 to +40
}

export interface DigitalTwinResult {
  isSimulated: true;
  baselineAqi: number;
  simulatedAqi: number;
  baselinePm25: number;
  simulatedPm25: number;
  aqiDelta: number;
  pm25ReductionPct: number;
  estimatedAnnualCo2AvoidedTonsPer100k: number;
  assumptions: string[];
  zoneImpacts: Array<{
    zoneName: string;
    zoneType: string;
    baselineAqi: number;
    simulatedAqi: number;
    delta: number;
  }>;
}
