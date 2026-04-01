import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConnectionStatusBadge } from '../ConnectionStatusBadge'

describe('ConnectionStatusBadge', () => {
  it('shows offline state with queued changes', () => {
    render(
      <ConnectionStatusBadge
        isOffline
        isPushEnabled
        isPushConnected={false}
        pendingCount={3}
        isReplaying={false}
      />,
    )

    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute(
      'title',
      'Sync status: Offline. 3 queued changes will sync once you reconnect.',
    )
  })

  it('shows reconnecting when push is degraded', () => {
    render(
      <ConnectionStatusBadge
        isOffline={false}
        isPushEnabled
        isPushConnected={false}
        pendingCount={0}
        isReplaying={false}
      />,
    )

    expect(screen.getByText('Reconnecting')).toBeInTheDocument()
  })

  it('shows live sync when push is healthy', () => {
    render(
      <ConnectionStatusBadge
        isOffline={false}
        isPushEnabled
        isPushConnected
        pendingCount={0}
        isReplaying={false}
      />,
    )

    expect(screen.getByText('Live sync')).toBeInTheDocument()
  })

  it('shows manual sync when push is unavailable', () => {
    render(
      <ConnectionStatusBadge
        isOffline={false}
        isPushEnabled={false}
        isPushConnected={false}
        pendingCount={0}
        isReplaying={false}
      />,
    )

    expect(screen.getByText('Manual sync')).toBeInTheDocument()
  })
})
