import type { AqiCategory, AqiStandard } from '../types';

interface AqiGaugeProps {
  aqi: number;
  standard: AqiStandard;
  category: AqiCategory;
  dominantPollutant: string;
}

export function AqiGauge({ aqi, standard, category, dominantPollutant }: AqiGaugeProps) {
  const clamped = Math.max(0, Math.min(500, aqi));
  const pct = clamped / 500;
  const radius = 84;
  const circumference = Math.PI * radius; // semicircle length
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-[220px] h-[132px]">
        <svg viewBox="0 0 220 130" className="w-full h-full overflow-visible" aria-label={`AQI Gauge ${aqi}`}>
          {/* Track */}
          <path
            d="M 26 112 A 84 84 0 0 1 194 112"
            fill="none"
            stroke="currentColor"
            className="text-slate-300/30 dark:text-slate-700/60"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Value Arc */}
          <path
            d="M 26 112 A 84 84 0 0 1 194 112"
            fill="none"
            stroke={category.color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1), stroke 300ms ease' }}
          />
        </svg>

        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center text-center">
          <span className="font-mono-num text-4xl font-semibold tracking-tight text-[var(--aw-text)]">
            {aqi}
          </span>
          <span className="text-sm font-semibold mt-0.5" style={{ color: category.color }}>
            {category.label}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--aw-text-secondary)]">
        <span>{standard === 'CPCB_NAQI' ? 'CPCB Indian NAQI' : 'US EPA AQI'}</span>
        <span aria-hidden="true">·</span>
        <span>Dominant: {dominantPollutant}</span>
      </div>
    </div>
  );
}
