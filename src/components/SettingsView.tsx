import { Check, Moon, Shield, Sparkles, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, setAuthToken } from '../lib/api';
import type { AqiStandard, CityLocation, LanguageCode, UserAccountPublic, UserPreferences } from '../types';
import type { WallpaperMode } from './DynamicWallpaper';

interface SettingsViewProps {
  cities: CityLocation[];
  selectedCity: CityLocation;
  onSelectCity: (c: CityLocation) => void;
  standard: AqiStandard;
  onChangeStandard: (s: AqiStandard) => void;
  language: LanguageCode;
  onChangeLanguage: (l: LanguageCode) => void;
  theme: 'dark' | 'light';
  onChangeTheme: (t: 'dark' | 'light') => void;
  wallpaperMode: WallpaperMode;
  onChangeWallpaperMode: (m: WallpaperMode) => void;
  user: UserAccountPublic | null;
  onUserUpdated: (u: UserAccountPublic) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export function SettingsView({
  cities,
  selectedCity,
  onSelectCity,
  standard,
  onChangeStandard,
  language,
  onChangeLanguage,
  theme,
  onChangeTheme,
  wallpaperMode,
  onChangeWallpaperMode,
  user,
  onUserUpdated,
  onOpenAuth,
}: SettingsViewProps) {
  const [threshold, setThreshold] = useState(user?.preferences.aqiAlertThreshold ?? 150);
  const [notifications, setNotifications] = useState(
    user?.preferences.notifications ?? {
      aqiSpikes: true,
      dailyBriefing: true,
      familyAlerts: true,
      communityUpdates: true,
    },
  );
  const [privacy, setPrivacy] = useState(
    user?.preferences.privacy ?? {
      storeChatHistory: true,
      approximateLocationOnly: true,
      shareAnonymousImpactStats: false,
    },
  );
  const [savedNotice, setSavedNotice] = useState(false);
  const [adminStatus, setAdminStatus] = useState<{ adminClaimed: boolean; envPasscodeConfigured: boolean } | null>(null);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  const [adminErr, setAdminErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAdminStatus()
      .then(setAdminStatus)
      .catch(() => {});
  }, []);

  async function handleSavePreferences() {
    if (!user) {
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
      return;
    }
    const payload: Partial<UserPreferences> = {
      defaultCityId: selectedCity.id,
      language,
      aqiStandard: standard,
      aqiAlertThreshold: threshold,
      theme,
      notifications,
      privacy,
    };
    const res = await api.updateSettings(payload);
    onUserUpdated(res.user);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  }

  async function handleClaimAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminErr(null);
    setAdminMsg(null);
    try {
      const res = await api.claimAdmin(adminPasscode);
      setAuthToken(res.token);
      onUserUpdated(res.user);
      setAdminPasscode('');
      setAdminMsg('Administrator permissions activated on your account.');
      api.getAdminStatus().then(setAdminStatus).catch(() => {});
    } catch (err: any) {
      setAdminErr(err?.message || 'Unable to activate admin role.');
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--aw-text)]">Settings &amp; Profile</h2>
        <p className="text-xs text-[var(--aw-text-secondary)] mt-0.5">
          Manage default location, AQI calculation standard, multilingual AI preference, alerts, privacy &amp; theme
        </p>
      </div>

      {/* Core Environmental & Appearance Settings */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-[var(--aw-text-secondary)] mb-1.5">Default City</label>
            <select
              value={selectedCity.id}
              onChange={(e) => {
                const match = cities.find((c) => c.id === e.target.value);
                if (match) onSelectCity(match);
              }}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}, {c.country}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--aw-text-secondary)] mb-1.5">
              AQI Calculation Standard
            </label>
            <select
              value={standard}
              onChange={(e) => onChangeStandard(e.target.value as AqiStandard)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            >
              <option value="CPCB_NAQI">Indian CPCB National AQI (NAQI)</option>
              <option value="US_AQI">US EPA AQI</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--aw-text-secondary)] mb-1.5">
              AI Assistant Language
            </label>
            <select
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            >
              <option value="en">English</option>
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="or">Odia (ଓଡ଼ିଆ)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--aw-text-secondary)] mb-1.5">Interface Theme</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeTheme('dark')}
                className={`inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                  theme === 'dark'
                    ? 'border-[#00C9A7] bg-[#00C9A7]/15 text-[#00C9A7]'
                    : 'border-[var(--aw-border)] bg-[var(--aw-bg)] text-[var(--aw-text-secondary)]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" /> Dark Command
              </button>
              <button
                type="button"
                onClick={() => onChangeTheme('light')}
                className={`inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                  theme === 'light'
                    ? 'border-[#00C9A7] bg-[#00C9A7]/15 text-[#00A88C]'
                    : 'border-[var(--aw-border)] bg-[var(--aw-bg)] text-[var(--aw-text-secondary)]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" /> Crisp Light
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--aw-text-secondary)] mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#39BDF8]" />
              Dynamic Environmental Background Wallpaper
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'aqi_flow', label: 'AQI Flow' },
                  { id: 'wind_field', label: 'Live Wind Field' },
                  { id: 'horizon', label: 'Smart-City Horizon' },
                  { id: 'minimal', label: 'Minimal Calm' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeWallpaperMode(m.id)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    wallpaperMode === m.id
                      ? 'border-[#00C9A7] bg-[#00C9A7]/15 text-[#00C9A7]'
                      : 'border-[var(--aw-border)] bg-[var(--aw-bg)] text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Alert Threshold Slider */}
        <div className="pt-4 border-t border-[var(--aw-border)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--aw-text)]">AQI Threshold Alert Trigger</span>
            <span className="font-mono-num font-bold text-[#F59E0B]">AQI ≥ {threshold}</span>
          </div>
          <input
            type="range"
            min={50}
            max={350}
            step={10}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full accent-[#00C9A7] cursor-pointer"
          />
        </div>

        {/* Notifications & Privacy Checkboxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--aw-border)]">
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[var(--aw-text)]">Notification Preferences</div>
            {(
              [
                ['aqiSpikes', 'Pollution spike & anomaly alerts'],
                ['dailyBriefing', 'Morning daily environmental briefing'],
                ['familyAlerts', 'Family age-group outdoor window alerts'],
                ['communityUpdates', 'Verified local neighborhood alerts'],
              ] as const
            ).map(([k, lbl]) => (
              <label key={k} className="flex items-center gap-2 text-xs text-[var(--aw-text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications[k]}
                  onChange={(e) => setNotifications((prev) => ({ ...prev, [k]: e.target.checked }))}
                  className="accent-[#00C9A7]"
                />
                <span>{lbl}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[var(--aw-text)]">Privacy &amp; Data Retention</div>
            {(
              [
                ['storeChatHistory', 'Retain AI conversation history for context'],
                ['approximateLocationOnly', 'Use ~1 km approximate grid for community reports'],
                ['shareAnonymousImpactStats', 'Include anonymized CO₂ savings in city totals'],
              ] as const
            ).map(([k, lbl]) => (
              <label key={k} className="flex items-center gap-2 text-xs text-[var(--aw-text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacy[k]}
                  onChange={(e) => setPrivacy((prev) => ({ ...prev, [k]: e.target.checked }))}
                  className="accent-[#00C9A7]"
                />
                <span>{lbl}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSavePreferences}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] cursor-pointer"
          >
            {savedNotice ? <Check className="w-4 h-4" /> : null}
            {savedNotice ? 'Preferences Saved' : 'Save Preferences'}
          </button>
          {!user && (
            <span className="text-xs text-[var(--aw-text-secondary)]">
              Sign in to persist preferences across sessions.
            </span>
          )}
        </div>
      </div>

      {/* Account & Role Management */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aw-text)]">
          <Shield className="w-4 h-4 text-[#39BDF8]" />
          <span>Account &amp; Role-Based Access Control</span>
        </div>

        {!user ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-[var(--aw-text-secondary)]">
              You are currently exploring as a guest. Create an account or sign in to save personal records and manage
              roles.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 rounded-lg border border-[var(--aw-border)] text-xs font-semibold text-[var(--aw-text)] cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold cursor-pointer"
              >
                Register Account
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[var(--aw-text-secondary)]">
              <span>
                Signed in as <strong className="text-[var(--aw-text)]">{user.name}</strong> ({user.email})
              </span>
              <span>
                Role: <strong className="text-[#00C9A7] capitalize">{user.role.replace('_', ' ')}</strong>
              </span>
            </div>

            {user.role !== 'admin' && adminStatus && (!adminStatus.adminClaimed || adminStatus.envPasscodeConfigured) && (
              <form
                onSubmit={handleClaimAdmin}
                className="pt-4 border-t border-[var(--aw-border)] space-y-3 max-w-md"
              >
                <div className="text-xs font-semibold text-[var(--aw-text)]">
                  {adminStatus.envPasscodeConfigured
                    ? 'Elevate to Administrator (Server Passcode)'
                    : 'First-Run Administrator Setup'}
                </div>
                <p className="text-xs text-[var(--aw-text-secondary)]">
                  {adminStatus.envPasscodeConfigured
                    ? 'Enter the configured server ADMIN_PASSCODE to grant administrator permissions.'
                    : 'No administrator has been claimed yet. Confirm your account password to become the initial platform administrator.'}
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    required
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder={adminStatus.envPasscodeConfigured ? 'Server admin passcode' : 'Confirm your account password'}
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-xs text-[var(--aw-text)]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#39BDF8] text-[#05181C] text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Activate Admin
                  </button>
                </div>
                {adminErr && <p className="text-xs text-[#FCA5A5]">{adminErr}</p>}
                {adminMsg && <p className="text-xs text-[#86EFAC]">{adminMsg}</p>}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
