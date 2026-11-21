import {
  AlertTriangle,
  Compass,
  Droplets,
  Gauge,
  RefreshCw,
  Sparkles,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import type { CurrentEnvironmentData, EnvironmentalAlert, ForecastBundle, LanguageCode } from '../types';
import { AqiGauge } from './AqiGauge';

interface DashboardViewProps {
  current: CurrentEnvironmentData | null;
  forecast: ForecastBundle | null;
  alerts: EnvironmentalAlert[];
  language: LanguageCode;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
  onAskAi: (prompt: string) => void;
}

const WHO_LIMITS: Record<string, { label: string; unit: string; who24h: number }> = {
  pm25: { label: 'PM2.5', unit: 'µg/m³', who24h: 15 },
  pm10: { label: 'PM10', unit: 'µg/m³', who24h: 45 },
  no2: { label: 'NO₂', unit: 'µg/m³', who24h: 25 },
  so2: { label: 'SO₂', unit: 'µg/m³', who24h: 40 },
  co: { label: 'CO', unit: 'mg/m³', who24h: 4 },
  o3: { label: 'O₃', unit: 'µg/m³', who24h: 100 },
};

interface GeminiBrief {
  model: string;
  generatedAt: string;
  city: string;
  aqi: number;
  headline: string;
  outdoorVerdict: string;
  indoorAction: string;
  commuteAction: string;
  forecastNote: string;
}

export function DashboardView({
  current,
  forecast,
  alerts,
  language,
  loading,
  error,
  onRefresh,
  onNavigate,
  onAskAi,
}: DashboardViewProps) {
  const [geminiBrief, setGeminiBrief] = useState<GeminiBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // Reset brief when city/standard/language changes
  useEffect(() => {
    setGeminiBrief(null);
    setBriefError(null);
  }, [current?.location.id, current?.standard, language]);

  async function handleGenerateGeminiBrief() {
    if (!current || briefLoading) return;
    setBriefLoading(true);
    setBriefError(null);
    try {
      const res = await api.getGeminiQuickBrief({
        city: current.location,
        standard: current.standard,
        language,
      });
      setGeminiBrief(res);
    } catch (err: any) {
      setBriefError(err?.message || 'Unable to generate Gemini AI briefing.');
    } finally {
      setBriefLoading(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 backdrop-blur-md p-6 space-y-3">
        <div className="flex items-center gap-2 text-[#EF4444] font-semibold">
          <AlertTriangle className="w-5 h-5" />
          <span>Environmental Telemetry Unavailable</span>
        </div>
        <p className="text-sm text-[var(--aw-text-secondary)]">{error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="px-4 py-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] transition-colors cursor-pointer"
        >
          Retry Live Fetch
        </button>
      </div>
    );
  }

  if (loading || !current) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 h-72 rounded-xl bg-[var(--aw-surface)]/80 border border-[var(--aw-border)]" />
          <div className="lg:col-span-8 h-72 rounded-xl bg-[var(--aw-surface)]/80 border border-[var(--aw-border)]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-[var(--aw-surface)]/80 border border-[var(--aw-border)]" />
          ))}
        </div>
      </div>
    );
  }

  const chartData = forecast
    ? [...forecast.history.slice(-12), ...forecast.forecast24h.slice(0, 12)].map((pt) => ({
        time: pt.time.slice(11, 16),
        aqi: pt.aqi,
        pm25: pt.pm25,
        phase: pt.isForecast ? 'Forecast' : 'Observed',
      }))
    : [];

  const cleanest = forecast?.cleanestWindows?.[0];

  return (
    <div className="space-y-6">
      {/* Freshness & Attribution Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--aw-border)] text-xs text-[var(--aw-text-secondary)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-[var(--aw-text)]">
            {current.location.name}
            {current.location.region ? `, ${current.location.region}` : ''}
          </span>
          <span aria-hidden="true">·</span>
          <span>Source: {current.source}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">
            Observed {current.observedAt.replace('T', ' ')} (
            {current.freshnessMinutes === 0 ? 'Just updated' : `${current.freshnessMinutes}m ago`})
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#39BDF8] hover:text-[#00C9A7] transition-colors cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Feed
        </button>
      </div>

      {/* Top Row: AQI Gauge + 24h Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-4 rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)]/85 backdrop-blur-md p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[var(--aw-text)]">Ambient Air Quality</h2>
            <span className="font-mono-num text-xs text-[var(--aw-text-secondary)]">US AQI {current.usAqi}</span>
          </div>

          <AqiGauge
            aqi={current.aqi}
            standard={current.standard}
            category={current.category}
            dominantPollutant={current.dominantPollutant}
          />

          <p className="text-xs text-[var(--aw-text-secondary)] leading-relaxed pt-3 border-t border-[var(--aw-border)]">
            {current.category.advisory}
          </p>
        </div>

        <div className="lg:col-span-8 rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)]/85 backdrop-blur-md p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[var(--aw-text)]">
                24-Hour Observed &amp; Forecast Trajectory
              </h2>
              <p className="text-xs text-[var(--aw-text-secondary)]">
                Last 12 hours observed blended with next 12 hours predicted (
                {current.standard === 'CPCB_NAQI' ? 'CPCB NAQI' : 'US AQI'})
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('forecast')}
              className="text-xs font-medium text-[#00C9A7] hover:underline cursor-pointer whitespace-nowrap"
            >
              Open 72h Forecast
            </button>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C9A7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00C9A7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,178,197,0.14)" />
                <XAxis dataKey="time" stroke="#9CB2C5" tick={{ fontSize: 11 }} interval={2} />
                <YAxis stroke="#9CB2C5" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#102334',
                    border: '1px solid rgba(234,242,248,0.15)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#EAF2F8',
                  }}
                />
                <Area type="monotone" dataKey="aqi" name="AQI" stroke="#00C9A7" strokeWidth={2} fill="url(#aqiFill)" />
                <Area
                  type="monotone"
                  dataKey="pm25"
                  name="PM2.5 (µg/m³)"
                  stroke="#39BDF8"
                  strokeWidth={1.5}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Deployed Gemini AI Intelligence Brief Panel */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)]/85 backdrop-blur-md p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00C9A7]" />
            <div>
              <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">
                Live Gemini Environmental Intelligence Brief
              </h3>
              <p className="text-xs text-[var(--aw-text-secondary)]">
                Powered by server-side Gemini API (gemini-4-hydrogen) grounded in live {current.location.name} readings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateGeminiBrief}
              disabled={briefLoading}
              className="px-4 py-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              {briefLoading ? 'Analyzing with Gemini...' : geminiBrief ? 'Refresh Gemini Brief' : 'Generate Live Gemini Brief'}
            </button>
            <button
              type="button"
              onClick={() =>
                onAskAi(
                  `Give me a personalized clean-air action plan for ${current.location.name} today covering outdoor exercise, home ventilation, and commute.`,
                )
              }
              className="px-3.5 py-2 rounded-lg border border-[var(--aw-border)] text-xs font-medium text-[var(--aw-text)] hover:border-[#39BDF8] transition-colors cursor-pointer whitespace-nowrap"
            >
              Open Multi-Agent Chat
            </button>
          </div>
        </div>

        {briefError && (
          <div className="p-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs text-[#FCA5A5]">
            {briefError}
          </div>
        )}

        {geminiBrief ? (
          <div className="space-y-4 pt-2 border-t border-[var(--aw-border)]">
            <div className="font-display text-base font-semibold text-[#00C9A7]">{geminiBrief.headline}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-[var(--aw-bg)]/70 border border-[var(--aw-border)] space-y-1">
                <div className="font-semibold text-[var(--aw-text)]">Outdoor Verdict</div>
                <p className="text-[var(--aw-text-secondary)] leading-relaxed">{geminiBrief.outdoorVerdict}</p>
              </div>
              <div className="p-3.5 rounded-lg bg-[var(--aw-bg)]/70 border border-[var(--aw-border)] space-y-1">
                <div className="font-semibold text-[var(--aw-text)]">Indoor Air Action</div>
                <p className="text-[var(--aw-text-secondary)] leading-relaxed">{geminiBrief.indoorAction}</p>
              </div>
              <div className="p-3.5 rounded-lg bg-[var(--aw-bg)]/70 border border-[var(--aw-border)] space-y-1">
                <div className="font-semibold text-[var(--aw-text)]">Smart Commute</div>
                <p className="text-[var(--aw-text-secondary)] leading-relaxed">{geminiBrief.commuteAction}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--aw-text-secondary)]">
              <span>{geminiBrief.forecastNote}</span>
              <span className="font-mono-num">
                Model: {geminiBrief.model} · Generated {geminiBrief.generatedAt.slice(11, 16)} UTC
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--aw-border)] text-xs text-[var(--aw-text-secondary)]">
            <div>
              <span className="font-semibold text-[var(--aw-text)]">Best Outdoor Window (Next 24h): </span>
              <span className="font-mono-num text-[#00C9A7]">
                {cleanest ? `${cleanest.start} – ${cleanest.end} (Est. AQI ${cleanest.avgAqi})` : '13:00 – 15:00'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-[var(--aw-text)]">Dispersion Trend: </span>
              <span>
                {forecast
                  ? `${forecast.trendDirection} (${forecast.trendDeltaPct > 0 ? '+' : ''}${forecast.trendDeltaPct}%) · Inversion risk: ${forecast.winterSmogRisk.level}`
                  : 'Evaluating trend...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Pollutant Concentration Grid (6 Pollutants) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold text-[var(--aw-text)]">
            Pollutant Concentrations vs WHO 2021 24-Hour Guidelines
          </h3>
          <span className="text-xs text-[var(--aw-text-secondary)]">Measured / Copernicus CAMS Reanalysis</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {(Object.keys(WHO_LIMITS) as Array<keyof typeof current.pollutants>).map((key) => {
            const meta = WHO_LIMITS[key];
            const val = current.pollutants[key];
            const ratio = val !== null ? val / meta.who24h : 0;
            const barColor = ratio <= 1 ? '#22C55E' : ratio <= 2.5 ? '#F59E0B' : '#EF4444';
            const barWidth = Math.min(100, Math.round(ratio * 35));
            return (
              <div
                key={key}
                className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)]/85 backdrop-blur-md p-4 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-xs text-[var(--aw-text-secondary)]">
                  <span className="font-semibold text-[var(--aw-text)]">{meta.label}</span>
                  <span>WHO {meta.who24h}</span>
                </div>
                <div className="mt-3">
                  <div className="font-mono-num text-2xl font-bold text-[var(--aw-text)]">
                    {val !== null ? val : '—'}
                  </div>
                  <div className="text-[11px] text-[var(--aw-text-secondary)]">{meta.unit}</div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weather Conditions + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)]/85 backdrop-blur-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">Atmospheric Weather</h3>
            <span className="text-xs text-[#39BDF8]">{current.weather.weatherLabel}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--aw-text-secondary)]">
                <Thermometer className="w-3.5 h-3.5 text-[#39BDF8]" />
                <span>Temperature</span>
              </div>
              <div className="font-mono-num text-xl font-semibold text-[var(--aw-text)]">
                {current.weather.temperatureC !== null ? `${current.weather.temperatureC}°C` : '—'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--aw-text-secondary)]">
                <Droplets className="w-3.5 h-3.5 text-[#39BDF8]" />
                <span>Humidity</span>
              </div>
              <div className="font-mono-num text-xl font-semibold text-[var(--aw-text)]">
                {current.weather.humidityPct !== null ? `${current.weather.humidityPct}%` : '—'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--aw-text-secondary)]">
                <Wind className="w-3.5 h-3.5 text-[#00C9A7]" />
                <span>Wind Speed</span>
              </div>
              <div className="font-mono-num text-xl font-semibold text-[var(--aw-text)]">
                {current.weather.windSpeedKmh !== null ? `${current.weather.windSpeedKmh} km/h` : '—'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--aw-text-secondary)]">
                <Compass className="w-3.5 h-3.5 text-[#00C9A7]" />
                <span>Wind Direction</span>
              </div>
              <div className="font-mono-num text-xl font-semibold text-[var(--aw-text)]">
                {current.weather.windCardinal}{' '}
                {current.weather.windDirectionDeg !== null ? `${current.weather.windDirectionDeg}°` : ''}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--aw-border)] flex items-center justify-between text-xs text-[var(--aw-text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" /> Surface Pressure
            </span>
            <span className="font-mono-num text-[var(--aw-text)]">{current.weather.pressureHpa ?? '—'} hPa</span>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)]/85 backdrop-blur-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">Active Environmental Alerts</h3>
            <span className="font-mono-num text-xs text-[var(--aw-text-secondary)]">{alerts.length} active</span>
          </div>

          {alerts.length === 0 ? (
            <div className="py-6 text-center space-y-1">
              <p className="text-sm font-medium text-[#22C55E]">No threshold alerts triggered</p>
              <p className="text-xs text-[var(--aw-text-secondary)]">
                Current ambient AQI is below your configured alert threshold.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
              {alerts.slice(0, 4).map((alert) => {
                const color =
                  alert.severity === 'critical'
                    ? '#EF4444'
                    : alert.severity === 'warning'
                      ? '#F59E0B'
                      : '#39BDF8';
                return (
                  <div
                    key={alert.id}
                    className="pb-3 border-b border-[var(--aw-border)] last:border-b-0 last:pb-0 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold" style={{ color }}>
                        {alert.severity === 'critical'
                          ? 'Critical Alert'
                          : alert.severity === 'warning'
                            ? 'Advisory'
                            : 'Notice'}
                      </span>
                      <span className="font-mono-num text-[11px] text-[var(--aw-text-secondary)]">
                        {alert.createdAt.slice(11, 16)}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-[var(--aw-text)]">{alert.title}</div>
                    <p className="text-xs text-[var(--aw-text-secondary)] leading-relaxed">{alert.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
