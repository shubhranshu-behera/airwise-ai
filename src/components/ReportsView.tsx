import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { AqiStandard, CityLocation, ForecastBundle } from '../types';

interface ReportsViewProps {
  city: CityLocation;
  standard: AqiStandard;
  forecast: ForecastBundle | null;
}

export function ReportsView({ city, standard, forecast }: ReportsViewProps) {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getReportSummary(city, standard, period)
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [city.id, city.lat, city.lng, standard, period]);

  function downloadJson() {
    if (!summary) return;
    const blob = new Blob([JSON.stringify({ summary, historySample: forecast?.history.slice(-24) || [] }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airwise-${city.id}-${period}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    const rows = forecast?.history || [];
    const header = 'timestamp,aqi,us_aqi,pm25_ug_m3,pm10_ug_m3,no2_ug_m3,temp_c,humidity_pct,wind_kmh\n';
    const body = rows
      .map(
        (r) =>
          `${r.time},${r.aqi},${r.usAqi},${r.pm25},${r.pm10},${r.no2},${r.temperatureC ?? ''},${r.humidityPct ?? ''},${r.windSpeedKmh ?? ''}`,
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airwise-${city.id}-aqi-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--aw-text)]">Reports &amp; Environmental Analytics</h2>
          <p className="text-xs text-[var(--aw-text-secondary)] mt-0.5">
            Downloadable environmental summaries, AQI history logs &amp; personal sustainability reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--aw-surface)] border border-[var(--aw-border)]">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize cursor-pointer ${
                  period === p
                    ? 'bg-[#00C9A7] text-[#05181C]'
                    : 'text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--aw-border)] bg-[var(--aw-surface)] text-xs font-semibold text-[var(--aw-text)] hover:border-[#39BDF8] cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#39BDF8]" />
            Download CSV
          </button>

          <button
            type="button"
            onClick={downloadJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Report Summary Card */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[var(--aw-border)]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00C9A7]" />
            <h3 className="font-display text-base font-bold text-[var(--aw-text)] capitalize">
              {period} Environmental &amp; Sustainability Briefing — {city.name}
            </h3>
          </div>
          <span className="font-mono-num text-xs text-[var(--aw-text-secondary)]">
            Generated {summary?.generatedAt?.slice(0, 16).replace('T', ' ') || '—'}
          </span>
        </div>

        {loading || !summary ? (
          <div className="h-32 animate-pulse rounded-lg bg-[var(--aw-bg)]" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div>
              <div className="text-xs text-[var(--aw-text-secondary)]">Ambient {summary.standard}</div>
              <div className="font-mono-num text-2xl font-bold text-[var(--aw-text)] mt-1">{summary.currentAqi}</div>
              <div className="text-xs text-[#00C9A7]">{summary.category}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--aw-text-secondary)]">Dominant Pollutant</div>
              <div className="font-mono-num text-2xl font-bold text-[#39BDF8] mt-1">{summary.dominantPollutant}</div>
              <div className="text-xs text-[var(--aw-text-secondary)]">Trend: {summary.trendDirection}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--aw-text-secondary)]">Smog Risk &amp; Anomalies</div>
              <div className="font-mono-num text-2xl font-bold text-[#F59E0B] mt-1 capitalize">
                {summary.winterSmogRisk}
              </div>
              <div className="text-xs text-[var(--aw-text-secondary)]">
                {summary.anomaliesCount} statistical spike(s)
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--aw-text-secondary)]">Personal CO₂ Avoided</div>
              <div className="font-mono-num text-2xl font-bold text-[#22C55E] mt-1">
                {summary.personalSustainability?.totalAvoidedCo2Kg ?? 0} kg
              </div>
              <div className="text-xs text-[var(--aw-text-secondary)]">
                {summary.personalSustainability?.loggedActivities ?? 0} green activities
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Observed History Table */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--aw-border)] flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-[var(--aw-text)]">
            Recent Observed Hourly Environmental Records (Last 24h)
          </h3>
          <span className="text-xs text-[var(--aw-text-secondary)]">Open-Meteo Copernicus CAMS Archive</span>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 bg-[var(--aw-bg-secondary)]">
              <tr className="border-b border-[var(--aw-border)] text-xs text-[var(--aw-text-secondary)]">
                <th className="px-6 py-3 font-medium">Hour</th>
                <th className="px-4 py-3 font-medium text-right">AQI</th>
                <th className="px-4 py-3 font-medium text-right">PM2.5</th>
                <th className="px-4 py-3 font-medium text-right">PM10</th>
                <th className="px-4 py-3 font-medium text-right">NO₂</th>
                <th className="px-4 py-3 font-medium text-right">Temp</th>
                <th className="px-6 py-3 font-medium text-right">Wind</th>
              </tr>
            </thead>
            <tbody>
              {(forecast?.history.slice(-24).reverse() || []).map((pt) => (
                <tr key={pt.time} className="border-b border-[var(--aw-border)] last:border-b-0">
                  <td className="px-6 py-2.5 font-mono-num text-xs text-[var(--aw-text)]">
                    {pt.time.replace('T', ' ')}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-semibold text-[#00C9A7]">{pt.aqi}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-[var(--aw-text)]">{pt.pm25}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-[var(--aw-text)]">{pt.pm10}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-[var(--aw-text)]">{pt.no2}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-[var(--aw-text-secondary)]">
                    {pt.temperatureC ?? '—'}°C
                  </td>
                  <td className="px-6 py-2.5 text-right font-mono-num text-[var(--aw-text-secondary)]">
                    {pt.windSpeedKmh ?? '—'} km/h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
