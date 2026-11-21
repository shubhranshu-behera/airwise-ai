import { AlertCircle, RotateCcw, Sliders } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import type { AqiStandard, CityLocation, CurrentEnvironmentData, DigitalTwinScenarioInput } from '../types';

interface DigitalTwinViewProps {
  city: CityLocation;
  standard: AqiStandard;
  current: CurrentEnvironmentData | null;
}

const DEFAULT_SCENARIO: DigitalTwinScenarioInput = {
  trafficReductionPct: 25,
  publicTransitShiftPct: 20,
  greenCoverIncreasePct: 15,
  openBurningReductionPct: 50,
  windSpeedModifierPct: 0,
};

export function DigitalTwinView({ city, standard, current }: DigitalTwinViewProps) {
  const [scenario, setScenario] = useState<DigitalTwinScenarioInput>(DEFAULT_SCENARIO);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .runDigitalTwin(city, standard, scenario)
        .then((res) => {
          if (!cancelled) setResult(res);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [city.id, city.lat, city.lng, standard, scenario]);

  function applyPreset(name: 'clean_transit' | 'green_city' | 'stagnant_smog') {
    if (name === 'clean_transit') {
      setScenario({
        trafficReductionPct: 45,
        publicTransitShiftPct: 40,
        greenCoverIncreasePct: 15,
        openBurningReductionPct: 40,
        windSpeedModifierPct: 0,
      });
    } else if (name === 'green_city') {
      setScenario({
        trafficReductionPct: 35,
        publicTransitShiftPct: 35,
        greenCoverIncreasePct: 45,
        openBurningReductionPct: 80,
        windSpeedModifierPct: 10,
      });
    } else {
      setScenario({
        trafficReductionPct: 0,
        publicTransitShiftPct: 0,
        greenCoverIncreasePct: 0,
        openBurningReductionPct: 0,
        windSpeedModifierPct: -35,
      });
    }
  }

  const zones: Array<{ zoneName: string; zoneType: string; baselineAqi: number; simulatedAqi: number; delta: number }> =
    result?.zoneImpacts || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--aw-text)]">
            Smart City Pollution Digital Twin — {city.name}
          </h2>
          <p className="text-xs text-[var(--aw-text-secondary)] mt-0.5">
            Interactive what-if policy and meteorology dispersion sandbox anchored to live baseline
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyPreset('clean_transit')}
            className="px-3 py-1.5 rounded-lg border border-[var(--aw-border)] bg-[var(--aw-surface)] text-xs font-medium text-[var(--aw-text)] hover:border-[#00C9A7] cursor-pointer whitespace-nowrap"
          >
            Clean Transit Push
          </button>
          <button
            type="button"
            onClick={() => applyPreset('green_city')}
            className="px-3 py-1.5 rounded-lg border border-[var(--aw-border)] bg-[var(--aw-surface)] text-xs font-medium text-[var(--aw-text)] hover:border-[#22C55E] cursor-pointer whitespace-nowrap"
          >
            Full Green Corridor
          </button>
          <button
            type="button"
            onClick={() => applyPreset('stagnant_smog')}
            className="px-3 py-1.5 rounded-lg border border-[var(--aw-border)] bg-[var(--aw-surface)] text-xs font-medium text-[var(--aw-text)] hover:border-[#F59E0B] cursor-pointer whitespace-nowrap"
          >
            Low-Wind Inversion Test
          </button>
          <button
            type="button"
            onClick={() => setScenario(DEFAULT_SCENARIO)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Mandatory Simulation Disclosure Banner */}
      <div className="rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 p-4 flex items-start gap-3 text-xs text-[var(--aw-text)]">
        <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
        <span>
          <strong>Simulated Scenario Mode:</strong> Projected AQI and PM2.5 reductions below are illustrative digital
          twin simulations derived from source-apportionment sensitivity weights anchored to current live conditions —
          never real-time measured ambient values.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive What-If Controls */}
        <div className="lg:col-span-5 rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aw-text)]">
            <Sliders className="w-4 h-4 text-[#00C9A7]" />
            <span>Urban Intervention Controls</span>
          </div>

          {(
            [
              { key: 'trafficReductionPct', label: 'Private Traffic Reduction', min: 0, max: 70, unit: '%' },
              { key: 'publicTransitShiftPct', label: 'Public Transit & EV Adoption Shift', min: 0, max: 60, unit: '%' },
              { key: 'greenCoverIncreasePct', label: 'Urban Green Canopy Expansion', min: 0, max: 50, unit: '%' },
              { key: 'openBurningReductionPct', label: 'Open Waste Burning Elimination', min: 0, max: 90, unit: '%' },
              { key: 'windSpeedModifierPct', label: 'Meteorological Wind Dispersion Shift', min: -40, max: 40, unit: '%' },
            ] as const
          ).map((ctrl) => (
            <div key={ctrl.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="text-[var(--aw-text)] font-medium">{ctrl.label}</label>
                <span className="font-mono-num font-semibold text-[#00C9A7]">
                  {scenario[ctrl.key] > 0 && ctrl.min < 0 ? '+' : ''}
                  {scenario[ctrl.key]}
                  {ctrl.unit}
                </span>
              </div>
              <input
                type="range"
                min={ctrl.min}
                max={ctrl.max}
                step={5}
                value={scenario[ctrl.key]}
                onChange={(e) => setScenario((prev) => ({ ...prev, [ctrl.key]: Number(e.target.value) }))}
                className="w-full accent-[#00C9A7] cursor-pointer"
              />
            </div>
          ))}

          {result && (
            <div className="pt-4 border-t border-[var(--aw-border)] space-y-2 text-xs text-[var(--aw-text-secondary)]">
              <div className="font-semibold text-[var(--aw-text)]">Model Assumptions</div>
              {result.assumptions.map((a: string, i: number) => (
                <p key={i} className="leading-relaxed">
                  • {a}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Interactive 2D City Dispersion Twin + KPI Summary */}
        <div className="lg:col-span-7 space-y-6">
          {/* Baseline vs Simulated Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5">
              <div className="text-xs text-[var(--aw-text-secondary)]">Live Baseline AQI</div>
              <div className="font-mono-num text-3xl font-bold text-[var(--aw-text)] mt-1">
                {result?.baselineAqi ?? current?.aqi ?? '—'}
              </div>
              <div className="text-[11px] text-[var(--aw-text-secondary)] font-mono-num">
                PM2.5 {result?.baselinePm25 ?? current?.pollutants.pm25 ?? '—'} µg/m³
              </div>
            </div>

            <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5">
              <div className="text-xs text-[var(--aw-text-secondary)]">Simulated Scenario AQI</div>
              <div
                className="font-mono-num text-3xl font-bold mt-1"
                style={{ color: result?.simulatedCategory?.color || '#00C9A7' }}
              >
                {loading ? '...' : result?.simulatedAqi ?? '—'}
              </div>
              <div className="text-[11px] text-[var(--aw-text-secondary)] font-mono-num">
                PM2.5 {result?.simulatedPm25 ?? '—'} µg/m³ ({result?.aqiDelta > 0 ? '+' : ''}
                {result?.aqiDelta ?? 0} AQI)
              </div>
            </div>

            <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5">
              <div className="text-xs text-[var(--aw-text-secondary)]">PM2.5 Change (Simulated)</div>
              <div className="font-mono-num text-3xl font-bold text-[#00C9A7] mt-1">
                {result ? `${result.pm25ReductionPct > 0 ? '-' : '+'}${Math.abs(result.pm25ReductionPct)}%` : '—'}
              </div>
              <div className="text-[11px] text-[var(--aw-text-secondary)] font-mono-num">
                Est. {result?.estimatedAnnualCo2AvoidedTonsPer100k?.toLocaleString() ?? 0} t CO₂/yr per 100k commuters
              </div>
            </div>
          </div>

          {/* 2D Urban Grid Visualization */}
          <div className="rounded-xl border border-[var(--aw-border)] bg-[#0A1726] p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#9CB2C5]">
              <span className="font-semibold text-[#EAF2F8]">
                2D Urban Dispersion Twin · {city.name} Sector Grid (Simulated)
              </span>
              <span className="font-mono-num">
                Wind: {current?.weather.windSpeedKmh ?? '—'} km/h {current?.weather.windCardinal ?? ''} (
                {scenario.windSpeedModifierPct >= 0 ? '+' : ''}
                {scenario.windSpeedModifierPct}%)
              </span>
            </div>

            <svg viewBox="0 0 640 250" className="w-full h-56 rounded-lg bg-[#08131F] border border-white/10">
              {/* Road Grid */}
              <g stroke="rgba(156,178,197,0.12)" strokeWidth="1">
                <line x1="0" y1="80" x2="640" y2="80" />
                <line x1="0" y1="165" x2="640" y2="165" />
                <line x1="160" y1="0" x2="160" y2="250" />
                <line x1="320" y1="0" x2="320" y2="250" />
                <line x1="480" y1="0" x2="480" y2="250" />
              </g>

              {/* Green Canopy Buffer Overlay scaling with greenCoverIncreasePct */}
              <rect
                x="18"
                y="175"
                width={140 + scenario.greenCoverIncreasePct * 2.2}
                height="58"
                rx="8"
                fill="#22C55E"
                fillOpacity={0.12 + scenario.greenCoverIncreasePct / 220}
                stroke="#22C55E"
                strokeOpacity="0.45"
              />
              <text x="30" y="208" fill="#86EFAC" fontSize="11" fontFamily="DM Sans, sans-serif">
                Green Canopy Buffer (+{scenario.greenCoverIncreasePct}%)
              </text>

              {/* Transit Corridor Line */}
              <line
                x1="40"
                y1="122"
                x2="600"
                y2="122"
                stroke="#00C9A7"
                strokeWidth={2 + scenario.publicTransitShiftPct / 20}
                strokeDasharray="8 6"
                opacity="0.7"
              />

              {/* Sector Bubbles */}
              {zones.slice(0, 6).map((z, idx) => {
                const coords = [
                  { x: 110, y: 65 },
                  { x: 270, y: 58 },
                  { x: 430, y: 72 },
                  { x: 550, y: 62 },
                  { x: 350, y: 185 },
                  { x: 525, y: 185 },
                ][idx];
                const fill =
                  z.simulatedAqi <= 100 ? '#22C55E' : z.simulatedAqi <= 200 ? '#F59E0B' : '#EF4444';
                const radius = Math.max(22, Math.min(44, z.simulatedAqi / 6.5));
                return (
                  <g key={z.zoneName}>
                    <circle cx={coords.x} cy={coords.y} r={radius} fill={fill} fillOpacity="0.22" stroke={fill} strokeWidth="1.5" />
                    <text
                      x={coords.x}
                      y={coords.y - 2}
                      textAnchor="middle"
                      fill="#EAF2F8"
                      fontSize="13"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {z.simulatedAqi}
                    </text>
                    <text
                      x={coords.x}
                      y={coords.y + 13}
                      textAnchor="middle"
                      fill="#9CB2C5"
                      fontSize="9"
                      fontFamily="DM Sans, sans-serif"
                    >
                      {z.zoneName.slice(0, 16)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Zone Baseline vs Simulated Comparison Chart */}
          <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--aw-text)]">
              Neighborhood Scenario Comparison (Baseline vs Simulated AQI)
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zones} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,178,197,0.14)" />
                  <XAxis
                    dataKey="zoneName"
                    stroke="#9CB2C5"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => v.split(' ')[0]}
                  />
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
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="baselineAqi" name="Live Baseline AQI" fill="#39BDF8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="simulatedAqi" name="Simulated AQI" fill="#00C9A7" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
