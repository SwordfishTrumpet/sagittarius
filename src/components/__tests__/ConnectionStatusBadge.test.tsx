import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('shows Pending sync with a count for queued sends while the backend is down', () => {
    render(
      <ConnectionStatusBadge
        isOffline={false}
        isPushEnabled
        isPushConnected={false}
        pendingCount={2}
        isReplaying={false}
      />,
    )

    expect(screen.getByText('Pending sync')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows a terminal Server unreachable state distinct from Reconnecting', () => {
    render(
      <ConnectionStatusBadge
        isOffline={false}
        isPushEnabled
        isPushConnected={false}
        isPushTerminal
        pendingCount={0}
        isReplaying={false}
      />,
    )

    expect(screen.getByText('Server unreachable')).toBeInTheDocument()
    expect(screen.queryByText('Reconnecting')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute(
      'title',
      'Sync status: Server unreachable. The mail server cannot be reached. Use Retry to try again.',
    )
  })

  it('shows a Retry affordance in the terminal state and fires it on click', () => {
    const onRetry = vi.fn()
    render(
      <ConnectionStatusBadge
        isOffline={false}
        isPushEnabled
        isPushConnected={false}
        isPushTerminal
        onRetry={onRetry}
        pendingCount={0}
        isReplaying={false}
      />,
    )

    const retryButton = screen.getByRole('button', { name: /retry mail server connection/i })
    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('does not show a Retry affordance without an onRetry handler', () => {
    render(
      <ConnectionStatusBadge
        isOffline={false}
        isPushEnabled
        isPushConnected={false}
        isPushTerminal
        pendingCount={0}
        isReplaying={false}
      />,
    )

    expect(screen.queryByRole('button', { name: /retry mail server connection/i })).not.toBeInTheDocument()
  })
})
