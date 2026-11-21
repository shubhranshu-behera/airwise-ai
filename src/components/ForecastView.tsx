import { Activity, AlertTriangle, CloudFog, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ForecastBundle } from '../types';

interface ForecastViewProps {
  forecast: ForecastBundle | null;
  loading: boolean;
}

export function ForecastView({ forecast, loading }: ForecastViewProps) {
  const [horizon, setHorizon] = useState<'24h' | '48h' | '72h' | 'history'>('24h');

  if (loading || !forecast) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-80 rounded-xl bg-[var(--aw-surface)] border border-[var(--aw-border)]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-[var(--aw-surface)] border border-[var(--aw-border)]" />
          ))}
        </div>
      </div>
    );
  }

  const series =
    horizon === '24h'
      ? forecast.forecast24h
      : horizon === '48h'
        ? forecast.forecast48h
        : horizon === '72h'
          ? forecast.forecast72h
          : forecast.history;

  const chartData = series.map((pt) => ({
    label: horizon === '24h' ? pt.time.slice(11, 16) : `${pt.time.slice(5, 10)} ${pt.time.slice(11, 13)}h`,
    aqi: pt.aqi,
    pm25: pt.pm25,
    pm10: pt.pm10,
    low: pt.confidenceLow ?? pt.aqi,
    high: pt.confidenceHigh ?? pt.aqi,
  }));

  const smogColor =
    forecast.winterSmogRisk.level === 'high'
      ? '#EF4444'
      : forecast.winterSmogRisk.level === 'moderate'
        ? '#F59E0B'
        : '#22C55E';

  return (
    <div className="space-y-6">
      {/* Header & Horizon Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--aw-text)]">
            Predictive AQI &amp; PM2.5 Forecasting — {forecast.location.name}
          </h2>
          <p className="text-xs text-[var(--aw-text-secondary)] mt-0.5">
            {forecast.source} · Evaluated {forecast.evaluation.evaluatedAt.slice(0, 16).replace('T', ' ')}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--aw-surface)] border border-[var(--aw-border)]">
          {(
            [
              { id: '24h', label: '24-Hour' },
              { id: '48h', label: '48-Hour' },
              { id: '72h', label: '72-Hour' },
              { id: 'history', label: 'Past 72h Observed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setHorizon(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                horizon === tab.id
                  ? 'bg-[#00C9A7] text-[#05181C]'
                  : 'text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Forecast Chart with Confidence Bounds */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="text-sm font-semibold text-[var(--aw-text)]">
            {horizon === 'history'
              ? 'Historical Observed AQI & PM2.5 Series'
              : `${horizon.toUpperCase()} Projected AQI Trajectory with Uncertainty Bounds`}
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--aw-text-secondary)]">
            <span>
              Trend:{' '}
              <strong
                className={
                  forecast.trendDirection === 'improving'
                    ? 'text-[#22C55E]'
                    : forecast.trendDirection === 'worsening'
                      ? 'text-[#EF4444]'
                      : 'text-[#39BDF8]'
                }
              >
                {forecast.trendDirection} ({forecast.trendDeltaPct > 0 ? '+' : ''}
                {forecast.trendDeltaPct}%)
              </strong>
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,178,197,0.14)" />
              <XAxis dataKey="label" stroke="#9CB2C5" tick={{ fontSize: 11 }} minTickGap={24} />
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
              {horizon !== 'history' && (
                <Area
                  type="monotone"
                  dataKey="high"
                  name="Upper Confidence Bound"
                  stroke="none"
                  fill="#39BDF8"
                  fillOpacity={0.14}
                />
              )}
              <Line type="monotone" dataKey="aqi" name="AQI" stroke="#00C9A7" strokeWidth={2.5} dot={false} />
              <Line
                type="monotone"
                dataKey="pm25"
                name="PM2.5 (µg/m³)"
                stroke="#39BDF8"
                strokeWidth={1.75}
                dot={false}
              />
              {horizon !== 'history' && (
                <Line
                  type="monotone"
                  dataKey="low"
                  name="Lower Confidence Bound"
                  stroke="#9CB2C5"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3 Analytical Cards: Winter Smog Indicator, Chronological Model Evaluation, Cleanest Windows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Winter Smog / Inversion Indicator */}
        <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">
              Smog &amp; Inversion Risk
            </h3>
            <CloudFog className="w-4 h-4" style={{ color: smogColor }} />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono-num text-3xl font-bold" style={{ color: smogColor }}>
              {forecast.winterSmogRisk.score}/100
            </span>
            <span className="text-sm font-semibold capitalize" style={{ color: smogColor }}>
              {forecast.winterSmogRisk.level} Risk
            </span>
          </div>
          <ul className="space-y-2 text-xs text-[var(--aw-text-secondary)]">
            {forecast.winterSmogRisk.factors.map((f, idx) => (
              <li key={idx} className="leading-relaxed">
                • {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Chronological ML Evaluation (Honest Measured Holdout Metrics) */}
        <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">
              Measured Model Backtest
            </h3>
            <Activity className="w-4 h-4 text-[#39BDF8]" />
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-[var(--aw-bg)]">
              <div className="text-[11px] text-[var(--aw-text-secondary)]">MAE PM2.5</div>
              <div className="font-mono-num text-lg font-bold text-[var(--aw-text)]">
                {forecast.evaluation.maePm25}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--aw-bg)]">
              <div className="text-[11px] text-[var(--aw-text-secondary)]">RMSE PM2.5</div>
              <div className="font-mono-num text-lg font-bold text-[var(--aw-text)]">
                {forecast.evaluation.rmsePm25}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--aw-bg)]">
              <div className="text-[11px] text-[var(--aw-text-secondary)]">Direction</div>
              <div className="font-mono-num text-lg font-bold text-[#00C9A7]">
                {forecast.evaluation.directionalAccuracyPct}%
              </div>
            </div>
          </div>

          <div className="text-xs text-[var(--aw-text-secondary)] space-y-1">
            <div className="font-medium text-[var(--aw-text)]">
              {forecast.evaluation.modelName} (v{forecast.evaluation.version})
            </div>
            <p className="leading-relaxed">
              {forecast.evaluation.methodology} Train: {forecast.evaluation.trainSamples}h · Test:{' '}
              {forecast.evaluation.testSamples}h.
            </p>
          </div>
        </div>

        {/* Cleanest Outdoor Activity Windows */}
        <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[var(--aw-text)]">
              Cleanest 24h Windows
            </h3>
            {forecast.trendDirection === 'improving' ? (
              <TrendingDown className="w-4 h-4 text-[#22C55E]" />
            ) : (
              <TrendingUp className="w-4 h-4 text-[#F59E0B]" />
            )}
          </div>

          <div className="space-y-3">
            {forecast.cleanestWindows.map((win, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between pb-3 border-b border-[var(--aw-border)] last:border-b-0 last:pb-0"
              >
                <div>
                  <div className="font-mono-num text-sm font-semibold text-[var(--aw-text)]">
                    {win.start} – {win.end}
                  </div>
                  <div className="text-xs text-[var(--aw-text-secondary)]">{win.recommendedFor}</div>
                </div>
                <div className="text-right font-mono-num">
                  <div className="text-sm font-bold text-[#00C9A7]">AQI {win.avgAqi}</div>
                  <div className="text-[11px] text-[var(--aw-text-secondary)]">PM2.5 {win.avgPm25}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Anomaly Detection Table */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--aw-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="font-display text-sm font-semibold text-[var(--aw-text)]">
              Statistical Pollution Anomaly Detection (Z-Score ≥ 1.65σ)
            </h3>
          </div>
          <span className="font-mono-num text-xs text-[var(--aw-text-secondary)]">
            {forecast.anomalies.length} detected
          </span>
        </div>

        {forecast.anomalies.length === 0 ? (
          <div className="p-6 text-sm text-[var(--aw-text-secondary)]">
            No abrupt statistical PM2.5 anomalies detected across the rolling 60-hour window.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-[var(--aw-border)] text-xs text-[var(--aw-text-secondary)]">
                  <th className="px-6 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Pollutant</th>
                  <th className="px-4 py-3 font-medium text-right">Observed</th>
                  <th className="px-4 py-3 font-medium text-right">Baseline Mean</th>
                  <th className="px-4 py-3 font-medium text-right">Z-Score</th>
                  <th className="px-6 py-3 font-medium">Meteorological Explanation</th>
                </tr>
              </thead>
              <tbody>
                {forecast.anomalies.map((an, idx) => (
                  <tr key={idx} className="border-b border-[var(--aw-border)] last:border-b-0">
                    <td className="px-6 py-3 font-mono-num text-xs text-[var(--aw-text)]">
                      {an.time.replace('T', ' ')}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-[var(--aw-text)]">{an.pollutant}</td>
                    <td className="px-4 py-3 text-right font-mono-num text-[#EF4444] font-semibold">
                      {an.observedValue} µg/m³
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-[var(--aw-text-secondary)]">
                      {an.baselineMean} µg/m³
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-[#F59E0B] font-semibold">
                      +{an.zScore}σ
                    </td>
                    <td className="px-6 py-3 text-xs text-[var(--aw-text-secondary)]">{an.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
