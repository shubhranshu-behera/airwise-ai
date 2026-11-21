import { Plus, Shield, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CurrentEnvironmentData, FamilyMember } from '../types';

interface FamilySafetyViewProps {
  current: CurrentEnvironmentData | null;
  onAskAi: (prompt: string) => void;
}

function computeMemberBriefing(member: FamilyMember, aqi: number) {
  const mult = member.ageGroup === 'child' ? 1.25 : member.ageGroup === 'elderly' ? 1.3 : 1.0;
  const exertion = member.activityProfile === 'active_outdoor' ? 1.2 : member.activityProfile === 'low' ? 0.85 : 1.0;
  const eff = aqi * mult * exertion;

  if (eff > 260) {
    return {
      status: 'Indoor Precaution Recommended',
      color: '#EF4444',
      outdoorAdvice: 'Postpone vigorous outdoor activity. Keep essential trips short with a well-fitted N95/FFP2 mask.',
      indoorAlternative: 'Indoor stretching, games, or reading in a HEPA-filtered room.',
    };
  }
  if (eff > 155) {
    return {
      status: 'Moderate Exposure — Pace Activity',
      color: '#F59E0B',
      outdoorAdvice: 'Prefer shorter outdoor outings during cleaner afternoon hours away from busy traffic junctions.',
      indoorAlternative: 'Shift high-intensity sports or workouts indoors until evening haze clears.',
    };
  }
  return {
    status: 'Favorable Outdoor Window',
    color: '#22C55E',
    outdoorAdvice: `Good conditions for ${member.preferredOutdoorWindow} routine in parks or residential lanes.`,
    indoorAlternative: 'Brief natural cross-ventilation is suitable when wind speeds are steady.',
  };
}

export function FamilySafetyView({ current, onAskAi }: FamilySafetyViewProps) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<FamilyMember['ageGroup']>('child');
  const [activityProfile, setActivityProfile] = useState<FamilyMember['activityProfile']>('moderate');
  const [preferredOutdoorWindow, setPreferredOutdoorWindow] = useState('07:00 – 08:30');
  const [sensitivityNote, setSensitivityNote] = useState('');

  async function loadMembers() {
    const res = await api.getFamily();
    setMembers(res.members);
  }

  useEffect(() => {
    loadMembers().catch(() => {});
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.addFamilyMember({
      name: name.trim(),
      ageGroup,
      activityProfile,
      preferredOutdoorWindow,
      sensitivityNote,
      notificationsEnabled: true,
    });
    setName('');
    setSensitivityNote('');
    setShowForm(false);
    await loadMembers();
  }

  async function handleDelete(id: string) {
    await api.deleteFamilyMember(id);
    await loadMembers();
  }

  const aqi = current?.aqi ?? 110;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--aw-text)]">Family Safety Manager</h2>
          <p className="text-xs text-[var(--aw-text-secondary)] mt-0.5">
            Individual age-group exposure routines for {current?.location.name ?? 'your city'} (Current AQI{' '}
            <span className="font-mono-num">{aqi}</span>)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onAskAi(
                `Prepare a personalized family air quality briefing for our ${members.length} configured family profiles in ${current?.location.name || 'our city'} today and tomorrow morning.`,
              )
            }
            className="px-3.5 py-2 rounded-lg border border-[var(--aw-border)] bg-[var(--aw-surface)] text-xs font-semibold text-[var(--aw-text)] hover:border-[#00C9A7] transition-colors cursor-pointer whitespace-nowrap"
          >
            Generate AI Family Brief
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Profile
          </button>
        </div>
      </div>

      {/* Non-Medical Scope Banner */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-4 flex items-start gap-3 text-xs text-[var(--aw-text-secondary)]">
        <Shield className="w-4 h-4 text-[#00C9A7] shrink-0 mt-0.5" />
        <span>
          <strong className="text-[var(--aw-text)]">Privacy-First &amp; Non-Medical Guidance:</strong> AIRWISE stores
          minimal age-group and activity preferences only. Recommendations support environmental exposure planning and
          never diagnose medical conditions or guarantee health protection.
        </span>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          <div>
            <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">First Name / Label</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kavya"
              className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Age Group</label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as FamilyMember['ageGroup'])}
              className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            >
              <option value="child">Child (Under 14)</option>
              <option value="adult">Adult (14–64)</option>
              <option value="elderly">Older Adult (65+)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Activity Level</label>
            <select
              value={activityProfile}
              onChange={(e) => setActivityProfile(e.target.value as FamilyMember['activityProfile'])}
              className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            >
              <option value="low">Low / Light Walks</option>
              <option value="moderate">Moderate Daily Commute</option>
              <option value="active_outdoor">Active Outdoor Sports</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Preferred Window</label>
            <input
              type="text"
              value={preferredOutdoorWindow}
              onChange={(e) => setPreferredOutdoorWindow(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] cursor-pointer"
            >
              Save Member
            </button>
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">
              Routine Note (optional — avoid sensitive medical records)
            </label>
            <input
              type="text"
              value={sensitivityNote}
              onChange={(e) => setSensitivityNote(e.target.value)}
              placeholder="e.g. School bus at 07:30, outdoor cricket practice at 17:00"
              className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            />
          </div>
        </form>
      )}

      {/* Family Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {members.map((m) => {
          const brief = computeMemberBriefing(m, aqi);
          return (
            <div
              key={m.id}
              className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[var(--aw-text-secondary)]">
                      <Users className="w-3.5 h-3.5 text-[#39BDF8]" />
                      <span className="capitalize">{m.ageGroup}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{m.activityProfile.replace('_', ' ')}</span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-[var(--aw-text)] mt-1">{m.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    aria-label={`Remove ${m.name}`}
                    className="p-1.5 rounded-lg text-[var(--aw-text-secondary)] hover:text-[#EF4444] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="py-2.5 border-y border-[var(--aw-border)]">
                  <div className="text-xs font-semibold" style={{ color: brief.color }}>
                    {brief.status}
                  </div>
                  <div className="font-mono-num text-[11px] text-[var(--aw-text-secondary)] mt-0.5">
                    Target Window: {m.preferredOutdoorWindow}
                  </div>
                </div>

                <div className="space-y-2 text-xs text-[var(--aw-text-secondary)] leading-relaxed">
                  <p>
                    <strong className="text-[var(--aw-text)]">Outdoor Plan:</strong> {brief.outdoorAdvice}
                  </p>
                  <p>
                    <strong className="text-[var(--aw-text)]">Indoor Swap:</strong> {brief.indoorAlternative}
                  </p>
                  {m.sensitivityNote && (
                    <p className="italic">Note: {m.sensitivityNote}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
