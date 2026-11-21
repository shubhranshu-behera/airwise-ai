import { X } from 'lucide-react';
import { useState } from 'react';
import { api, setAuthToken } from '../lib/api';
import type { UserAccountPublic } from '../types';

interface AuthModalProps {
  initialMode: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: UserAccountPublic) => void;
}

export function AuthModal({ initialMode, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'citizen' | 'community_lead'>('citizen');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      setError(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="AIRWISE AI Account Authentication"
    >
      <div className="w-full max-w-md rounded-xl border border-white/15 bg-[#102334] text-[#EAF2F8] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-xl font-bold">
              {mode === 'login' ? 'Sign in to AIRWISE AI' : 'Create your AIRWISE account'}
            </h2>
            <p className="text-xs text-[#9CB2C5] mt-1">
              Save family profiles, indoor rooms, eco logs, and personalized thresholds.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-2 rounded-lg text-[#9CB2C5] hover:text-[#EAF2F8] hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switch */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#08131F] mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === 'login' ? 'bg-[#14283A] text-[#EAF2F8]' : 'text-[#9CB2C5] hover:text-[#EAF2F8]'
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
            className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === 'register' ? 'bg-[#14283A] text-[#EAF2F8]' : 'text-[#9CB2C5] hover:text-[#EAF2F8]'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-[#9CB2C5] mb-1.5">Full Name</label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#08131F] border border-white/15 text-sm text-[#EAF2F8] focus:outline-none focus:border-[#00C9A7]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#9CB2C5] mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#08131F] border border-white/15 text-sm text-[#EAF2F8] focus:outline-none focus:border-[#00C9A7]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9CB2C5] mb-1.5">Password (min 8 characters)</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#08131F] border border-white/15 text-sm text-[#EAF2F8] focus:outline-none focus:border-[#00C9A7]"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-[#9CB2C5] mb-1.5">Account Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'citizen' | 'community_lead')}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#08131F] border border-white/15 text-sm text-[#EAF2F8] focus:outline-none focus:border-[#00C9A7]"
              >
                <option value="citizen">Citizen / Family Member</option>
                <option value="community_lead">Community Clean-Air Lead (Moderation Enabled)</option>
              </select>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs text-[#FCA5A5]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#00C9A7] text-[#05181C] font-semibold text-sm hover:bg-[#19DDBB] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
