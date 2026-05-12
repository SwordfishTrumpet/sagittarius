import type { ReactNode } from 'react'
import { AlertCircle, Clock3, RotateCw, Wifi, WifiOff } from 'lucide-react'

interface ConnectionStatusBadgeProps {
  isOffline: boolean
  isPushEnabled: boolean
  isPushConnected: boolean
  pendingCount: number
  isReplaying: boolean
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
}: ConnectionStatusBadgeProps): BadgeConfig {
  if (isOffline) {
    return {
      label: 'Offline',
      detail: pendingCount > 0
        ? `${pendingCount} queued change${pendingCount === 1 ? '' : 's'} will sync once you reconnect.`
        : 'Showing cached mail until the network returns.',
      icon: <WifiOff className="h-3.5 w-3.5" strokeWidth={1.75} />,
      className: 'bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/15',
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
      className: 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/15',
      count: pendingCount > 0 ? pendingCount : undefined,
    }
  }

  if (pendingCount > 0) {
    return {
      label: 'Pending sync',
      detail: `${pendingCount} queued change${pendingCount === 1 ? '' : 's'} waiting to sync.`,
      icon: <Clock3 className="h-3.5 w-3.5" strokeWidth={1.75} />,
      className: 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/15',
      count: pendingCount,
    }
  }

  if (isPushEnabled && !isPushConnected) {
    return {
      label: 'Reconnecting',
      detail: 'Live push updates are degraded while Sagittarius reconnects in the background.',
      icon: <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} />,
      className: 'bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/15',
    }
  }

  if (isPushEnabled) {
    return {
      label: 'Live sync',
      detail: 'Push connection is healthy and updates should arrive in real time.',
      icon: <Wifi className="h-3.5 w-3.5" strokeWidth={1.75} />,
      className: 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/15',
    }
  }

  return {
    label: 'Manual sync',
    detail: 'This server does not expose push updates, so refresh happens without a live connection.',
    icon: <WifiOff className="h-3.5 w-3.5" strokeWidth={1.75} />,
    className: 'bg-[#8E8E93]/10 text-[#8E8E93] border-[#8E8E93]/15',
  }
}

export function ConnectionStatusBadge(props: ConnectionStatusBadgeProps) {
  const { label, detail, icon, className, count } = getBadgeConfig(props)

  return (
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
  )
}
