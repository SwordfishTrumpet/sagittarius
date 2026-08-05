/**
 * AccountProvider tests — BUG-2026-045 (the provider must sync the active
 * account into jmapClient so every getPrimaryAccount() call site becomes
 * account-aware) and BUG-2026-046 (switch timer cleanup).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { makeSession } from '../../test/fixtures/jmap'

const { setActiveAccountId } = vi.hoisted(() => ({
  setActiveAccountId: vi.fn(),
}))

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getSession: vi.fn(),
    getPrimaryAccount: vi.fn(() => 'primary-mail'),
    setActiveAccountId,
  },
}))

import { AccountProvider } from '../useAccountManager'

describe('AccountProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  function renderProvider() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    return render(
      <Wrapper>
        <AccountProvider>
          <div>child</div>
        </AccountProvider>
      </Wrapper>,
    )
  }

  it('renders children', () => {
    renderProvider()
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('syncs the active account id into jmapClient (BUG-2026-045)', async () => {
    // Mock a session with two accounts
    const session = makeSession()
    const { jmapClient } = await import('../../api/jmap')
    ;(jmapClient.getSession as ReturnType<typeof vi.fn>).mockReturnValue(session)
    ;(jmapClient.getPrimaryAccount as ReturnType<typeof vi.fn>).mockReturnValue('account-1')

    renderProvider()

    // The provider's effect must push the resolved active account into the client
    expect(setActiveAccountId).toHaveBeenCalled()
    const syncedId = setActiveAccountId.mock.calls[0][0]
    expect(syncedId).toBeTruthy()
  })
})
