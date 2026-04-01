import React, { useState } from 'react';
import { jmapClient } from '../api/jmap';
import { Shield, Mail, Key } from 'lucide-react';
import { logger } from '../utils/logger';

export function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await jmapClient.authenticate(username, password);
      onLoginSuccess();
    } catch (err) {
      setError('Failed to authenticate. Please check your credentials.');
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#F2F2F7] flex items-center justify-center z-50 p-4">
      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl border border-[#E5E5E5] rounded-2xl shadow-2xl p-8 overflow-hidden relative">
        {/* Apple Style Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#007AFF] to-[#5856D6]" />
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-white shadow-md rounded-2xl flex items-center justify-center mb-6 border border-[#E5E5E5]">
             <span className="text-[#007AFF] text-7xl font-black leading-none">♐︎</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[#1C1C1E]">Sagittarius</h2>
          <p className="text-[#8E8E93] mt-2 text-center text-sm">Sign in to your mail account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-username" className="text-xs font-semibold text-[#8E8E93] px-1 uppercase tracking-wider">Email or username</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93]" />
              <input 
                id="login-username"
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#E5E5E5]/40 border-none rounded-xl py-3 pl-10 pr-4 text-[15px] focus:ring-2 focus:ring-[#007AFF]/20 transition-all placeholder-[#8E8E93]"
                placeholder="name or email"
                required
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-xs font-semibold text-[#8E8E93] px-1 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93]" />
              <input 
                id="login-password"
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#E5E5E5]/40 border-none rounded-xl py-3 pl-10 pr-4 text-[15px] focus:ring-2 focus:ring-[#007AFF]/20 transition-all placeholder-[#8E8E93]"
                placeholder="Password"
                required
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
          </div>

          {error && (
            <div id="login-error" role="alert" className="bg-red-50 text-red-500 text-xs py-2 px-3 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#007AFF] hover:bg-[#0071e3] disabled:bg-[#007AFF]/50 text-white font-semibold py-3 rounded-xl shadow-lg shadow-[#007AFF]/20 transition-all transform active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
