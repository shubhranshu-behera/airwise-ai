import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { api, setAuthToken } from '../lib/api';
import type { CurrentEnvironmentData, UserAccountPublic } from '../types';

interface AuthPageProps {
  initialMode: 'login' | 'register';
  currentEnv: CurrentEnvironmentData | null;
  onSuccess: (user: UserAccountPublic) => void;
  onContinueGuest: () => void;
}

export function AuthPage({ initialMode, currentEnv, onSuccess, onContinueGuest }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'citizen' | 'community_lead'>('citizen');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await api.register({ name, email, password, role });
        setAuthToken(res.token);
        onSuccess(res.user);
      } else {
        const res = await api.login({ email, password });
        setAuthToken(res.token);
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-[var(--aw-border)] bg-[var(--aw-surface)]/90 backdrop-blur-xl overflow-hidden">
        {/* Left Visual Showcase Panel */}
        <div className="lg:col-span-5 relative min-h-[260px] lg:min-h-[580px] flex flex-col justify-between p-7 bg-[#0B1B2B] text-[#EAF2F8]">
          <img
            src="/src/assets/images/hero_smart_city_air_1795202591366.jpg"
            alt="Twilight skyline of a clean sustainable smart city"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08131F] via-[#08131F]/65 to-[#08131F]/40" />

          <div className="relative z-10 space-y-2">
            <div className="font-display text-xl font-bold tracking-tight text-[#EAF2F8]">AIRWISE AI</div>
            <p className="text-xs text-[#00C9A7] font-medium">Intelligent Air. Healthier Living.</p>
          </div>

          <div className="relative z-10 space-y-5">
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold leading-snug" style={{ textWrap: 'balance' }}>
                Personalized environmental protection for your home and commute.
              </h2>
              <p className="text-xs text-[#9CB2C5] leading-relaxed">
                Sign in or create an account to persist family age-group routines, indoor CADR room plans, green
                commute CO₂ logs, and Gemini AI conversation history.
              </p>
            </div>

            {currentEnv && (
              <div className="pt-4 border-t border-white/15 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[#9CB2C5]">Live City Reference</div>
                  <div className="font-semibold text-[#EAF2F8]">{currentEnv.location.name}</div>
                </div>
                <div className="text-right font-mono-num">
                  <div className="text-lg font-bold" style={{ color: currentEnv.category.color }}>
                    AQI {currentEnv.aqi}
                  </div>
                  <div className="text-[11px] text-[#9CB2C5]">{currentEnv.category.label}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-[#9CB2C5]">
              <ShieldCheck className="w-4 h-4 text-[#00C9A7] shrink-0" />
              <span>Passwords hashed server-side with scrypt · Zero client-side key exposure</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-6">
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-[var(--aw-text)]">
              {mode === 'login' ? 'Welcome back' : 'Create your AIRWISE account'}
            </h1>
            <p className="text-sm text-[var(--aw-text-secondary)]">
              {mode === 'login'
                ? 'Sign in to access your saved environmental profiles and Gemini AI workspace.'
                : 'Register as a Citizen or Community Clean-Air Lead in under a minute.'}
            </p>
          </div>

          {/* Segmented Sign In / Sign Up Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#00C9A7] text-[#05181C]'
                  : 'text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#00C9A7] text-[#05181C]'
                  : 'text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)]'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[var(--aw-text-secondary)] mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[var(--aw-text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Shubhranshu Behera"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)] focus:outline-none focus:border-[#00C9A7]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--aw-text-secondary)] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--aw-text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)] focus:outline-none focus:border-[#00C9A7]"
                />
              </div>
            </div>

            <div className={mode === 'register' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
              <div>
                <label className="block text-xs font-medium text-[var(--aw-text-secondary)] mb-1.5">
                  Password (min 8 chars)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--aw-text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)] focus:outline-none focus:border-[#00C9A7]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--aw-text-secondary)] hover:text-[var(--aw-text)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-[var(--aw-text-secondary)] mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[var(--aw-text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)] focus:outline-none focus:border-[#00C9A7]"
                    />
                  </div>
                </div>
              )}
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[var(--aw-text-secondary)] mb-1.5">
                  Account Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'citizen' | 'community_lead')}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)] focus:outline-none focus:border-[#00C9A7]"
                >
                  <option value="citizen">Citizen / Family Profile</option>
                  <option value="community_lead">Community Clean-Air Lead (Moderation Access)</option>
                </select>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/35 text-xs text-[#FCA5A5]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-[#00C9A7] text-[#05181C] font-semibold text-sm hover:bg-[#19DDBB] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <span>{loading ? 'Processing...' : mode === 'login' ? 'Sign In to AIRWISE AI' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-[var(--aw-border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--aw-text-secondary)]">
            <span>Want to inspect live environmental data first?</span>
            <button
              type="button"
              onClick={onContinueGuest}
              className="font-semibold text-[#39BDF8] hover:text-[#00C9A7] transition-colors cursor-pointer"
            >
              Continue to Live Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
