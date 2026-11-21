import { Bike, Check, Navigation, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CurrentEnvironmentData, MobilityOption } from '../types';

interface MobilityViewProps {
  current: CurrentEnvironmentData | null;
  onTripLogged: () => void;
}

export function MobilityView({ current, onTripLogged }: MobilityViewProps) {
  const [origin, setOrigin] = useState('Home Sector');
  const [destination, setDestination] = useState('Central Business District');
  const [distanceKm, setDistanceKm] = useState(11);
  const [options, setOptions] = useState<MobilityOption[]>([]);
  const [methodology, setMethodology] = useState('');
  const [loggedMode, setLoggedMode] = useState<string | null>(null);

  const aqi = current?.aqi ?? 120;
  const pm25 = current?.pollutants.pm25 ?? 45;

  async function runComparison(dist: number) {
    const res = await api.compareMobility({ distanceKm: dist, currentAqi: aqi, currentPm25: pm25 });
    setOptions(res.options);
    setMethodology(res.methodology);
  }

  useEffect(() => {
    runComparison(distanceKm).catch(() => {});
  }, [aqi, pm25]);

  async function handleLogTrip(opt: MobilityOption) {
    if (opt.mode === 'petrol_car') return;
    const typeMap: Record<string, any> = {
      metro_rail: 'transit_commute',
      electric_bus: 'transit_commute',
      ev_car: 'ev_trip',
      carpool: 'carpool',
      cycling: 'cycling',
      walking: 'walking',
    };
    await api.addSustainabilityEntry({
      activityType: typeMap[opt.mode] || 'transit_commute',
      label: `${opt.label}: ${origin} → ${destination}`,
      distanceKm: opt.distanceKm,
      notes: `Logged from Smart Mobility Planner (${current?.location.name || 'City'})`,
    });
    setLoggedMode(opt.mode);
    onTripLogged();
    setTimeout(() => setLoggedMode(null), 2500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--aw-text)]">Smart Mobility Planner</h2>
        <p className="text-xs text-[var(--aw-text-secondary)] mt-0.5">
          Compare travel time, tailpipe CO₂ emissions, and estimated inhaled PM2.5 dose under live{' '}
          {current?.location.name ?? 'city'} air conditions
        </p>
      </div>

      {/* Route Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runComparison(distanceKm);
        }}
        className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
      >
        <div className="md:col-span-4">
          <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Origin</label>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
          />
        </div>
        <div className="md:col-span-4">
          <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Destination</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Distance (km)</label>
          <input
            type="number"
            min={1}
            max={120}
            step={0.5}
            value={distanceKm}
            onChange={(e) => setDistanceKm(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm font-mono-num text-[var(--aw-text)]"
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] transition-colors cursor-pointer whitespace-nowrap"
          >
            Compare Modes
          </button>
        </div>
      </form>

      {/* Comparison Matrix Table */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--aw-border)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[#00C9A7]" />
            <h3 className="font-display text-sm font-semibold text-[var(--aw-text)]">
              Mode Comparison ({distanceKm} km · Ambient AQI {aqi} · PM2.5 {pm25} µg/m³)
            </h3>
          </div>
          <span className="text-xs text-[var(--aw-text-secondary)]">Sorted by balanced exposure &amp; emissions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[var(--aw-border)] text-xs text-[var(--aw-text-secondary)]">
                <th className="px-6 py-3 font-medium">Transport Mode</th>
                <th className="px-4 py-3 font-medium text-right">Est. Time</th>
                <th className="px-4 py-3 font-medium text-right">CO₂ Emissions</th>
                <th className="px-4 py-3 font-medium text-right">Inhaled PM2.5</th>
                <th className="px-4 py-3 font-medium text-right">Exposure Index</th>
                <th className="px-4 py-3 font-medium">Trade-off Summary</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {options.map((opt) => {
                const expColor =
                  opt.relativeExposureScore <= 35
                    ? '#22C55E'
                    : opt.relativeExposureScore <= 65
                      ? '#F59E0B'
                      : '#EF4444';
                return (
                  <tr
                    key={opt.mode}
                    className={`border-b border-[var(--aw-border)] last:border-b-0 ${
                      opt.recommended ? 'bg-[#00C9A7]/[0.06]' : ''
                    }`}
                  >
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-[var(--aw-text)]">{opt.label}</div>
                      <div className="text-[11px] text-[var(--aw-text-secondary)] font-mono-num">
                        {opt.emissionFactorGPerKm} g CO₂/km {opt.recommended ? '· Recommended' : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-[var(--aw-text)]">
                      {opt.travelTimeMin} min
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-[var(--aw-text)]">
                      {opt.co2Grams === 0 ? '0 g' : `${opt.co2Grams} g`}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-[#39BDF8]">
                      {opt.estimatedInhaledPm25Ug} µg
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num font-semibold" style={{ color: expColor }}>
                      {opt.relativeExposureScore}/100
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--aw-text-secondary)] max-w-xs">
                      {opt.tradeoffSummary}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {opt.mode !== 'petrol_car' ? (
                        <button
                          type="button"
                          onClick={() => handleLogTrip(opt)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[var(--aw-border)] hover:border-[#00C9A7] text-xs font-medium text-[var(--aw-text)] cursor-pointer whitespace-nowrap"
                        >
                          {loggedMode === opt.mode ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#00C9A7]" />
                              Logged
                            </>
                          ) : (
                            'Log Green Trip'
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--aw-text-secondary)]">Baseline</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* EV Charging & Transparent Formula Attribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aw-text)]">
            <Zap className="w-4 h-4 text-[#00C9A7]" />
            <span>EV &amp; Clean Transit Infrastructure Notes</span>
          </div>
          <p className="text-xs text-[var(--aw-text-secondary)] leading-relaxed">
            For EV commutes in {current?.location.name || 'urban hubs'}, pre-condition cabin air while charging and
            engage cabin air recirculation with a PM2.5 cabin filter along high-NO₂ ring roads. Public fast-charging
            corridors are concentrated around metro park-and-ride hubs and commercial districts.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aw-text)]">
            <Bike className="w-4 h-4 text-[#39BDF8]" />
            <span>Calculation Transparency</span>
          </div>
          <p className="text-xs text-[var(--aw-text-secondary)] leading-relaxed">
            {methodology} Personal exposure reduction improves individual inhaled dose but is tracked separately from
            citywide ambient pollution changes.
          </p>
        </div>
      </div>
    </div>
  );
}
