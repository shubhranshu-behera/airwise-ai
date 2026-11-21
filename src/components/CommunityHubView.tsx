import { Camera, CheckCircle, Flag, MapPin, ShieldAlert, ThumbsUp, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CityLocation, CommunityReport, UserAccountPublic } from '../types';

interface CommunityHubViewProps {
  city: CityLocation;
  user: UserAccountPublic | null;
}

const CATEGORY_LABELS: Record<CommunityReport['category'], string> = {
  waste_burning: 'Open Waste Burning',
  construction_dust: 'Construction Dust',
  traffic_congestion: 'Traffic Congestion',
  industrial_smoke: 'Industrial Smoke',
  clean_air_zone: 'Clean-Air Canopy Zone',
};

const CAMPAIGNS = [
  {
    id: 'camp-1',
    title: 'Zero-Burn Neighborhood Watch',
    desc: 'Report dry-leaf or waste burning incidents so local ward teams can dispatch wet composting collection.',
    participants: 142,
  },
  {
    id: 'camp-2',
    title: 'Covered Construction Logistics Pledge',
    desc: 'Document uncovered gravel trucks and dry sweeping along arterial roads for municipal dust mitigation.',
    participants: 98,
  },
];

export function CommunityHubView({ city, user }: CommunityHubViewProps) {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [cityOnly, setCityOnly] = useState(false);

  // Submission state
  const [neighborhood, setNeighborhood] = useState('');
  const [category, setCategory] = useState<CommunityReport['category']>('construction_dust');
  const [severity, setSeverity] = useState<CommunityReport['severity']>('medium');
  const [description, setDescription] = useState('');
  const [approxOnly, setApproxOnly] = useState(true);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadReports() {
    const res = await api.getCommunityReports(cityOnly ? city.name : 'all', categoryFilter);
    setReports(res.reports);
    setAnalytics(res.analytics);
  }

  useEffect(() => {
    loadReports().catch(() => {});
  }, [city.name, cityOnly, categoryFilter]);

  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setSubmitErr('Only PNG, JPEG, or WebP images are allowed.');
      return;
    }
    if (file.size > 1_400_000) {
      setSubmitErr('Image must be smaller than 1.4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
        setSubmitErr(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitErr(null);
    setSubmitMsg(null);
    setSubmitting(true);
    try {
      await api.submitCommunityReport({
        city: city.name,
        neighborhood,
        lat: city.lat + (Math.random() - 0.5) * 0.02,
        lng: city.lng + (Math.random() - 0.5) * 0.02,
        category,
        severity,
        description,
        photoDataUrl,
        approximateLocationOnly: approxOnly,
      });
      setNeighborhood('');
      setDescription('');
      setPhotoDataUrl(undefined);
      setSubmitMsg('Report submitted with privacy-protected approximate neighborhood coordinates.');
      await loadReports();
    } catch (err: any) {
      setSubmitErr(err?.message || 'Unable to submit report.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpvote(id: string) {
    await api.upvoteCommunityReport(id);
    await loadReports();
  }

  async function handleModerate(id: string, status: 'verified' | 'flagged') {
    try {
      await api.moderateCommunityReport(id, status);
      await loadReports();
    } catch (err: any) {
      setSubmitErr(err?.message || 'Moderation failed.');
    }
  }

  const canModerate = user?.role === 'admin' || user?.role === 'community_lead';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--aw-text)]">Community Intelligence Hub</h2>
          <p className="text-xs text-[var(--aw-text-secondary)] mt-0.5">
            Privacy-safe neighborhood pollution reporting, community validation &amp; clean-air campaigns
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCityOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              cityOnly
                ? 'border-[#00C9A7] bg-[#00C9A7]/15 text-[#00C9A7]'
                : 'border-[var(--aw-border)] bg-[var(--aw-surface)] text-[var(--aw-text-secondary)]'
            }`}
          >
            {cityOnly ? `Showing ${city.name}` : 'All Cities'}
          </button>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[var(--aw-surface)] border border-[var(--aw-border)] text-xs text-[var(--aw-text)]"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Submit Report Form */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">
              Report Local Pollution or Clean-Air Zone ({city.name})
            </h3>

            <div>
              <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Neighborhood / Corridor</label>
              <input
                type="text"
                required
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="e.g. Ring Road Sector 4, Patia Square"
                className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CommunityReport['category'])}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-xs text-[var(--aw-text)]"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as CommunityReport['severity'])}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-xs text-[var(--aw-text)]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--aw-text-secondary)] mb-1">Observation Details</label>
              <textarea
                rows={3}
                required
                minLength={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe visible smoke, construction dust, or canopy clarity without including personal identifying details..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)]"
              />
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--aw-border)] hover:border-[#00C9A7] text-xs text-[var(--aw-text-secondary)] cursor-pointer">
                <Upload className="w-4 h-4 text-[#39BDF8]" />
                <span>{photoDataUrl ? 'Photo attached (click to replace)' : 'Attach supporting photo (PNG/JPG, max 1.4MB)'}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoFile} className="hidden" />
              </label>
              {photoDataUrl && (
                <img
                  src={photoDataUrl}
                  alt="Attached report preview"
                  className="h-28 w-full object-cover rounded-lg border border-[var(--aw-border)]"
                />
              )}
            </div>

            <label className="flex items-start gap-2 text-xs text-[var(--aw-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={approxOnly}
                onChange={(e) => setApproxOnly(e.target.checked)}
                className="accent-[#00C9A7] mt-0.5"
              />
              <span>Publish approximate neighborhood grid (~1 km precision) only to protect my exact address.</span>
            </label>

            {submitErr && (
              <div className="p-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs text-[#FCA5A5]">
                {submitErr}
              </div>
            )}
            {submitMsg && (
              <div className="p-3 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-xs text-[#86EFAC]">
                {submitMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit Community Report'}
            </button>
          </form>

          {/* Local Clean-Air Campaigns */}
          <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">Local Clean-Air Campaigns</h3>
            {CAMPAIGNS.map((c) => (
              <div key={c.id} className="pb-3 border-b border-[var(--aw-border)] last:border-b-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--aw-text)]">{c.title}</span>
                  <span className="font-mono-num text-xs text-[#00C9A7]">{c.participants} citizens</span>
                </div>
                <p className="text-xs text-[var(--aw-text-secondary)] leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Community Reports Feed */}
        <div className="lg:col-span-7 space-y-4">
          {analytics && (
            <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--aw-text-secondary)]">
              <span>
                Total Reports: <strong className="font-mono-num text-[var(--aw-text)]">{analytics.totalReports}</strong>
              </span>
              <span>
                Verified: <strong className="font-mono-num text-[#22C55E]">{analytics.verifiedCount}</strong>
              </span>
              <span>
                Top Recurring Pattern:{' '}
                <strong className="text-[#F59E0B]">
                  {CATEGORY_LABELS[analytics.topRecurringIssue as CommunityReport['category']] || 'Mixed'}
                </strong>
              </span>
            </div>
          )}

          {reports.length === 0 ? (
            <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-8 text-center text-sm text-[var(--aw-text-secondary)]">
              No community reports match the current filter. Submit the first observation for this area.
            </div>
          ) : (
            reports.map((rep) => (
              <div
                key={rep.id}
                className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--aw-text-secondary)]">
                      <span className="font-semibold text-[#39BDF8]">{CATEGORY_LABELS[rep.category]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">Severity: {rep.severity}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          rep.status === 'verified'
                            ? 'text-[#22C55E] font-medium'
                            : rep.status === 'flagged'
                              ? 'text-[#EF4444] font-medium'
                              : 'text-[#F59E0B] font-medium'
                        }
                      >
                        {rep.status}
                      </span>
                    </div>
                    <h4 className="font-display text-base font-bold text-[var(--aw-text)] mt-1">
                      {rep.neighborhood}, {rep.city}
                    </h4>
                  </div>

                  <span className="font-mono-num text-[11px] text-[var(--aw-text-secondary)]">
                    {rep.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>

                <p className="text-sm text-[var(--aw-text-secondary)] leading-relaxed">{rep.description}</p>

                {rep.photoDataUrl && (
                  <img
                    src={rep.photoDataUrl}
                    alt={`Community report photo from ${rep.neighborhood}`}
                    className="h-44 w-full object-cover rounded-lg border border-[var(--aw-border)]"
                  />
                )}

                <div className="pt-2 border-t border-[var(--aw-border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--aw-text-secondary)]">
                  <div className="flex items-center gap-3">
                    <span>By {rep.authorName}</span>
                    <span className="inline-flex items-center gap-1 font-mono-num">
                      <MapPin className="w-3.5 h-3.5" />
                      {rep.lat}°, {rep.lng}° {rep.approximateLocationOnly ? '(Approx)' : ''}
                    </span>
                    {rep.photoDataUrl && (
                      <span className="inline-flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5" /> Photo
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpvote(rep.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--aw-border)] hover:border-[#00C9A7] text-[var(--aw-text)] cursor-pointer font-mono-num"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-[#00C9A7]" />
                      {rep.upvotes}
                    </button>

                    {canModerate && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleModerate(rep.id, 'verified')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#22C55E]/40 text-[#22C55E] hover:bg-[#22C55E]/10 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModerate(rep.id, 'flagged')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#EF4444]/40 text-[#EF4444] hover:bg-[#EF4444]/10 cursor-pointer"
                        >
                          <Flag className="w-3.5 h-3.5" /> Flag
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {!canModerate && (
            <div className="text-xs text-[var(--aw-text-secondary)] flex items-center gap-2 pt-1">
              <ShieldAlert className="w-4 h-4 text-[#39BDF8]" />
              <span>Sign in as a Community Lead or Admin to access moderation verification actions.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
