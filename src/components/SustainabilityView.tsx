import { Award, Leaf, Plus, Sprout } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import type { SustainabilityEntry } from '../types';

interface SustainabilityViewProps {
  refreshTick: number;
}

const ECO_CHALLENGES = [
  { id: 'ch-1', title: 'Transit Week Challenge', target: 'Log 3 public transit or metro commutes', goalKg: 6 },
  { id: 'ch-2', title: 'Zero-Idle Commute', target: 'Avoid 15 kg CO₂ via cycling, walking, or carpool', goalKg: 15 },
  { id: 'ch-3', title: 'Clean-Air Neighborhood Champion', target: 'Avoid 30 kg cumulative transport CO₂', goalKg: 30 },
];

export function SustainabilityView({ refreshTick }: SustainabilityViewProps) {
  const [entries, setEntries] = useState<SustainabilityEntry[]>([]);
  const [summary, setSummary] = useState({
    loggedActivities: 0,
    totalAvoidedCo2Kg: 0,
    totalGreenDistanceKm: 0,
    equivalentTreeDays: 0,
    note: '',
  });
  const [activityType, setActivityType] = useState<SustainabilityEntry['activityType']>('transit_commute');
  const [label, setLabel] = useState('');
  const [distanceKm, setDistanceKm] = useState(12);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    const res = await api.getSustainability();
    setEntries(res.entries);
    setSummary(res.summary);
  }

  useEffect(() => {
    loadData().catch(() => {});
  }, [refreshTick]);

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.addSustainabilityEntry({
        activityType,
        label: label.trim() || `${activityType.replace('_', ' ')} journey`,
        distanceKm,
      });
      setLabel('');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  const chartData = [...entries]
    .slice(0, 10)
    .reverse()
    .map((e) => ({
      date: e.date.slice(5),
      co2Kg: e.avoidedCo2Kg,
      label: e.label,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--aw-text)]">Sustainability &amp; Green Impact</h2>
        <p className="text-xs text-[var(--aw-text-secondary)] mt-0.5">
          Track avoided transport emissions, eco-challenges, and clean-air community goals
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5">
          <div className="text-xs text-[var(--aw-text-secondary)]">Estimated CO₂ Avoided</div>
          <div className="font-mono-num text-3xl font-bold text-[#00C9A7] mt-1">
            {summary.totalAvoidedCo2Kg} <span className="text-sm font-normal">kg</span>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5">
          <div className="text-xs text-[var(--aw-text-secondary)]">Green Distance Logged</div>
          <div className="font-mono-num text-3xl font-bold text-[#39BDF8] mt-1">
            {summary.totalGreenDistanceKm} <span className="text-sm font-normal">km</span>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5">
          <div className="text-xs text-[var(--aw-text-secondary)]">Logged Eco Actions</div>
          <div className="font-mono-num text-3xl font-bold text-[var(--aw-text)] mt-1">
            {summary.loggedActivities}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5">
          <div className="text-xs text-[var(--aw-text-secondary)]">Mature Tree Absorption Eq.</div>
          <div className="font-mono-num text-3xl font-bold text-[#22C55E] mt-1">
            {summary.equivalentTreeDays} <span className="text-sm font-normal">tree-days</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Avoided CO2 Chart + Log Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">
              Avoided Emissions by Logged Activity (kg CO₂)
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,178,197,0.14)" />
                  <XAxis dataKey="date" stroke="#9CB2C5" tick={{ fontSize: 11 }} />
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
                  <Bar dataKey="co2Kg" name="Avoided CO₂ (kg)" fill="#00C9A7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <form
            onSubmit={handleLog}
            className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aw-text)]">
              <Plus className="w-4 h-4 text-[#00C9A7]" />
              <span>Log Sustainable Activity</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Activity Type</label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as SustainabilityEntry['activityType'])}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
                >
                  <option value="transit_commute">Metro / Electric Bus</option>
                  <option value="cycling">Cycling</option>
                  <option value="walking">Walking</option>
                  <option value="carpool">Carpool</option>
                  <option value="ev_trip">Electric Vehicle</option>
                  <option value="energy_saving">Home Energy Conservation</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Description</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Metro to tech park"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Distance (km)</label>
                <input
                  type="number"
                  min={0.5}
                  max={200}
                  step={0.5}
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm font-mono-num text-[var(--aw-text)]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Record Green Impact'}
            </button>
          </form>
        </div>

        {/* Eco Challenges & Recent Log */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aw-text)]">
              <Award className="w-4 h-4 text-[#F59E0B]" />
              <span>Eco Challenges &amp; Milestones</span>
            </div>
            <div className="space-y-4">
              {ECO_CHALLENGES.map((ch) => {
                const pct = Math.min(100, Math.round((summary.totalAvoidedCo2Kg / ch.goalKg) * 100));
                return (
                  <div key={ch.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--aw-text)]">{ch.title}</span>
                      <span className="font-mono-num text-[#00C9A7]">{pct}%</span>
                    </div>
                    <p className="text-xs text-[var(--aw-text-secondary)]">{ch.target}</p>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#00C9A7] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--aw-text)]">
              <Leaf className="w-4 h-4 text-[#22C55E]" />
              <span>Recent Sustainable Entries</span>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {entries.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between pb-2.5 border-b border-[var(--aw-border)] last:border-b-0 last:pb-0 text-xs"
                >
                  <div>
                    <div className="font-medium text-[var(--aw-text)]">{item.label}</div>
                    <div className="text-[var(--aw-text-secondary)] font-mono-num">
                      {item.date} {item.distanceKm ? `· ${item.distanceKm} km` : ''}
                    </div>
                  </div>
                  <div className="font-mono-num font-semibold text-[#00C9A7] shrink-0">
                    -{item.avoidedCo2Kg} kg CO₂
                  </div>
                </div>
              ))}
            </div>
            {summary.note && (
              <p className="pt-2 border-t border-[var(--aw-border)] text-[11px] text-[var(--aw-text-secondary)] flex items-start gap-1.5">
                <Sprout className="w-3.5 h-3.5 text-[#00C9A7] shrink-0 mt-0.5" />
                <span>{summary.note}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
