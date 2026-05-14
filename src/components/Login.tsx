import React, { useState, useEffect } from 'react';
import { jmapClient } from '../api/jmap';
import { Shield, Mail, Key, Lock } from 'lucide-react';
import { logger } from '../utils/logger';
import { checkRateLimit, recordFailedAttempt, resetRateLimit, getRateLimitStatus } from '../utils/rateLimit';

export function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  // Check rate limit on mount and periodically
  useEffect(() => {
    const checkLimit = () => {
      const status = getRateLimitStatus();
      setLockoutSeconds(status.lockoutSeconds);
      if (status.isLocked) {
        setError(`Too many failed attempts. Please try again in ${Math.ceil(status.lockoutSeconds! / 60)} minutes.`);
      }
    };

    checkLimit();
    const interval = setInterval(checkLimit, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Check rate limit before attempting
    const rateLimitSeconds = checkRateLimit();
    if (rateLimitSeconds) {
      setError(`Too many failed attempts. Please try again in ${Math.ceil(rateLimitSeconds / 60)} minutes.`);
      setLockoutSeconds(rateLimitSeconds);
      setLoading(false);
      return;
    }

    try {
      await jmapClient.authenticate(username, password);
      // Reset rate limit on successful login
      resetRateLimit();
      onLoginSuccess();
    } catch (err) {
      // Record failed attempt
      const remaining = recordFailedAttempt();
      const status = getRateLimitStatus();

      if (status.isLocked) {
        setError(`Too many failed attempts. Please try again in ${Math.ceil(status.lockoutSeconds! / 60)} minutes.`);
        setLockoutSeconds(status.lockoutSeconds);
      } else {
        setError(`Failed to authenticate. Please check your credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
      }
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-icloud-bg-layer1 bg-icloud-bg-primary flex items-center justify-center z-50 p-4">
      <div className="max-w-md w-full bg-white/80 bg-icloud-bg-primary/80 backdrop-blur-xl border border-icloud-border rounded-2xl shadow-2xl p-8 overflow-hidden relative dark:bg-icloud-bg-layer2/80">
        {/* Apple Style Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-icloud-accent to-purple-600" />
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-icloud-card shadow-md rounded-2xl flex items-center justify-center mb-6 border border-icloud-border">
             <span className="text-icloud-accent text-7xl font-black leading-none">♐︎</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-icloud-text-primary">Sagittarius</h1>
          <p className="text-icloud-text-secondary  mt-2 text-center text-sm">Sign in to your mail account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {lockoutSeconds && (
            <div className="bg-icloud-orange/10 text-icloud-orange text-sm py-3 px-4 rounded-xl border border-icloud-orange/20 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Account temporarily locked. Try again in {Math.ceil(lockoutSeconds / 60)} minutes.</span>
            </div>
          )}
          
          <div className="space-y-1.5">
            <label htmlFor="login-username" className="text-xs font-semibold text-icloud-text-secondary  px-1 uppercase tracking-wider">Email or username</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-icloud-text-secondary/60" />
              <input 
                id="login-username"
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-icloud-border/40 /40 border-none rounded-xl py-3 pl-10 pr-4 text-[15px] text-icloud-text-primary focus:ring-2 focus:ring-icloud-accent transition-all placeholder-icloud-text-secondary  disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="name or email"
                required
                disabled={!!lockoutSeconds}
                aria-describedby={error ? 'login-error' : undefined}
                autoComplete="username"
                aria-invalid={error ? 'true' : 'false'}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-xs font-semibold text-icloud-text-secondary  px-1 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-icloud-text-secondary/60" />
              <input 
                id="login-password"
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-icloud-border/40 /40 border-none rounded-xl py-3 pl-10 pr-4 text-[15px] text-icloud-text-primary focus:ring-2 focus:ring-icloud-accent transition-all placeholder-icloud-text-secondary  disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Password"
                required
                disabled={!!lockoutSeconds}
                aria-describedby={error ? 'login-error' : undefined}
                autoComplete="current-password"
                aria-invalid={error ? 'true' : 'false'}
              />
            </div>
          </div>

          {error && (
            <div id="login-error" role="alert" className="bg-icloud-red/10 text-icloud-red text-xs py-2 px-3 rounded-lg border border-icloud-red/20 animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || !!lockoutSeconds}
            className="w-full bg-icloud-accent hover:bg-icloud-accent-hover disabled:bg-icloud-accent/50 text-white font-semibold py-3 rounded-xl shadow-lg shadow-icloud-accent/20 transition-all transform active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : lockoutSeconds ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Locked</span>
              </>
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
