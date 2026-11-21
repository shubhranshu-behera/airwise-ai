import { useEffect, useRef } from 'react';
import type { CurrentEnvironmentData } from '../types';

export type WallpaperMode = 'aqi_flow' | 'wind_field' | 'horizon' | 'minimal';

interface DynamicWallpaperProps {
  current: CurrentEnvironmentData | null;
  theme: 'dark' | 'light';
  mode: WallpaperMode;
}

function getAtmospherePalette(aqi: number, theme: 'dark' | 'light') {
  if (theme === 'light') {
    if (aqi <= 50) return { primary: 'rgba(0, 168, 140, 0.14)', secondary: 'rgba(2, 132, 199, 0.12)', particle: 'rgba(0, 150, 130, 0.35)' };
    if (aqi <= 150) return { primary: 'rgba(2, 132, 199, 0.14)', secondary: 'rgba(217, 119, 6, 0.10)', particle: 'rgba(2, 132, 199, 0.32)' };
    return { primary: 'rgba(217, 119, 6, 0.14)', secondary: 'rgba(220, 38, 38, 0.10)', particle: 'rgba(217, 119, 6, 0.32)' };
  }

  // Dark Command Palette driven by live AQI category
  if (aqi <= 50) {
    return { primary: 'rgba(0, 201, 167, 0.22)', secondary: 'rgba(57, 189, 248, 0.16)', particle: 'rgba(0, 201, 167, 0.45)' };
  }
  if (aqi <= 100) {
    return { primary: 'rgba(57, 189, 248, 0.22)', secondary: 'rgba(0, 201, 167, 0.15)', particle: 'rgba(57, 189, 248, 0.45)' };
  }
  if (aqi <= 200) {
    return { primary: 'rgba(245, 158, 11, 0.18)', secondary: 'rgba(57, 189, 248, 0.14)', particle: 'rgba(245, 158, 11, 0.42)' };
  }
  if (aqi <= 300) {
    return { primary: 'rgba(249, 115, 22, 0.20)', secondary: 'rgba(57, 189, 248, 0.12)', particle: 'rgba(249, 115, 22, 0.44)' };
  }
  return { primary: 'rgba(239, 68, 68, 0.20)', secondary: 'rgba(245, 158, 11, 0.12)', particle: 'rgba(239, 68, 68, 0.42)' };
}

export function DynamicWallpaper({ current, theme, mode }: DynamicWallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aqi = current?.aqi ?? 75;
  const windSpeed = current?.weather.windSpeedKmh ?? 10;
  const windDeg = current?.weather.windDirectionDeg ?? 235;
  const pm25 = current?.pollutants.pm25 ?? 25;

  const palette = getAtmospherePalette(aqi, theme);

  useEffect(() => {
    if (mode === 'minimal' || mode === 'horizon') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle count subtly scales with PM2.5 while staying performant (36–72 particles)
    const count = mode === 'wind_field' ? 68 : Math.min(72, Math.max(36, Math.round(30 + pm25 * 0.25)));
    const rad = ((windDeg + 180) % 360) * (Math.PI / 180);
    const speedFactor = Math.max(0.35, Math.min(2.1, windSpeed / 12));
    const vxBase = Math.sin(rad) * speedFactor;
    const vyBase = -Math.cos(rad) * speedFactor * 0.65;

    const particles = Array.from({ length: count }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: mode === 'wind_field' ? 1.2 + (idx % 2) * 0.6 : 1.4 + (idx % 3) * 0.9,
      drift: 0.4 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      len: mode === 'wind_field' ? 18 + Math.random() * 26 : 6 + Math.random() * 10,
    }));

    let tick = 0;

    const renderFrame = () => {
      tick += 0.012;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (!prefersReduced) {
          p.x += (vxBase * 1.15 + Math.sin(tick + p.phase) * 0.22) * p.drift;
          p.y += (vyBase * 1.15 + Math.cos(tick * 0.8 + p.phase) * 0.18) * p.drift;
        }

        if (p.x > width + 30) p.x = -30;
        if (p.x < -30) p.x = width + 30;
        if (p.y > height + 30) p.y = -30;
        if (p.y < -30) p.y = height + 30;

        if (mode === 'wind_field') {
          ctx.beginPath();
          ctx.strokeStyle = palette.particle;
          ctx.lineWidth = p.r * 0.85;
          ctx.lineCap = 'round';
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - vxBase * p.len, p.y - vyBase * p.len);
          ctx.stroke();
        } else {
          // Soft atmospheric particle with subtle directional tail
          ctx.beginPath();
          ctx.fillStyle = palette.particle;
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.strokeStyle = palette.particle;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - vxBase * p.len, p.y - vyBase * p.len);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      if (!prefersReduced) {
        animId = window.requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animId) window.cancelAnimationFrame(animId);
    };
  }, [aqi, windSpeed, windDeg, pm25, theme, mode, palette.particle]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
    >
      {/* Base solid theme canvas */}
      <div className="absolute inset-0 bg-[var(--aw-bg)] transition-colors duration-500" />

      {/* Architectural Smart City Backdrop (visible on aqi_flow & horizon modes) */}
      {(mode === 'aqi_flow' || mode === 'horizon') && (
        <img
          src="/src/assets/images/hero_smart_city_air_1795202591366.jpg"
          alt=""
          referrerPolicy="no-referrer"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            theme === 'dark'
              ? mode === 'horizon'
                ? 'opacity-[0.22] saturate-90'
                : 'opacity-[0.14] saturate-75'
              : mode === 'horizon'
                ? 'opacity-[0.12] saturate-50'
                : 'opacity-[0.07] saturate-50'
          }`}
        />
      )}

      {/* Adaptive Atmospheric Depth Gradients responding to live AQI */}
      {mode !== 'minimal' && (
        <>
          <div
            className="absolute -top-32 -right-24 w-[680px] h-[680px] rounded-full blur-3xl transition-colors duration-1000"
            style={{ background: `radial-gradient(circle, ${palette.primary} 0%, transparent 70%)` }}
          />
          <div
            className="absolute -bottom-40 left-1/4 w-[620px] h-[620px] rounded-full blur-3xl transition-colors duration-1000"
            style={{ background: `radial-gradient(circle, ${palette.secondary} 0%, transparent 70%)` }}
          />
        </>
      )}

      {/* Live Wind-Vector & Atmospheric Particle Canvas */}
      {(mode === 'aqi_flow' || mode === 'wind_field') && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-90" />
      )}

      {/* Measured Contrast Scrim guaranteeing high readability */}
      <div
        className={`absolute inset-0 ${
          theme === 'dark'
            ? 'bg-gradient-to-b from-[#08131F]/70 via-[#08131F]/80 to-[#08131F]/92'
            : 'bg-gradient-to-b from-[#F3F7FA]/75 via-[#F3F7FA]/88 to-[#F3F7FA]/95'
        }`}
      />
    </div>
  );
}
