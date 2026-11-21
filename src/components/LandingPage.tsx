import { ArrowRight, Compass, Layers, ShieldCheck, Wind } from 'lucide-react';
import type { CurrentEnvironmentData } from '../types';

interface LandingPageProps {
  livePreview: CurrentEnvironmentData | null;
  onEnterPlatform: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

const AGENTS_OVERVIEW = [
  { num: '01', name: 'Air Intelligence', desc: 'Fetches live pollutants, meteorology, and micro-zone comparisons.' },
  { num: '02', name: 'Prediction Engine', desc: 'Computes 24–72h outlooks, Z-score anomalies, and smog buildup.' },
  { num: '03', name: 'Risk Assessment', desc: 'Evaluates age-group exposure windows for children, adults, and seniors.' },
  { num: '04', name: 'Lifestyle Planner', desc: 'Aligns commutes, outdoor play, and exercise to cleaner air hours.' },
  { num: '05', name: 'Indoor Air Advisor', desc: 'Calculates room CADR/ACH sizing, kitchen exhaust, and ventilation.' },
  { num: '06', name: 'Smart Mobility', desc: 'Compares transit, EV, cycling, and walking across CO₂ and PM2.5 dose.' },
  { num: '07', name: 'Sustainability Tracker', desc: 'Measures personal avoided emissions and clean-air milestones.' },
  { num: '08', name: 'Community Intelligence', desc: 'Aggregates verified neighborhood pollution reports and trends.' },
];

export function LandingPage({ livePreview, onEnterPlatform, onOpenAuth }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#08131F] text-[#EAF2F8]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08131F]/90 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-[#EAF2F8] whitespace-nowrap shrink-0"
          >
            AIRWISE AI
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#9CB2C5]">
            <a href="#capabilities" className="hover:text-[#EAF2F8] transition-colors whitespace-nowrap shrink-0">
              Platform
            </a>
            <a href="#agents" className="hover:text-[#EAF2F8] transition-colors whitespace-nowrap shrink-0">
              Agents
            </a>
            <a href="#workflow" className="hover:text-[#EAF2F8] transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#standards" className="hover:text-[#EAF2F8] transition-colors whitespace-nowrap shrink-0">
              Standards
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onEnterPlatform}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#00C9A7] text-[#05181C] hover:bg-[#19DDBB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Console
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="relative overflow-hidden border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <p className="text-sm font-medium text-[#00C9A7]">
                  Intelligent Air. Healthier Living.
                </p>
                <h1
                  className="font-display font-bold text-[#EAF2F8] leading-[1.1] max-w-2xl"
                  style={{ fontSize: 'clamp(2.25rem, 4vw, 3.6rem)', textWrap: 'balance' }}
                >
                  Actionable urban air intelligence for every hour of your day.
                </h1>
                <p className="text-base text-[#9CB2C5] leading-relaxed max-w-xl">
                  Don&apos;t just see how polluted the air is. AIRWISE AI coordinates eight specialized environmental
                  agents with real-time Copernicus atmospheric feeds to tell you what to do, when to go outside, how to
                  protect indoor air, and which transit choice cuts both exposure and emissions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onEnterPlatform}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#00C9A7] text-[#05181C] font-semibold text-sm hover:bg-[#19DDBB] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Launch Environmental Platform
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="px-5 py-3 rounded-lg border border-white/15 bg-[#102334] text-[#EAF2F8] font-medium text-sm hover:border-[#39BDF8]/60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="px-4 py-3 text-sm font-medium text-[#9CB2C5] hover:text-[#EAF2F8] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Sign In
                </button>
              </div>

              {/* Grounded Live Telemetry Strip (unboxed clean metadata) */}
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#9CB2C5]">
                {livePreview ? (
                  <>
                    <span>
                      Live Feed: <strong className="text-[#EAF2F8]">{livePreview.location.name}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">
                      CPCB NAQI{' '}
                      <strong style={{ color: livePreview.category.color }}>
                        {livePreview.aqi} ({livePreview.category.label})
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">
                      PM2.5 {livePreview.pollutants.pm25 ?? '—'} µg/m³
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Source: Open-Meteo CAMS</span>
                  </>
                ) : (
                  <span>Connecting to live Open-Meteo Copernicus CAMS &amp; WMO Weather feeds...</span>
                )}
              </div>
            </div>

            {/* Dominant Hero Visual Frame */}
            <div className="lg:col-span-6 relative rounded-xl overflow-hidden border border-white/10 bg-[#102334] min-h-[320px] lg:min-h-[420px]">
              <img
                src="/src/assets/images/hero_smart_city_air_1795202591366.jpg"
                alt="Twilight aerial skyline of a sustainable smart city with landscaped parks and clean electric transit corridors"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08131F]/90 via-[#08131F]/25 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-[#9CB2C5]">Real-Time Geospatial + Multi-Agent Command</p>
                  <p className="font-display text-lg font-semibold text-[#EAF2F8]">
                    Live AQI, 72-Hour Forecasting &amp; Urban Digital Twin
                  </p>
                </div>
                {livePreview && (
                  <div className="text-right font-mono-num">
                    <div className="text-2xl font-bold" style={{ color: livePreview.category.color }}>
                      {livePreview.aqi}
                    </div>
                    <div className="text-xs text-[#EAF2F8]">{livePreview.location.name}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Asymmetric Bento Section */}
      <section id="capabilities" className="max-w-[1280px] mx-auto px-6 py-20 border-b border-white/10">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-medium text-[#39BDF8] mb-2">Integrated Platform Modules</p>
          <h2 className="font-display text-3xl font-bold text-[#EAF2F8]" style={{ textWrap: 'balance' }}>
            From street-level maps to indoor filtration and clean commutes.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Marquee Capability 1 */}
          <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#14283A] overflow-hidden flex flex-col">
            <div className="h-56 relative bg-[#102334]">
              <img
                src="/src/assets/images/indoor_clean_living_1795202590158.jpg"
                alt="Modern apartment living room equipped with a HEPA air purifier and indoor plants"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#14283A] via-transparent to-transparent" />
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#9CB2C5]">
                <span>Indoor Air Optimizer</span>
                <span aria-hidden="true">·</span>
                <span>Family Protection Engine</span>
              </div>
              <h3 className="font-display text-xl font-semibold text-[#EAF2F8]">
                Room-wise CADR sizing, ventilation timing, and age-group daily plans
              </h3>
              <p className="text-sm text-[#9CB2C5] leading-relaxed">
                Calculate exact HEPA Clean Air Delivery Rates (4–5 ACH) for bedrooms, kitchens, and living areas, sync
                window ventilation to the cleanest diurnal hours, and generate tailored non-medical precaution routines
                for children, adults, and older adults.
              </p>
            </div>
          </div>

          {/* Marquee Capability 2 */}
          <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#14283A] overflow-hidden flex flex-col">
            <div className="h-56 relative bg-[#102334]">
              <img
                src="/src/assets/images/green_transit_corridor_1795202590655.jpg"
                alt="Tree-lined urban cycling boulevard beside a clean electric tramway"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#14283A] via-transparent to-transparent" />
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#9CB2C5]">
                <span>Smart Mobility</span>
                <span aria-hidden="true">·</span>
                <span>Sustainability Analytics</span>
              </div>
              <h3 className="font-display text-xl font-semibold text-[#EAF2F8]">
                Compare route exposure and CO₂ savings side by side
              </h3>
              <p className="text-sm text-[#9CB2C5] leading-relaxed">
                Evaluate metro, electric bus, EV, carpool, cycling, and walking using transparent India GHG / IPCC
                emission factors alongside live PM2.5 inhalation estimates.
              </p>
            </div>
          </div>

          {/* Supporting Capabilities Row */}
          <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#102334] p-6 space-y-2.5">
            <Compass className="w-5 h-5 text-[#00C9A7]" />
            <h3 className="font-display text-lg font-semibold text-[#EAF2F8]">Interactive Geospatial Map</h3>
            <p className="text-sm text-[#9CB2C5] leading-relaxed">
              Explore OpenStreetMap layers for AQI zones, PM2.5/PM10 heat overlays, wind vectors, green buffers,
              community reports, and station confidence indicators.
            </p>
          </div>
          <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#102334] p-6 space-y-2.5">
            <Layers className="w-5 h-5 text-[#39BDF8]" />
            <h3 className="font-display text-lg font-semibold text-[#EAF2F8]">Urban Pollution Digital Twin</h3>
            <p className="text-sm text-[#9CB2C5] leading-relaxed">
              Test what-if policy levers — traffic reduction, transit shift, canopy expansion, and open waste burning
              controls — with clearly labeled simulation assumptions.
            </p>
          </div>
          <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#102334] p-6 space-y-2.5">
            <Wind className="w-5 h-5 text-[#00C9A7]" />
            <h3 className="font-display text-lg font-semibold text-[#EAF2F8]">Multilingual Gemini RAG Assistant</h3>
            <p className="text-sm text-[#9CB2C5] leading-relaxed">
              Converse in English, Hindi (हिन्दी), or Odia (ଓଡ଼ିଆ) with grounded citations from CPCB, WHO 2021, and EPA
              guidelines plus live tool execution traces.
            </p>
          </div>
        </div>
      </section>

      {/* Multi-Agent Architecture Section */}
      <section id="agents" className="max-w-[1280px] mx-auto px-6 py-20 border-b border-white/10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-[#00C9A7] mb-2">Multi-Agent Orchestration</p>
            <h2 className="font-display text-3xl font-bold text-[#EAF2F8]" style={{ textWrap: 'balance' }}>
              One Central Orchestrator coordinating eight specialized backend agents.
            </h2>
          </div>
          <p className="text-sm text-[#9CB2C5] max-w-md">
            Every query routes through validated backend tools in parallel, retrieves semantic RAG citations via Gemini
            embeddings, and logs a transparent execution trace.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AGENTS_OVERVIEW.map((agent) => (
            <div key={agent.num} className="rounded-xl border border-white/10 bg-[#14283A] p-5 space-y-2">
              <div className="font-mono-num text-xs text-[#39BDF8]">{agent.num}</div>
              <h3 className="font-display text-base font-semibold text-[#EAF2F8]">{agent.name}</h3>
              <p className="text-sm text-[#9CB2C5] leading-relaxed">{agent.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works & Standards Attribution */}
      <section id="workflow" className="max-w-[1280px] mx-auto px-6 py-20 border-b border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-6 space-y-6">
            <p className="text-sm font-medium text-[#39BDF8]">How AIRWISE Works</p>
            <h2 className="font-display text-3xl font-bold text-[#EAF2F8]" style={{ textWrap: 'balance' }}>
              Verified environmental science, never guessed numbers.
            </h2>
            <ol className="space-y-5 pt-2">
              <li className="border-t border-white/10 pt-4">
                <div className="font-display font-semibold text-[#EAF2F8]">
                  01. Live Atmospheric &amp; Weather Ingestion
                </div>
                <p className="text-sm text-[#9CB2C5] mt-1">
                  Queries Open-Meteo Copernicus CAMS and WMO weather streams for PM2.5, PM10, NO₂, SO₂, CO, O₃, wind,
                  and humidity with observation timestamps and freshness tracking.
                </p>
              </li>
              <li className="border-t border-white/10 pt-4">
                <div className="font-display font-semibold text-[#EAF2F8]">
                  02. Chronological Forecast Backtesting &amp; Anomaly Detection
                </div>
                <p className="text-sm text-[#9CB2C5] mt-1">
                  Evaluates an 80/20 chronological split on observed history to report real MAE and RMSE alongside
                  Z-score spike detection and nocturnal inversion smog indicators.
                </p>
              </li>
              <li className="border-t border-white/10 pt-4">
                <div className="font-display font-semibold text-[#EAF2F8]">
                  03. Grounded Multi-Agent Synthesis
                </div>
                <p className="text-sm text-[#9CB2C5] mt-1">
                  Combines real tool results with CPCB/WHO/EPA RAG citations to produce clear schedules, indoor
                  filtration targets, and clean commute recommendations.
                </p>
              </li>
            </ol>
          </div>

          <div id="standards" className="lg:col-span-6 rounded-xl border border-white/10 bg-[#102334] p-8 space-y-6">
            <div className="flex items-center gap-2 text-[#00C9A7]">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm font-semibold">Environmental Benchmarks &amp; Attribution</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="space-y-1">
                <div className="font-mono-num text-2xl font-bold text-[#EAF2F8]">15 µg/m³</div>
                <div className="text-xs font-medium text-[#39BDF8]">WHO 2021 PM2.5 24-Hour Guideline</div>
                <p className="text-xs text-[#9CB2C5] leading-relaxed">
                  World Health Organization Global Air Quality Guidelines (2021) reference threshold.
                </p>
              </div>
              <div className="space-y-1">
                <div className="font-mono-num text-2xl font-bold text-[#EAF2F8]">6 Bands</div>
                <div className="text-xs font-medium text-[#00C9A7]">CPCB Indian NAQI Standard</div>
                <p className="text-xs text-[#9CB2C5] leading-relaxed">
                  Linear sub-index breakpoints across PM2.5, PM10, NO₂, SO₂, CO, and O₃ (Good 0–50 to Severe 401–500).
                </p>
              </div>
              <div className="space-y-1">
                <div className="font-mono-num text-2xl font-bold text-[#EAF2F8]">192 g/km</div>
                <div className="text-xs font-medium text-[#F59E0B]">Petrol Car CO₂ Baseline</div>
                <p className="text-xs text-[#9CB2C5] leading-relaxed">
                  India GHG Program / IPCC passenger emission factor benchmarked against Metro (32 g/km) &amp; Bus (28 g/km).
                </p>
              </div>
              <div className="space-y-1">
                <div className="font-mono-num text-2xl font-bold text-[#EAF2F8]">4–5 ACH</div>
                <div className="text-xs font-medium text-[#39BDF8]">US EPA / ASHRAE Filtration Target</div>
                <p className="text-xs text-[#9CB2C5] leading-relaxed">
                  Recommended air changes per hour for True HEPA H13 indoor particle reduction during haze events.
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onEnterPlatform}
                className="w-full py-3 rounded-lg bg-[#00C9A7] text-[#05181C] font-semibold text-sm hover:bg-[#19DDBB] transition-colors cursor-pointer"
              >
                Open Live Environmental Intelligence Dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="max-w-[1280px] mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9CB2C5]">
        <div className="font-display font-semibold text-[#EAF2F8]">AIRWISE AI</div>
        <div>
          Environmental guidance only — not a medical diagnostic tool. Atmospheric data via Open-Meteo Copernicus CAMS &amp;
          WMO.
        </div>
      </footer>
    </div>
  );
}
