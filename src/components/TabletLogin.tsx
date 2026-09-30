import React, { useState } from 'react';
import { AppUser } from '../types/gmao';
import { THERMOPLASTICS_LOGO } from '../constants/logo';
import { ShieldCheck, User, Lock, Tablet } from 'lucide-react';

interface TabletLoginProps {
  onLogin: (user: AppUser) => void;
}

export default function TabletLogin({ onLogin }: TabletLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 4) {
      setError('Le mot de passe doit contenir au moins 4 caractères');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, isMobile: true }),
      });

      const contentType = res.headers.get('content-type');
      let data: any;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = { error: await res.text() };
      }

      if (!res.ok) throw new Error(data.error || 'Authentification échouée');

      // Only set the tablet session — never touches the desktop session
      onLogin(data.user as AppUser);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-64 max-w-full h-24 bg-white rounded-2xl shadow-lg mb-5 overflow-hidden p-4">
            <img
              src={THERMOPLASTICS_LOGO}
              alt="Thermoplastics Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  parent.innerHTML = '<div class="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold text-2xl">T</div>';
                }
              }}
            />
          </div>
          <h1 className="text-2xl font-black text-white">Connexion Technicien</h1>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-center mb-6">
            <div className="p-3 bg-slate-700 rounded-full">
              <ShieldCheck className="text-emerald-400" size={24} />
            </div>
          </div>

          {error && (
            <div className="mb-5 p-4 bg-red-900/40 border border-red-700 rounded-xl text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Identifiant
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Nom d'utilisateur"
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[52px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Se Connecter</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Session tablette
        </p>
      </div>
    </div>
  );
}
