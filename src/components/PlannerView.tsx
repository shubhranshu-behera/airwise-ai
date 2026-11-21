import { Calendar, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { AqiStandard, CityLocation, CurrentEnvironmentData, ForecastBundle } from '../types';

interface PlannerViewProps {
  city: CityLocation;
  standard: AqiStandard;
  current: CurrentEnvironmentData | null;
  forecast: ForecastBundle | null;
  onAskAi: (prompt: string) => void;
}

export function PlannerView({ city, standard, current, forecast, onAskAi }: PlannerViewProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [plan, setPlan] = useState<{
    city: string;
    currentAqi: number;
    bestOutdoorWindow: string;
    schedule: Array<{ slot: string; mode: string; action: string }>;
  } | null>(null);
  const [completedSlots, setCompletedSlots] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api
      .getDailyPlan(city, standard)
      .then(setPlan)
      .catch(() => {});
  }, [city.id, city.lat, city.lng, standard]);

  const hourlyBars = (forecast?.forecast24h || []).slice(0, 18);

  // Build 3-day outlook summary from forecast72h
  const multiDayBlocks: Array<{ dayLabel: string; avgAqi: number; peakAqi: number; recommendation: string }> = [];
  if (forecast?.forecast72h && forecast.forecast72h.length >= 24) {
    for (let d = 0; d < 3; d++) {
      const slice = forecast.forecast72h.slice(d * 24, (d + 1) * 24);
      if (slice.length === 0) continue;
      const avg = Math.round(slice.reduce((s, p) => s + p.aqi, 0) / slice.length);
      const peak = Math.max(...slice.map((p) => p.aqi));
      const dayLabel = d === 0 ? 'Next 24 Hours' : d === 1 ? 'Day 2 Outlook' : 'Day 3 Outlook';
      const recommendation =
        avg <= 100
          ? 'Favorable for outdoor workouts, cycling commutes, and extended cross-ventilation.'
          : avg <= 200
            ? 'Schedule outdoor exercise in early afternoon; prefer transit or carpool during rush hour.'
            : 'Keep strenuous training indoors; run HEPA filtration and minimize prolonged outdoor exposure.';
      multiDayBlocks.push({ dayLabel, avgAqi: avg, peakAqi: peak, recommendation });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--aw-text)]">
            Personalized Pollution-Aware Planner
          </h2>
          <p className="text-xs text-[var(--aw-text-secondary)] mt-0.5">
            Routine windows aligned to live hourly AQI trajectory in {city.name}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--aw-surface)] border border-[var(--aw-border)]">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-[#00C9A7] text-[#05181C]'
                  : 'text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)]'
              }`}
            >
              Daily Schedule
            </button>
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                viewMode === 'weekly'
                  ? 'bg-[#00C9A7] text-[#05181C]'
                  : 'text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)]'
              }`}
            >
              Multi-Day Outlook
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              onAskAi(
                `Build a detailed pollution-aware daily schedule for ${city.name} including school drop-off, office commute, outdoor exercise, and indoor backup options.`,
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Customize via AI
          </button>
        </div>
      </div>

      {/* Best Window Banner */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-[#00C9A7] font-semibold">Optimal Clean-Air Activity Window</div>
          <div className="font-display text-lg font-bold text-[var(--aw-text)] font-mono-num">
            {plan?.bestOutdoorWindow || 'Calculating optimal window...'}
          </div>
        </div>
        <div className="text-xs text-[var(--aw-text-secondary)] max-w-md">
          Current ambient {standard === 'CPCB_NAQI' ? 'CPCB NAQI' : 'US AQI'}:{' '}
          <strong className="font-mono-num text-[var(--aw-text)]">{current?.aqi ?? '—'}</strong> (
          {current?.category.label ?? 'Loading'}). Click routine items below to track completion.
        </div>
      </div>

      {viewMode === 'daily' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Time-Slotted Daily Schedule */}
          <div className="lg:col-span-7 space-y-3">
            {(plan?.schedule || []).map((item) => {
              const done = Boolean(completedSlots[item.slot]);
              return (
                <div
                  key={item.slot}
                  onClick={() => setCompletedSlots((prev) => ({ ...prev, [item.slot]: !prev[item.slot] }))}
                  className={`rounded-xl border p-5 transition-colors cursor-pointer ${
                    done
                      ? 'border-[#00C9A7]/50 bg-[#00C9A7]/[0.06]'
                      : 'border-[var(--aw-border)] bg-[var(--aw-surface)] hover:border-[#39BDF8]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-[var(--aw-text-secondary)]">
                        <Clock className="w-3.5 h-3.5 text-[#39BDF8]" />
                        <span className="font-semibold text-[var(--aw-text)]">{item.slot}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#00C9A7]">{item.mode}</span>
                      </div>
                      <p className="text-sm text-[var(--aw-text-secondary)] leading-relaxed">{item.action}</p>
                    </div>
                    <CheckCircle2
                      className={`w-5 h-5 shrink-0 mt-0.5 ${done ? 'text-[#00C9A7]' : 'text-white/20'}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hourly Exposure Strip + Indoor Alternatives */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5 space-y-4">
              <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">
                Hourly Activity Readiness (Next 18h)
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {hourlyBars.map((pt) => {
                  const color =
                    pt.aqi <= 100 ? '#22C55E' : pt.aqi <= 200 ? '#F59E0B' : '#EF4444';
                  return (
                    <div key={pt.time} className="p-2 rounded-lg bg-[var(--aw-bg)] text-center space-y-1">
                      <div className="font-mono-num text-[11px] text-[var(--aw-text-secondary)]">
                        {pt.time.slice(11, 16)}
                      </div>
                      <div className="font-mono-num text-sm font-bold" style={{ color }}>
                        {pt.aqi}
                      </div>
                      <div className="text-[10px] text-[var(--aw-text-secondary)]">
                        {pt.aqi <= 100 ? 'Clear' : pt.aqi <= 200 ? 'Pace' : 'Indoor'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5 space-y-3">
              <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">
                High-AQI Indoor Alternatives
              </h3>
              <ul className="space-y-2.5 text-xs text-[var(--aw-text-secondary)] leading-relaxed">
                <li>• <strong className="text-[var(--aw-text)]">Cardio swap:</strong> Replace roadside jogging with 30-min indoor HIIT, skipping, or stationary cycling in a HEPA-filtered room.</li>
                <li>• <strong className="text-[var(--aw-text)]">School play swap:</strong> Move afternoon playground sessions to indoor gymnasiums or schedule shorter morning courtyard breaks when AQI dips.</li>
                <li>• <strong className="text-[var(--aw-text)]">Commute timing:</strong> Shift flexible errands away from 08:00–10:00 and 19:00–21:30 inversion peaks.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {multiDayBlocks.map((b) => (
            <div key={b.dayLabel} className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--aw-text)]">
                  <Calendar className="w-4 h-4 text-[#39BDF8]" />
                  {b.dayLabel}
                </span>
                <span className="font-mono-num text-xs text-[var(--aw-text-secondary)]">Peak {b.peakAqi}</span>
              </div>
              <div className="font-mono-num text-3xl font-bold text-[#00C9A7]">
                Avg AQI {b.avgAqi}
              </div>
              <p className="text-xs text-[var(--aw-text-secondary)] leading-relaxed">{b.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
