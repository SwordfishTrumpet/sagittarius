import { WifiOff, RotateCw, LogOut } from 'lucide-react';

interface ServerUnreachableScreenProps {
  /** Configured backend hostname shown to the user (may be null if unknown). */
  host: string | null;
  /** Re-run the boot reachability check. */
  onRetry: () => void;
  /** Clear the stored session and return to the login screen. */
  onSignOut: () => void;
  /** True while the retry check is running. */
  isChecking?: boolean;
}

/**
 * Full-screen "Mail server unreachable" state (issue #6). Shown at boot when
 * the identity/reachability check determines the configured backend host no
 * longer resolves. Mirrors the Login screen aesthetics; offers Retry (re-run
 * the check) and Sign Out (drop to login without a reload) so users are not
 * stranded in a dead session with a misleadingly healthy-looking UI.
 */
export function ServerUnreachableScreen({
  host,
  onRetry,
  onSignOut,
  isChecking = false,
}: ServerUnreachableScreenProps) {
  return (
    <div className="fixed inset-0 bg-icloud-bg-layer1 bg-icloud-bg-primary flex items-center justify-center z-50 p-4">
      <div
        role="alert"
        aria-live="polite"
        className="max-w-md w-full bg-white/80 bg-icloud-bg-primary/80 backdrop-blur-xl border border-icloud-border rounded-2xl shadow-2xl p-8 overflow-hidden relative dark:bg-icloud-bg-layer2/80"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-icloud-orange to-icloud-red" />

        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-icloud-card shadow-md rounded-2xl flex items-center justify-center mb-6 border border-icloud-border">
            <WifiOff className="w-9 h-9 text-icloud-orange" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-icloud-text-primary">
            Mail server unreachable
          </h1>
          <p className="text-icloud-text-secondary mt-2 text-center text-sm">
            We can't reach your mail server. Your messages are safe — this is
            a connection problem, not a problem with your account.
          </p>
          {host && (
            <p className="mt-2 text-center text-xs text-icloud-text-tertiary">
              Configured server: <span className="font-mono">{host}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            disabled={isChecking}
            className="w-full bg-icloud-accent hover:bg-icloud-accent-hover disabled:bg-icloud-accent/50 text-white font-semibold py-3 rounded-xl shadow-lg shadow-icloud-accent/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isChecking ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <RotateCw className="w-4 h-4" />
            )}
            <span>{isChecking ? 'Checking…' : 'Retry'}</span>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            disabled={isChecking}
            className="w-full bg-icloud-card hover:bg-icloud-divider text-icloud-text-primary font-semibold py-3 rounded-xl border border-icloud-border transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogOut className="w-4 h-4 text-icloud-text-secondary" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
