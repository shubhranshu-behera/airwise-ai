import { CheckSquare, Home, Info, Plus, Square, Trash2, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CurrentEnvironmentData, IndoorRoom } from '../types';

interface IndoorAirViewProps {
  current: CurrentEnvironmentData | null;
}

const CHECKLIST_ITEMS = [
  { id: 'wet_mop', label: 'Damp-mop floors instead of dry sweeping (prevents PM10 resuspension)' },
  { id: 'exhaust_before_cook', label: 'Run kitchen chimney/exhaust 5 min before & 15 min after cooking' },
  { id: 'window_seals', label: 'Seal door/window weather-stripping during evening smog peaks' },
  { id: 'shoe_free_entry', label: 'Maintain shoe-free entryway to reduce tracked roadside dust' },
  { id: 'hepa_prefilter', label: 'Vacuum HEPA pre-filter mesh every 14 days (never wash H13 paper media)' },
];

export function IndoorAirView({ current }: IndoorAirViewProps) {
  const outdoorPm25 = current?.pollutants.pm25 ?? 45;
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [roomType, setRoomType] = useState<IndoorRoom['roomType']>('bedroom');
  const [areaSqFt, setAreaSqFt] = useState(180);
  const [ceilingHeightFt, setCeilingHeightFt] = useState(9.5);
  const [ventilationType, setVentilationType] = useState<IndoorRoom['ventilationType']>('natural_windows');
  const [hasPurifier, setHasPurifier] = useState(false);
  const [purifierCadrM3h, setPurifierCadrM3h] = useState(320);

  async function loadRooms() {
    setLoading(true);
    try {
      const res = await api.getIndoorRooms(outdoorPm25);
      setRooms(res.rooms);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRooms();
  }, [outdoorPm25]);

  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.addIndoorRoom({
      name: name.trim(),
      roomType,
      areaSqFt,
      ceilingHeightFt,
      ventilationType,
      sources: roomType === 'kitchen' ? ['Cooking aerosols', 'Gas combustion NO2'] : ['Outdoor infiltration'],
      hasPurifier,
      purifierCadrM3h: hasPurifier ? purifierCadrM3h : undefined,
      checklistCompleted: [],
    });
    setName('');
    setShowForm(false);
    await loadRooms();
  }

  async function toggleChecklist(room: any, itemId: string) {
    const existing: string[] = room.checklistCompleted || [];
    const next = existing.includes(itemId) ? existing.filter((x) => x !== itemId) : [...existing, itemId];
    await api.updateRoomChecklist(room.id, next);
    await loadRooms();
  }

  async function handleDelete(id: string) {
    await api.deleteIndoorRoom(id);
    await loadRooms();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--aw-text)]">Indoor Air Quality Optimizer</h2>
          <p className="text-xs text-[var(--aw-text-secondary)] mt-0.5">
            Room-wise HEPA CADR sizing (US EPA / ASHRAE 4–5 ACH), ventilation timing &amp; source control
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Close Form' : 'Add Room'}
        </button>
      </div>

      {/* Explicit Estimation vs Sensor Disclosure */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-4 flex items-start gap-3 text-xs text-[var(--aw-text-secondary)]">
        <Info className="w-4 h-4 text-[#39BDF8] shrink-0 mt-0.5" />
        <span>
          <strong className="text-[var(--aw-text)]">Model Estimate vs. Sensor Measurement:</strong> Indoor PM2.5 figures
          below are calculated from live ambient PM2.5 (<span className="font-mono-num">{outdoorPm25} µg/m³</span>),
          room volume, ventilation type, and purifier CADR. They are engineering estimates, not physical indoor sensor
          readings.
        </span>
      </div>

      {showForm && (
        <form
          onSubmit={handleAddRoom}
          className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div>
            <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Room Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kids Bedroom"
              className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Room Type</label>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value as IndoorRoom['roomType'])}
              className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            >
              <option value="bedroom">Bedroom</option>
              <option value="living_room">Living Room</option>
              <option value="kitchen">Kitchen</option>
              <option value="study">Home Office / Study</option>
              <option value="nursery">Nursery</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Area (sq ft)</label>
            <input
              type="number"
              min={40}
              max={1500}
              value={areaSqFt}
              onChange={(e) => setAreaSqFt(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm font-mono-num text-[var(--aw-text)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Ceiling Height (ft)</label>
            <input
              type="number"
              step={0.5}
              min={7}
              max={16}
              value={ceilingHeightFt}
              onChange={(e) => setCeilingHeightFt(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm font-mono-num text-[var(--aw-text)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Ventilation Mode</label>
            <select
              value={ventilationType}
              onChange={(e) => setVentilationType(e.target.value as IndoorRoom['ventilationType'])}
              className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
            >
              <option value="natural_windows">Natural Windows</option>
              <option value="exhaust_fan">Exhaust Fan / Chimney</option>
              <option value="ac_recirculate">AC Recirculation</option>
              <option value="mechanical_filtered">Filtered Fresh Air (ERV)</option>
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--aw-text)] cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={hasPurifier}
                onChange={(e) => setHasPurifier(e.target.checked)}
                className="accent-[#00C9A7]"
              />
              Has HEPA Purifier
            </label>
          </div>
          {hasPurifier && (
            <div>
              <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Purifier CADR (m³/h)</label>
              <input
                type="number"
                min={60}
                max={1200}
                value={purifierCadrM3h}
                onChange={(e) => setPurifierCadrM3h(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm font-mono-num text-[var(--aw-text)]"
              />
            </div>
          )}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] transition-colors cursor-pointer"
            >
              Save Room
            </button>
          </div>
        </form>
      )}

      {/* Room Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          <div className="h-64 rounded-xl bg-[var(--aw-surface)] border border-[var(--aw-border)]" />
          <div className="h-64 rounded-xl bg-[var(--aw-surface)] border border-[var(--aw-border)]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[var(--aw-text-secondary)]">
                    <Home className="w-3.5 h-3.5 text-[#00C9A7]" />
                    <span className="capitalize">{room.roomType.replace('_', ' ')}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">
                      {room.areaSqFt} sq ft ({room.analysis.volumeM3} m³)
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[var(--aw-text)] mt-1">{room.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(room.id)}
                  aria-label={`Delete ${room.name}`}
                  className="p-2 rounded-lg text-[var(--aw-text-secondary)] hover:text-[#EF4444] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 py-3 border-y border-[var(--aw-border)]">
                <div>
                  <div className="text-[11px] text-[var(--aw-text-secondary)]">Est. Indoor PM2.5</div>
                  <div className="font-mono-num text-xl font-bold text-[#39BDF8] mt-0.5">
                    {room.analysis.estimatedIndoorPm25} <span className="text-xs font-normal">µg/m³</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--aw-text-secondary)]">Recommended CADR</div>
                  <div className="font-mono-num text-xl font-bold text-[#00C9A7] mt-0.5">
                    {room.purifierGuide.recommendedMinCadrM3h} <span className="text-xs font-normal">m³/h</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--aw-text-secondary)]">Current ACH</div>
                  <div className="font-mono-num text-xl font-bold text-[var(--aw-text)] mt-0.5">
                    {room.analysis.currentAch}x
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-[var(--aw-text)] font-medium">
                  <Wind className="w-3.5 h-3.5 text-[#39BDF8]" />
                  <span>{room.analysis.adequacyStatus}</span>
                </div>
                <p className="text-[var(--aw-text-secondary)]">
                  Formula: {room.purifierGuide.formula}. Spec: {room.purifierGuide.filterSpec}.
                </p>
              </div>

              {/* Actionable Room Checklist */}
              <div className="pt-2 space-y-2">
                <div className="text-xs font-semibold text-[var(--aw-text)]">Indoor Air Hygiene Checklist</div>
                {CHECKLIST_ITEMS.slice(0, 3).map((chk) => {
                  const checked = (room.checklistCompleted || []).includes(chk.id);
                  return (
                    <button
                      key={chk.id}
                      type="button"
                      onClick={() => toggleChecklist(room, chk.id)}
                      className="w-full flex items-start gap-2.5 text-left text-xs text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)] transition-colors cursor-pointer"
                    >
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-[#00C9A7] shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-white/25 shrink-0 mt-0.5" />
                      )}
                      <span className={checked ? 'line-through opacity-75' : ''}>{chk.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
