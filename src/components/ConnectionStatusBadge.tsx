import type { ReactNode } from 'react'
import { AlertCircle, Clock3, RotateCw, Wifi, WifiOff } from 'lucide-react'

interface ConnectionStatusBadgeProps {
  isOffline: boolean
  isPushEnabled: boolean
  isPushConnected: boolean
  pendingCount: number
  isReplaying: boolean
  /** Circuit breaker tripped: the mail server appears unreachable (issue #3). */
  isPushTerminal?: boolean
  /** Manual retry affordance shown in the terminal state. */
  onRetry?: () => void
}

interface BadgeConfig {
  label: string
  detail: string
  icon: ReactNode
  className: string
  count?: number
}

function getBadgeConfig({
  isOffline,
  isPushEnabled,
  isPushConnected,
  pendingCount,
  isReplaying,
  isPushTerminal,
}: ConnectionStatusBadgeProps): BadgeConfig {
  if (isOffline) {
    return {
      label: 'Offline',
      detail: pendingCount > 0
        ? `${pendingCount} queued change${pendingCount === 1 ? '' : 's'} will sync once you reconnect.`
        : 'Showing cached mail until the network returns.',
      icon: <WifiOff className="h-3.5 w-3.5" strokeWidth={1.75} />,
      className: 'bg-icloud-orange/10 text-icloud-orange border-icloud-orange/15',
      count: pendingCount > 0 ? pendingCount : undefined,
    }
  }

  if (isReplaying) {
    return {
      label: 'Syncing',
      detail: pendingCount > 0
        ? `Syncing ${pendingCount} queued change${pendingCount === 1 ? '' : 's'} now.`
        : 'Queued changes are syncing now.',
      icon: <RotateCw className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />,
      className: 'bg-icloud-accent/10 text-icloud-accent border-icloud-accent/15',
      count: pendingCount > 0 ? pendingCount : undefined,
    }
  }

  if (pendingCount > 0) {
    return {
      label: 'Pending sync',
      detail: `${pendingCount} queued change${pendingCount === 1 ? '' : 's'} waiting to sync.`,
      icon: <Clock3 className="h-3.5 w-3.5" strokeWidth={1.75} />,
      className: 'bg-icloud-accent/10 text-icloud-accent border-icloud-accent/15',
      count: pendingCount,
    }
  }

  if (isPushEnabled && isPushTerminal) {
    return {
      label: 'Server unreachable',
      detail: 'The mail server cannot be reached. Use Retry to try again.',
      icon: <WifiOff className="h-3.5 w-3.5" strokeWidth={1.75} />,
      className: 'bg-icloud-red/10 text-icloud-red border-icloud-red/15',
    }
  }

  if (isPushEnabled && !isPushConnected) {
    return {
      label: 'Reconnecting',
      detail: 'Live push updates are degraded while Sagittarius reconnects in the background.',
      icon: <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} />,
      className: 'bg-icloud-orange/10 text-icloud-orange border-icloud-orange/15',
    }
  }

  if (isPushEnabled) {
    return {
      label: 'Live sync',
      detail: 'Push connection is healthy and updates should arrive in real time.',
      icon: <Wifi className="h-3.5 w-3.5" strokeWidth={1.75} />,
      className: 'bg-icloud-green/10 text-icloud-green border-icloud-green/15',
    }
  }

  return {
    label: 'Manual sync',
    detail: 'This server does not expose push updates, so refresh happens without a live connection.',
    icon: <WifiOff className="h-3.5 w-3.5" strokeWidth={1.75} />,
    className: 'bg-icloud-text-tertiary/10 text-icloud-text-secondary border-icloud-text-tertiary/15',
  }
}

export function ConnectionStatusBadge(props: ConnectionStatusBadgeProps) {
  const { label, detail, icon, className, count } = getBadgeConfig(props)
  const { isPushTerminal, onRetry } = props

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        role="status"
        aria-live="polite"
        aria-label={`Sync status: ${label}. ${detail}`}
        title={`Sync status: ${label}. ${detail}`}
        className={`inline-flex select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}
      >
        {icon}
        <span>{label}</span>
        {count ? (
          <span className="min-w-[16px] rounded-full bg-white/70 dark:bg-white/20 px-1.5 py-px text-center text-[10px] font-bold leading-none text-current">
            {count}
          </span>
        ) : null}
      </span>
      {isPushTerminal && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry mail server connection"
          className="inline-flex items-center gap-1 rounded-full border border-icloud-red/15 bg-icloud-red/10 px-2.5 py-1 text-[11px] font-semibold text-icloud-red transition-colors hover:bg-icloud-red/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-icloud-red/40"
        >
          <RotateCw className="h-3 w-3" strokeWidth={1.75} />
          Retry
        </button>
      ) : null}
    </span>
  )
}
