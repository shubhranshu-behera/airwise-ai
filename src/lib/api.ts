import type {
  AqiStandard,
  ChatMessage,
  CityLocation,
  CommunityReport,
  CurrentEnvironmentData,
  DigitalTwinScenarioInput,
  EnvironmentalAlert,
  FamilyMember,
  ForecastBundle,
  IndoorRoom,
  LanguageCode,
  MobilityOption,
  NeighborhoodStation,
  RagCitation,
  SustainabilityEntry,
  UserAccountPublic,
  UserPreferences,
} from '../types';

let memoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (memoryToken) {
    headers['Authorization'] = `Bearer ${memoryToken}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

function cityQuery(city: CityLocation, standard: AqiStandard): string {
  const params = new URLSearchParams({
    city: city.id,
    cityId: city.id,
    name: city.name,
    region: city.region,
    country: city.country,
    lat: String(city.lat),
    lng: String(city.lng),
    standard,
  });
  return params.toString();
}

export const api = {
  // Auth
  getAdminStatus: () => apiRequest<{ adminClaimed: boolean; envPasscodeConfigured: boolean }>('/api/auth/admin-status'),
  register: (body: { email: string; password: string; name: string; role?: 'citizen' | 'community_lead' }) =>
    apiRequest<{ token: string; user: UserAccountPublic }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    apiRequest<{ token: string; user: UserAccountPublic }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  claimAdmin: (passcode: string) =>
    apiRequest<{ token: string; user: UserAccountPublic }>('/api/auth/claim-admin', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),
  logout: () => apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  getMe: () => apiRequest<{ authenticated: boolean; user: UserAccountPublic | null }>('/api/auth/me'),

  // Environment
  getCities: () => apiRequest<{ cities: CityLocation[] }>('/api/env/cities'),
  searchCities: (q: string) => apiRequest<{ results: CityLocation[] }>(`/api/env/search?q=${encodeURIComponent(q)}`),
  getCurrentEnv: (city: CityLocation, standard: AqiStandard) =>
    apiRequest<CurrentEnvironmentData>(`/api/env/current?${cityQuery(city, standard)}`),
  getForecast: (city: CityLocation, standard: AqiStandard) =>
    apiRequest<ForecastBundle>(`/api/env/forecast?${cityQuery(city, standard)}`),
  getNeighborhoods: (city: CityLocation, standard: AqiStandard) =>
    apiRequest<{ city: CityLocation; observedAt: string; source: string; stations: NeighborhoodStation[] }>(
      `/api/env/neighborhoods?${cityQuery(city, standard)}`,
    ),
  runDigitalTwin: (city: CityLocation, standard: AqiStandard, scenario: DigitalTwinScenarioInput) =>
    apiRequest<any>('/api/env/digital-twin', {
      method: 'POST',
      body: JSON.stringify({
        city: city.id,
        lat: city.lat,
        lng: city.lng,
        name: city.name,
        standard,
        scenario,
      }),
    }),

  // AI & RAG
  getAiStatus: () =>
    apiRequest<{
      configured: boolean;
      reasoningModel: string;
      embeddingModel: string;
      agentCount: number;
    }>('/api/ai/status'),
  getGeminiQuickBrief: (body: { city: CityLocation; standard: AqiStandard; language: LanguageCode }) =>
    apiRequest<{
      model: string;
      generatedAt: string;
      city: string;
      aqi: number;
      standard: AqiStandard;
      headline: string;
      outdoorVerdict: string;
      indoorAction: string;
      commuteAction: string;
      forecastNote: string;
    }>('/api/ai/quick-brief', {
      method: 'POST',
      body: JSON.stringify({
        city: body.city.id,
        lat: body.city.lat,
        lng: body.city.lng,
        name: body.city.name,
        standard: body.standard,
        language: body.language,
      }),
    }),
  sendAiChat: (body: {
    prompt: string;
    city: CityLocation;
    standard: AqiStandard;
    language: LanguageCode;
  }) =>
    apiRequest<{
      message: ChatMessage;
      agentsUsed: ChatMessage['agentsUsed'];
      citations: RagCitation[];
      ragMethod: string;
    }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: body.prompt,
        city: body.city.id,
        lat: body.city.lat,
        lng: body.city.lng,
        name: body.city.name,
        standard: body.standard,
        language: body.language,
      }),
    }),
  getChatHistory: () => apiRequest<{ messages: ChatMessage[] }>('/api/ai/history'),
  clearChatHistory: () => apiRequest<{ ok: boolean }>('/api/ai/history', { method: 'DELETE' }),
  getDailyPlan: (city: CityLocation, standard: AqiStandard) =>
    apiRequest<{
      city: string;
      currentAqi: number;
      bestOutdoorWindow: string;
      schedule: Array<{ slot: string; mode: string; action: string }>;
    }>(`/api/ai/daily-plan?${cityQuery(city, standard)}`),
  searchKnowledge: (query: string) =>
    apiRequest<{ citations: RagCitation[]; method: string }>('/api/ai/rag/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  // Family
  getFamily: () => apiRequest<{ members: FamilyMember[] }>('/api/family'),
  addFamilyMember: (member: Omit<FamilyMember, 'id'>) =>
    apiRequest<{ member: FamilyMember }>('/api/family', { method: 'POST', body: JSON.stringify(member) }),
  deleteFamilyMember: (id: string) => apiRequest<{ ok: boolean }>(`/api/family/${id}`, { method: 'DELETE' }),

  // Indoor
  getIndoorRooms: (outdoorPm25: number) =>
    apiRequest<{
      rooms: Array<
        IndoorRoom & {
          analysis: {
            roomName: string;
            volumeM3: number;
            estimatedIndoorPm25: number;
            measurementNote: string;
            requiredCadr4AchM3h: number;
            requiredCadr5AchM3h: number;
            currentAch: number;
            adequacyStatus: string;
          };
          purifierGuide: {
            roomVolumeM3: number;
            recommendedMinCadrM3h: number;
            filterSpec: string;
            formula: string;
          };
        }
      >;
    }>(`/api/indoor?outdoorPm25=${encodeURIComponent(String(outdoorPm25))}`),
  addIndoorRoom: (room: Omit<IndoorRoom, 'id'>) =>
    apiRequest<{ room: IndoorRoom }>('/api/indoor', { method: 'POST', body: JSON.stringify(room) }),
  updateRoomChecklist: (id: string, checklistCompleted: string[]) =>
    apiRequest<{ room: IndoorRoom }>(`/api/indoor/${id}/checklist`, {
      method: 'PATCH',
      body: JSON.stringify({ checklistCompleted }),
    }),
  deleteIndoorRoom: (id: string) => apiRequest<{ ok: boolean }>(`/api/indoor/${id}`, { method: 'DELETE' }),

  // Mobility & Sustainability
  compareMobility: (body: { distanceKm: number; currentAqi: number; currentPm25: number }) =>
    apiRequest<{
      distanceKm: number;
      currentAqi: number;
      currentPm25: number;
      options: MobilityOption[];
      methodology: string;
    }>('/api/mobility/compare', { method: 'POST', body: JSON.stringify(body) }),
  getSustainability: () =>
    apiRequest<{
      entries: SustainabilityEntry[];
      summary: {
        loggedActivities: number;
        totalAvoidedCo2Kg: number;
        totalGreenDistanceKm: number;
        equivalentTreeDays: number;
        note: string;
      };
    }>('/api/sustainability'),
  addSustainabilityEntry: (entry: Partial<SustainabilityEntry>) =>
    apiRequest<{ entry: SustainabilityEntry; summary: any }>('/api/sustainability', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),

  // Community
  getCommunityReports: (city?: string, category?: string) => {
    const p = new URLSearchParams();
    if (city) p.set('city', city);
    if (category) p.set('category', category);
    return apiRequest<{ reports: CommunityReport[]; analytics: any }>(`/api/community/reports?${p.toString()}`);
  },
  submitCommunityReport: (payload: any) =>
    apiRequest<{ report: CommunityReport }>('/api/community/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  upvoteCommunityReport: (id: string) =>
    apiRequest<{ report: CommunityReport }>(`/api/community/reports/${id}/upvote`, { method: 'POST' }),
  moderateCommunityReport: (id: string, status: 'verified' | 'flagged' | 'pending') =>
    apiRequest<{ report: CommunityReport }>(`/api/community/reports/${id}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Alerts, Reports & Settings
  getAlerts: (city: CityLocation, standard: AqiStandard) =>
    apiRequest<{ alerts: EnvironmentalAlert[] }>(`/api/alerts?${cityQuery(city, standard)}`),
  getReportSummary: (city: CityLocation, standard: AqiStandard, period: 'daily' | 'weekly' | 'monthly') =>
    apiRequest<any>(`/api/reports/summary?${cityQuery(city, standard)}&period=${period}`),
  updateSettings: (preferences: Partial<UserPreferences>) =>
    apiRequest<{ preferences: UserPreferences; user: UserAccountPublic }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    }),
};
