import {
  Activity,
  BarChart3,
  Bot,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Compass,
  Cpu,
  FileBarChart,
  Globe,
  Home,
  LayoutDashboard,
  Leaf,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Navigation,
  Settings,
  Shield,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AssistantView } from './components/AssistantView';
import { AuthPage } from './components/AuthPage';
import { CommunityHubView } from './components/CommunityHubView';
import { DashboardView } from './components/DashboardView';
import { DigitalTwinView } from './components/DigitalTwinView';
import { DynamicWallpaper, type WallpaperMode } from './components/DynamicWallpaper';
import { FamilySafetyView } from './components/FamilySafetyView';
import { ForecastView } from './components/ForecastView';
import { IndoorAirView } from './components/IndoorAirView';
import { LandingPage } from './components/LandingPage';
import { LiveMapView } from './components/LiveMapView';
import { MobilityView } from './components/MobilityView';
import { PlannerView } from './components/PlannerView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { SustainabilityView } from './components/SustainabilityView';
import { api, setAuthToken } from './lib/api';
import type {
  AqiStandard,
  CityLocation,
  CurrentEnvironmentData,
  EnvironmentalAlert,
  ForecastBundle,
  LanguageCode,
  UserAccountPublic,
} from './types';

type TabId =
  | 'dashboard'
  | 'map'
  | 'forecast'
  | 'assistant'
  | 'planner'
  | 'indoor'
  | 'family'
  | 'mobility'
  | 'sustainability'
  | 'community'
  | 'digital-twin'
  | 'reports'
  | 'settings'
  | 'overview'
  | 'signin'
  | 'signup';

const NAV_GROUPS: Array<{
  heading: string;
  items: Array<{ id: TabId; label: string; icon: any }>;
}> = [
  {
    heading: 'Intelligence',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'map', label: 'Live Air Map', icon: Compass },
      { id: 'forecast', label: 'AQI Forecast', icon: Activity },
      { id: 'assistant', label: 'Gemini AI Chat', icon: Bot },
    ],
  },
  {
    heading: 'Daily Protection',
    items: [
      { id: 'planner', label: 'Daily Planner', icon: Calendar },
      { id: 'indoor', label: 'Indoor Air', icon: Home },
      { id: 'family', label: 'Family Safety', icon: Shield },
      { id: 'mobility', label: 'Smart Mobility', icon: Navigation },
    ],
  },
  {
    heading: 'Smart City & Impact',
    items: [
      { id: 'sustainability', label: 'Sustainability', icon: Leaf },
      { id: 'community', label: 'Community Hub', icon: Users },
      { id: 'digital-twin', label: 'Digital Twin', icon: Cpu },
      { id: 'reports', label: 'Reports', icon: FileBarChart },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    heading: 'Platform & Account',
    items: [
      { id: 'overview', label: 'Platform Overview', icon: Globe },
      { id: 'signin', label: 'Sign In', icon: LogIn },
      { id: 'signup', label: 'Sign Up', icon: UserPlus },
    ],
  },
];

const WALLPAPER_OPTIONS: Array<{ id: WallpaperMode; label: string }> = [
  { id: 'aqi_flow', label: 'AQI Atmospheric Flow' },
  { id: 'wind_field', label: 'Live Wind Field' },
  { id: 'horizon', label: 'Smart-City Horizon' },
  { id: 'minimal', label: 'Minimal Calm' },
];

const FALLBACK_CITY: CityLocation = {
  id: 'new-delhi',
  name: 'New Delhi',
  region: 'Delhi NCR',
  country: 'India',
  lat: 28.6139,
  lng: 77.209,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [floatingAiOpen, setFloatingAiOpen] = useState(false);

  const [cities, setCities] = useState<CityLocation[]>([FALLBACK_CITY]);
  const [selectedCity, setSelectedCity] = useState<CityLocation>(FALLBACK_CITY);
  const [standard, setStandard] = useState<AqiStandard>('CPCB_NAQI');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [wallpaperMode, setWallpaperMode] = useState<WallpaperMode>('aqi_flow');

  const [currentEnv, setCurrentEnv] = useState<CurrentEnvironmentData | null>(null);
  const [forecast, setForecast] = useState<ForecastBundle | null>(null);
  const [alerts, setAlerts] = useState<EnvironmentalAlert[]>([]);
  const [envLoading, setEnvLoading] = useState(true);
  const [envError, setEnvError] = useState<string | null>(null);

  const [user, setUser] = useState<UserAccountPublic | null>(null);
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);
  const [sustainabilityTick, setSustainabilityTick] = useState(0);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Load preset cities once
  useEffect(() => {
    api
      .getCities()
      .then((res) => {
        if (res.cities.length > 0) setCities(res.cities);
      })
      .catch(() => {});
  }, []);

  // Load live environmental telemetry, forecast & alerts for selected city
  const loadEnvironment = useCallback(async () => {
    setEnvLoading(true);
    setEnvError(null);
    try {
      const [cur, fc, al] = await Promise.all([
        api.getCurrentEnv(selectedCity, standard),
        api.getForecast(selectedCity, standard),
        api.getAlerts(selectedCity, standard),
      ]);
      setCurrentEnv(cur);
      setForecast(fc);
      setAlerts(al.alerts);
    } catch (err: any) {
      setEnvError(err?.message || 'Unable to load live atmospheric data.');
    } finally {
      setEnvLoading(false);
    }
  }, [selectedCity, standard]);

  useEffect(() => {
    loadEnvironment();
  }, [loadEnvironment]);

  function handleAskAi(prompt: string) {
    setPendingAiPrompt(prompt);
    setActiveTab('assistant');
    setFloatingAiOpen(false);
  }

  function handleAuthSuccess(u: UserAccountPublic) {
    setUser(u);
    setLanguage(u.preferences.language);
    setStandard(u.preferences.aqiStandard);
    setTheme(u.preferences.theme);
    const prefCity = cities.find((c) => c.id === u.preferences.defaultCityId);
    if (prefCity) setSelectedCity(prefCity);
    setActiveTab('dashboard');
  }

  async function handleLogout() {
    await api.logout().catch(() => {});
    setAuthToken(null);
    setUser(null);
  }

  const activeNavMeta = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeTab);

  return (
    <div className="relative min-h-screen text-[var(--aw-text)] flex">
      {/* Advanced Dynamic Environmental Background Wallpaper */}
      <DynamicWallpaper current={currentEnv} theme={theme} mode={wallpaperMode} />

      {/* Persistent Collapsible Left-Side Navigation Bar */}
      <aside
        className={`relative z-20 hidden lg:flex lg:flex-col shrink-0 border-r border-[var(--aw-border)] bg-[var(--aw-bg-secondary)]/85 backdrop-blur-xl transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[74px]' : 'w-64'
        }`}
      >
        <div className="h-16 px-4 border-b border-[var(--aw-border)] flex items-center justify-between gap-2">
          {!sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="font-display text-lg font-bold tracking-tight text-[var(--aw-text)] hover:text-[#00C9A7] transition-colors cursor-pointer whitespace-nowrap truncate"
            >
              AIRWISE AI
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              title="AIRWISE AI"
              className="font-display text-base font-extrabold text-[#00C9A7] mx-auto cursor-pointer"
            >
              AW
            </button>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand left navbar' : 'Collapse left navbar'}
            className="p-1.5 rounded-lg text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)] hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Live City AQI Micro-Summary inside Left Navbar */}
        {!sidebarCollapsed && currentEnv && (
          <div className="mx-3 mt-3 px-3.5 py-2.5 rounded-lg bg-[var(--aw-surface)]/80 border border-[var(--aw-border)] flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[11px] text-[var(--aw-text-secondary)] truncate">{currentEnv.location.name}</div>
              <div className="text-xs font-semibold truncate" style={{ color: currentEnv.category.color }}>
                {currentEnv.category.label}
              </div>
            </div>
            <div className="font-mono-num text-xl font-bold shrink-0" style={{ color: currentEnv.category.color }}>
              {currentEnv.aqi}
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5" aria-label="Left sidebar navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-3 text-[11px] font-semibold text-[var(--aw-text-secondary)]">
                  {group.heading}
                </div>
              )}
              {group.items.map((item) => {
                // Hide Sign In / Sign Up links when already authenticated
                if (user && (item.id === 'signin' || item.id === 'signup')) return null;
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={sidebarCollapsed ? item.label : undefined}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center ${
                      sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                    } py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#00C9A7]/18 text-[#00C9A7]'
                        : 'text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)] hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Left Navbar Account Footer */}
        <div className="p-3 border-t border-[var(--aw-border)]">
          {user ? (
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between gap-2'}`}>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--aw-text)] truncate">{user.name}</div>
                  <div className="text-[11px] text-[var(--aw-text-secondary)] capitalize truncate">
                    {user.role.replace('_', ' ')}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="p-2 rounded-lg text-[var(--aw-text-secondary)] hover:text-[#EF4444] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('signin')}
              title="Sign In / Sign Up"
              className="w-full py-2 px-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] transition-colors cursor-pointer whitespace-nowrap truncate"
            >
              {sidebarCollapsed ? <LogIn className="w-4 h-4 mx-auto" /> : 'Sign In / Sign Up'}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Left Navbar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/65 backdrop-blur-xs" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative z-10 w-64 max-w-[82vw] bg-[var(--aw-bg-secondary)] border-r border-[var(--aw-border)] flex flex-col h-full">
            <div className="h-14 px-4 border-b border-[var(--aw-border)] flex items-center justify-between">
              <span className="font-display text-base font-bold text-[var(--aw-text)]">AIRWISE AI</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                className="p-1.5 text-[var(--aw-text-secondary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.heading} className="space-y-1">
                  <div className="px-3 text-[11px] font-semibold text-[var(--aw-text-secondary)]">
                    {group.heading}
                  </div>
                  {group.items.map((item) => {
                    if (user && (item.id === 'signin' || item.id === 'signup')) return null;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileNavOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
                          activeTab === item.id
                            ? 'bg-[#00C9A7]/15 text-[#00C9A7]'
                            : 'text-[var(--aw-text-secondary)]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Contextual Workspace Header */}
        <header className="sticky top-0 z-20 h-16 px-4 sm:px-6 border-b border-[var(--aw-border)] bg-[var(--aw-bg)]/75 backdrop-blur-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open left menu"
              className="lg:hidden p-2 rounded-lg text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)]"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-[var(--aw-text-secondary)] whitespace-nowrap">AIRWISE</span>
              <span className="hidden sm:inline text-[var(--aw-text-secondary)]">/</span>
              <span className="font-display font-semibold text-[var(--aw-text)] truncate">
                {activeNavMeta?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          {/* Right Controls: City Selector, Wallpaper Mode, AQI Standard */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--aw-surface)]/85 border border-[var(--aw-border)]">
              <MapPin className="w-3.5 h-3.5 text-[#00C9A7] shrink-0" />
              <select
                aria-label="Select city"
                value={cities.some((c) => c.id === selectedCity.id) ? selectedCity.id : 'custom'}
                onChange={(e) => {
                  const found = cities.find((c) => c.id === e.target.value);
                  if (found) setSelectedCity(found);
                }}
                className="bg-transparent text-xs font-medium text-[var(--aw-text)] focus:outline-none cursor-pointer max-w-[125px] sm:max-w-[155px]"
              >
                {!cities.some((c) => c.id === selectedCity.id) && (
                  <option value="custom" className="bg-[#102334] text-[#EAF2F8]">
                    {selectedCity.name}
                  </option>
                )}
                {cities.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#102334] text-[#EAF2F8]">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--aw-surface)]/85 border border-[var(--aw-border)]">
              <Sparkles className="w-3.5 h-3.5 text-[#39BDF8] shrink-0" />
              <select
                aria-label="Dynamic wallpaper mode"
                value={wallpaperMode}
                onChange={(e) => setWallpaperMode(e.target.value as WallpaperMode)}
                className="bg-transparent text-xs font-medium text-[var(--aw-text)] focus:outline-none cursor-pointer"
              >
                {WALLPAPER_OPTIONS.map((w) => (
                  <option key={w.id} value={w.id} className="bg-[#102334] text-[#EAF2F8]">
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setStandard((s) => (s === 'CPCB_NAQI' ? 'US_AQI' : 'CPCB_NAQI'))}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--aw-border)] bg-[var(--aw-surface)]/85 text-xs font-mono-num text-[var(--aw-text)] hover:border-[#39BDF8] transition-colors cursor-pointer whitespace-nowrap"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#39BDF8]" />
              {standard === 'CPCB_NAQI' ? 'CPCB NAQI' : 'US AQI'}
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              current={currentEnv}
              forecast={forecast}
              alerts={alerts}
              language={language}
              loading={envLoading}
              error={envError}
              onRefresh={loadEnvironment}
              onNavigate={(tab) => setActiveTab(tab as TabId)}
              onAskAi={handleAskAi}
            />
          )}

          {activeTab === 'map' && (
            <LiveMapView
              city={selectedCity}
              standard={standard}
              current={currentEnv}
              onSelectCity={(loc) => setSelectedCity(loc)}
              onAskAi={handleAskAi}
            />
          )}

          {activeTab === 'forecast' && <ForecastView forecast={forecast} loading={envLoading} />}

          {activeTab === 'assistant' && (
            <AssistantView
              city={selectedCity}
              standard={standard}
              language={language}
              onChangeLanguage={setLanguage}
              pendingPrompt={pendingAiPrompt}
              onConsumePendingPrompt={() => setPendingAiPrompt(null)}
            />
          )}

          {activeTab === 'planner' && (
            <PlannerView
              city={selectedCity}
              standard={standard}
              current={currentEnv}
              forecast={forecast}
              onAskAi={handleAskAi}
            />
          )}

          {activeTab === 'indoor' && <IndoorAirView current={currentEnv} />}

          {activeTab === 'family' && <FamilySafetyView current={currentEnv} onAskAi={handleAskAi} />}

          {activeTab === 'mobility' && (
            <MobilityView
              current={currentEnv}
              onTripLogged={() => setSustainabilityTick((t) => t + 1)}
            />
          )}

          {activeTab === 'sustainability' && <SustainabilityView refreshTick={sustainabilityTick} />}

          {activeTab === 'community' && <CommunityHubView city={selectedCity} user={user} />}

          {activeTab === 'digital-twin' && (
            <DigitalTwinView city={selectedCity} standard={standard} current={currentEnv} />
          )}

          {activeTab === 'reports' && (
            <ReportsView city={selectedCity} standard={standard} forecast={forecast} />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              cities={cities}
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
              standard={standard}
              onChangeStandard={setStandard}
              language={language}
              onChangeLanguage={setLanguage}
              theme={theme}
              onChangeTheme={setTheme}
              wallpaperMode={wallpaperMode}
              onChangeWallpaperMode={setWallpaperMode}
              user={user}
              onUserUpdated={setUser}
              onOpenAuth={(mode) => setActiveTab(mode === 'register' ? 'signup' : 'signin')}
            />
          )}

          {activeTab === 'overview' && (
            <div className="-m-4 sm:-m-6 lg:-m-8">
              <LandingPage
                livePreview={currentEnv}
                onEnterPlatform={() => setActiveTab('dashboard')}
                onOpenAuth={(mode) => setActiveTab(mode === 'register' ? 'signup' : 'signin')}
              />
            </div>
          )}

          {(activeTab === 'signin' || activeTab === 'signup') && (
            <AuthPage
              key={activeTab}
              initialMode={activeTab === 'signup' ? 'register' : 'login'}
              currentEnv={currentEnv}
              onSuccess={handleAuthSuccess}
              onContinueGuest={() => setActiveTab('dashboard')}
            />
          )}
        </main>
      </div>

      {/* Floating Multi-Agent Gemini AI Companion Button & Drawer */}
      {activeTab !== 'assistant' && activeTab !== 'signin' && activeTab !== 'signup' && (
        <div className="fixed bottom-5 right-5 z-40">
          {floatingAiOpen ? (
            <div className="w-[380px] sm:w-[440px] max-w-[calc(100vw-2rem)] shadow-2xl rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-[#102334] border-x border-t border-white/15 text-xs text-[#EAF2F8]">
                <span className="font-semibold">Gemini AI Companion</span>
                <button
                  type="button"
                  onClick={() => setFloatingAiOpen(false)}
                  aria-label="Close AI drawer"
                  className="p-1 text-[#9CB2C5] hover:text-[#EAF2F8] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <AssistantView
                city={selectedCity}
                standard={standard}
                language={language}
                onChangeLanguage={setLanguage}
                compact
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFloatingAiOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#00C9A7] text-[#05181C] font-semibold text-xs shadow-lg hover:bg-[#19DDBB] transition-transform hover:scale-[1.02] cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ask Gemini AI</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
