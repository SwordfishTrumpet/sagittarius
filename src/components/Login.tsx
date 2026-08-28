import React, { useState, useEffect } from 'react';
import { jmapClient } from '../api/jmap';
import { Shield, Mail, Key, Lock, AlertTriangle } from 'lucide-react';
import { logger } from '../utils/logger';
import { checkRateLimit, recordFailedAttempt, resetRateLimit, getRateLimitStatus } from '../utils/rateLimit';
import { isServerUnreachableError } from '../utils/jmapErrors';
import {
  isServerIdentityChangedError,
  type ServerIdentityChangedError,
} from '../utils/serverFingerprint';

export function Login({ onLoginSuccess, identityChangedNotice = false }: {
  onLoginSuccess: () => void;
  /** Shown when the boot check invalidated a stored session because the backend identity changed. */
  identityChangedNotice?: boolean;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [pendingIdentityChange, setPendingIdentityChange] = useState<ServerIdentityChangedError | null>(null);

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

  // Shared error handler: identity-change requires confirmation; server
  // unreachable is NOT a credential problem (never counts against the auth
  // rate limiter); only real auth/protocol failures do.
  const handleAuthError = (err: unknown) => {
    if (isServerIdentityChangedError(err)) {
      setPendingIdentityChange(err);
      return;
    }
    if (isServerUnreachableError(err)) {
      setError('Mail server unreachable. Please check the connection and try again.');
      return;
    }
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
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPendingIdentityChange(null);

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
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  // Explicit user confirmation that the mail server identity really changed
  // (issue #1): credentials are ONLY sent after this explicit step.
  const confirmIdentityChange = async () => {
    setLoading(true);
    setError(null);
    try {
      await jmapClient.authenticate(username, password, { confirmIdentityChange: true });
      resetRateLimit();
      onLoginSuccess();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
      setPendingIdentityChange(null);
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
          {identityChangedNotice && (
            <div role="alert" className="bg-icloud-orange/10 text-icloud-orange text-sm py-3 px-4 rounded-xl border border-icloud-orange/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>The mail server's identity changed since your last sign-in. Sign in again to continue — you'll be asked to confirm the new server before any credentials are sent.</span>
            </div>
          )}

          {pendingIdentityChange && (
            <div role="alert" className="bg-icloud-orange/10 text-icloud-orange text-sm py-3 px-4 rounded-xl border border-icloud-orange/20 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong className="font-semibold">The mail server identity has changed.</strong>{' '}
                  The mail server you previously signed into was <span className="font-mono">{pendingIdentityChange.previousFingerprint?.host ?? 'unknown'}</span>{' '}
                  and now answers as <span className="font-mono">{pendingIdentityChange.currentFingerprint.host ?? 'unknown'}</span>.
                  Signing in will send your credentials to the new server.
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingIdentityChange(null)}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmIdentityChange()}
                  disabled={loading}
                  className="rounded-lg bg-icloud-orange px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-icloud-orange/90 disabled:opacity-50"
                >
                  Continue sign-in
                </button>
              </div>
            </div>
          )}

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
