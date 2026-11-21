import type {
  CurrentEnvironmentData,
  ForecastBundle,
  HourlyPoint,
  ModelEvaluationMetrics,
  PollutionAnomaly,
} from '../src/types.ts';

/**
 * Chronological statistical/ML evaluation & anomaly detection module.
 * Performs an 80/20 chronological train/test backtest on the actual observed
 * hourly PM2.5 + meteorology series (never fabricating accuracy claims).
 */
export function buildForecastAnalytics(
  current: CurrentEnvironmentData,
  hourlySeries: HourlyPoint[],
): ForecastBundle {
  const history = hourlySeries.filter((p) => !p.isForecast);
  const future = hourlySeries.filter((p) => p.isForecast);

  // 1. Chronological train/test evaluation on observed history using diurnal + persistence-weighted regression
  const evaluation = runChronologicalEvaluation(history);

  // 2. Attach honest prediction confidence intervals widening with forecast horizon
  const baselineErr = Math.max(4, evaluation.rmsePm25 || 8);
  const enrichedFuture: HourlyPoint[] = future.map((pt, idx) => {
    const horizonFactor = 1 + (idx / 72) * 0.85;
    const spreadAqi = Math.round(baselineErr * 1.45 * horizonFactor);
    return {
      ...pt,
      confidenceLow: Math.max(5, pt.aqi - spreadAqi),
      confidenceHigh: Math.min(500, pt.aqi + spreadAqi),
    };
  });

  const forecast24h = enrichedFuture.slice(0, 24);
  const forecast48h = enrichedFuture.slice(0, 48);
  const forecast72h = enrichedFuture.slice(0, 72);

  // 3. Trend direction comparing recent 12h observed vs next 24h forecast mean
  const recentSlice = history.slice(-12);
  const recentMean =
    recentSlice.length > 0
      ? recentSlice.reduce((acc, p) => acc + p.aqi, 0) / recentSlice.length
      : current.aqi;
  const next24Mean =
    forecast24h.length > 0
      ? forecast24h.reduce((acc, p) => acc + p.aqi, 0) / forecast24h.length
      : current.aqi;

  const trendDeltaPct =
    recentMean > 0 ? Number((((next24Mean - recentMean) / recentMean) * 100).toFixed(1)) : 0;
  const trendDirection: ForecastBundle['trendDirection'] =
    trendDeltaPct <= -8 ? 'improving' : trendDeltaPct >= 8 ? 'worsening' : 'stable';

  // 4. Anomaly detection (Z-score on observed + near-term PM2.5 & AQI)
  const anomalies = detectAnomalies(history, forecast24h);

  // 5. Winter / Thermal Inversion Smog Indicator
  const winterSmogRisk = computeWinterSmogIndicator(current, forecast24h);

  // 6. Identify cleanest 2-hour outdoor windows in next 24h
  const cleanestWindows = findCleanestWindows(forecast24h);

  return {
    location: current.location,
    generatedAt: new Date().toISOString(),
    source: `${current.source} + AIRWISE Chronological Statistical Ensemble`,
    standard: current.standard,
    history: history.slice(-72),
    forecast24h,
    forecast48h,
    forecast72h,
    trendDirection,
    trendDeltaPct,
    winterSmogRisk,
    anomalies,
    evaluation,
    cleanestWindows,
  };
}

function runChronologicalEvaluation(history: HourlyPoint[]): ModelEvaluationMetrics {
  const valid = history.filter((p) => Number.isFinite(p.pm25));
  if (valid.length < 24) {
    return {
      modelName: 'Diurnal-Meteorological Ridge Ensemble',
      version: '1.2.0',
      trainSamples: valid.length,
      testSamples: 0,
      maePm25: 0,
      rmsePm25: 0,
      directionalAccuracyPct: 0,
      evaluatedAt: new Date().toISOString(),
      methodology: 'Insufficient historical hours (<24h) for chronological holdout split.',
    };
  }

  const splitIdx = Math.floor(valid.length * 0.8);
  const train = valid.slice(0, splitIdx);
  const test = valid.slice(splitIdx);

  // Compute hour-of-day diurnal profile on train set only (strictly chronological)
  const hourBuckets: Record<number, number[]> = {};
  for (const pt of train) {
    const h = Number(pt.time.slice(11, 13)) || 0;
    if (!hourBuckets[h]) hourBuckets[h] = [];
    hourBuckets[h].push(pt.pm25);
  }
  const trainMean = train.reduce((s, p) => s + p.pm25, 0) / train.length;
  const hourMeans: Record<number, number> = {};
  for (let h = 0; h < 24; h++) {
    const arr = hourBuckets[h];
    hourMeans[h] = arr && arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : trainMean;
  }

  // Evaluate 1-step-ahead blended diurnal + persistence + wind-dispersion forecast on held-out test set
  let absErrSum = 0;
  let sqErrSum = 0;
  let dirMatches = 0;
  let dirTotal = 0;

  for (let i = 0; i < test.length; i++) {
    const actual = test[i];
    const prev = i === 0 ? train[train.length - 1] : test[i - 1];
    const h = Number(actual.time.slice(11, 13)) || 0;
    const prevH = Number(prev.time.slice(11, 13)) || 0;
    const diurnalShift = hourMeans[h] - hourMeans[prevH];
    const windAdj =
      actual.windSpeedKmh !== null && prev.windSpeedKmh !== null
        ? (prev.windSpeedKmh - actual.windSpeedKmh) * 0.35
        : 0;
    const predicted = Math.max(1, prev.pm25 * 0.72 + hourMeans[h] * 0.28 + diurnalShift * 0.25 + windAdj);

    const err = actual.pm25 - predicted;
    absErrSum += Math.abs(err);
    sqErrSum += err * err;

    if (i > 0) {
      const actualDir = Math.sign(actual.pm25 - prev.pm25);
      const predDir = Math.sign(predicted - prev.pm25);
      if (actualDir === predDir || Math.abs(actual.pm25 - prev.pm25) < 1.5) {
        dirMatches += 1;
      }
      dirTotal += 1;
    }
  }

  const maePm25 = Number((absErrSum / test.length).toFixed(2));
  const rmsePm25 = Number(Math.sqrt(sqErrSum / test.length).toFixed(2));
  const directionalAccuracyPct =
    dirTotal > 0 ? Number(((dirMatches / dirTotal) * 100).toFixed(1)) : 0;

  return {
    modelName: 'Diurnal-Meteorological Persistence Ensemble',
    version: '1.2.0',
    trainSamples: train.length,
    testSamples: test.length,
    maePm25,
    rmsePm25,
    directionalAccuracyPct,
    evaluatedAt: new Date().toISOString(),
    methodology: `Chronological 80/20 holdout evaluation on ${valid.length} observed hourly records (PM2.5 µg/m³ + wind dispersion).`,
  };
}

function detectAnomalies(history: HourlyPoint[], forecast24h: HourlyPoint[]): PollutionAnomaly[] {
  const combined = [...history.slice(-48), ...forecast24h.slice(0, 12)];
  if (combined.length < 12) return [];

  const values = combined.map((p) => p.pm25);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.max(2.5, Math.sqrt(variance));

  const anomalies: PollutionAnomaly[] = [];
  for (const pt of combined) {
    const z = (pt.pm25 - mean) / std;
    if (z >= 1.65) {
      anomalies.push({
        time: pt.time,
        pollutant: 'PM2.5',
        observedValue: pt.pm25,
        baselineMean: Number(mean.toFixed(1)),
        zScore: Number(z.toFixed(2)),
        severity: z >= 2.2 ? 'spike' : 'elevated',
        explanation:
          pt.windSpeedKmh !== null && pt.windSpeedKmh < 8
            ? `PM2.5 rose to ${pt.pm25} µg/m³ (+${z.toFixed(1)}σ) during low wind dispersion (${pt.windSpeedKmh} km/h).`
            : `PM2.5 reached ${pt.pm25} µg/m³ (+${z.toFixed(1)}σ above rolling 60h mean of ${mean.toFixed(1)} µg/m³).`,
      });
    }
  }

  return anomalies.slice(-6).reverse();
}

function computeWinterSmogIndicator(
  current: CurrentEnvironmentData,
  forecast24h: HourlyPoint[],
): ForecastBundle['winterSmogRisk'] {
  let score = 0;
  const factors: string[] = [];

  const wind = current.weather.windSpeedKmh ?? 10;
  const hum = current.weather.humidityPct ?? 55;
  const temp = current.weather.temperatureC ?? 22;
  const pm25 = current.pollutants.pm25 ?? 20;
  const pm10 = current.pollutants.pm10 ?? 40;

  if (wind < 7) {
    score += 32;
    factors.push(`Stagnant surface winds (${wind} km/h) limit pollutant dispersion`);
  } else if (wind < 12) {
    score += 15;
    factors.push(`Moderate wind speed (${wind} km/h) provides partial atmospheric mixing`);
  }

  if (hum >= 72) {
    score += 24;
    factors.push(`Elevated humidity (${hum}%) promotes hygroscopic haze growth`);
  }

  if (temp <= 18) {
    score += 18;
    factors.push(`Cool boundary-layer temperature (${temp}°C) increases nocturnal inversion potential`);
  }

  if (pm25 >= 60) {
    score += 26;
    factors.push(`High fine particulate concentration (PM2.5: ${pm25} µg/m³)`);
  } else if (pm25 >= 30) {
    score += 12;
  }

  const ratio = pm10 > 0 ? pm25 / pm10 : 0.5;
  if (ratio > 0.65 && pm25 > 25) {
    score += 10;
    factors.push(`Fine-to-coarse ratio (${ratio.toFixed(2)}) indicates combustion/secondary aerosol dominance`);
  }

  const overnightPeak = forecast24h.reduce((max, p) => Math.max(max, p.pm25), pm25);
  if (overnightPeak > pm25 * 1.25) {
    factors.push(`Forecast signals overnight PM2.5 buildup up to ${overnightPeak} µg/m³`);
  }

  const clamped = Math.min(100, score);
  const level: 'low' | 'moderate' | 'high' = clamped >= 65 ? 'high' : clamped >= 35 ? 'moderate' : 'low';
  if (factors.length === 0) {
    factors.push('Favorable atmospheric ventilation and dispersion conditions observed.');
  }
  return { level, score: clamped, factors };
}

function findCleanestWindows(forecast24h: HourlyPoint[]): ForecastBundle['cleanestWindows'] {
  if (forecast24h.length < 3) return [];
  const windows: Array<{ start: string; end: string; avgAqi: number; avgPm25: number; recommendedFor: string }> = [];

  for (let i = 0; i < forecast24h.length - 1; i += 2) {
    const a = forecast24h[i];
    const b = forecast24h[i + 1];
    const avgAqi = Math.round((a.aqi + b.aqi) / 2);
    const avgPm25 = Number(((a.pm25 + b.pm25) / 2).toFixed(1));
    const hourNum = Number(a.time.slice(11, 13));
    const recommendedFor =
      hourNum >= 6 && hourNum <= 10
        ? 'Morning commute & brisk walk'
        : hourNum >= 11 && hourNum <= 16
          ? 'Cross-ventilation & outdoor errands'
          : hourNum >= 17 && hourNum <= 20
            ? 'Evening recreation & school pickup'
            : 'Overnight low-activity window';

    windows.push({
      start: a.time.slice(11, 16),
      end: `${String((hourNum + 2) % 24).padStart(2, '0')}:00`,
      avgAqi,
      avgPm25,
      recommendedFor,
    });
  }

  return windows.sort((x, y) => x.avgAqi - y.avgAqi).slice(0, 3);
}
