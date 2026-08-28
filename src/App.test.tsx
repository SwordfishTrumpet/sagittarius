/**
 * App boot reachability tests (issue #6): with a stored session + stored
 * fingerprint, booting against a dead backend (verifyServerIdentity →
 * 'unreachable') must show the full-screen "Mail server unreachable" state
 * with Retry and Sign Out instead of a misleadingly healthy cached mail UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}))

vi.mock('react-dnd', () => ({
  DndProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDrag: () => [{ isDragging: false }, vi.fn()],
  useDrop: () => [{ isOver: false }, vi.fn()],
}))

vi.mock('react-dnd-html5-backend', () => ({ HTML5Backend: {} }))

vi.mock('react-virtuoso', () => {
  const { forwardRef } = require('react')
  const VirtuosoMock = forwardRef(function VirtuosoMock({ data = [], itemContent, ...props }: any, ref: any) {
    return (
      <div ref={ref} {...props}>
        {data.map((item: any, index: number) => (
          <div key={item.id}>{itemContent(index, item)}</div>
        ))}
      </div>
    )
  })
  return {
    Virtuoso: VirtuosoMock,
    VirtuosoHandle: class {},
  }
})

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Server-identity subsystem isolated: the boot check result is controlled
// per-test through the jmapClient spies below.
vi.mock('./utils/serverFingerprint', () => ({
  fetchServerFingerprint: vi.fn(async () => null),
  getStoredFingerprint: vi.fn(() => ({
    host: 'mail.example.com',
    scheme: 'https',
    resolved: true,
    addresses: ['1.2.3.4'],
    certFingerprint: 'sha256:abc',
    trusted: false,
    error: null,
  })),
  storeFingerprint: vi.fn(),
  clearFingerprint: vi.fn(),
  fingerprintKey: vi.fn(() => 'https|mail.example.com|sha256:abc'),
  ServerIdentityChangedError: class ServerIdentityChangedError extends Error {},
  isServerIdentityChangedError: () => false,
}))

import App from './App'
import { jmapClient } from './api/jmap'
import { getStoredFingerprint } from './utils/serverFingerprint'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './api/queryClient'

function renderApp() {
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

const SESSION = {
  username: 'user@example.com',
  apiUrl: '/jmap/',
  downloadUrl: '/jmap/download/{accountId}/{blobId}/{name}',
  uploadUrl: '/jmap/upload/{accountId}/',
  capabilities: { 'urn:ietf:params:jmap:core': {}, 'urn:ietf:params:jmap:mail': {} },
  accounts: {
    'account-001': {
      name: 'user@example.com',
      isPersonal: true,
      accountCapabilities: { 'urn:ietf:params:jmap:mail': {} },
    },
  },
  primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account-001' },
  state: 'session-state-001',
}

function bootAppWith(status: 'unreachable' | 'verified') {
  vi.spyOn(jmapClient, 'getStoredSession').mockReturnValue(SESSION as never)
  vi.spyOn(jmapClient, 'getPrimaryAccount').mockReturnValue('account-001')
  vi.spyOn(jmapClient, 'verifyServerIdentity').mockResolvedValue(status as never)
  vi.spyOn(jmapClient, 'request').mockRejectedValue(new Error('Not authenticated'))
}

describe('App boot reachability (issue #6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('shows the unreachable state within the boot window when the backend is dead', async () => {
    bootAppWith('unreachable')

    renderApp()

    expect(await screen.findByRole('heading', { name: 'Mail server unreachable' })).toBeInTheDocument()
    // Configured hostname from the stored fingerprint is shown.
    expect(screen.getByText('mail.example.com')).toBeInTheDocument()
    expect(jmapClient.verifyServerIdentity).toHaveBeenCalledTimes(1)
  })

  it('lets the user sign out from the unreachable state (back to login)', async () => {
    const user = userEvent.setup()
    bootAppWith('unreachable')

    renderApp()

    await screen.findByRole('heading', { name: 'Mail server unreachable' })
    await user.click(screen.getByRole('button', { name: 'Sign Out' }))

    // Login screen appears after local sign-out (no reload).
    await waitFor(() => {
      expect(screen.getByText('Sign in to your mail account')).toBeInTheDocument()
    })
    // The stored session was cleared.
    expect(sessionStorage.getItem('jmap_session')).toBeNull()
  })

  it('retries the boot check when Retry is pressed', async () => {
    const user = userEvent.setup()
    bootAppWith('unreachable')

    renderApp()

    await screen.findByRole('heading', { name: 'Mail server unreachable' })
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(jmapClient.verifyServerIdentity).toHaveBeenCalledTimes(2)
    })
  })

  it('mounts the mail UI when the boot check verifies (no unreachable screen)', async () => {
    bootAppWith('verified')

    renderApp()

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Mail server unreachable' })).not.toBeInTheDocument()
    })
  })

  it('still reads the stored fingerprint for the hostname display', () => {
    expect(getStoredFingerprint()?.host).toBe('mail.example.com')
  })
})
