import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Settings } from '../Settings'
import { ThemeProvider } from '../../context/ThemeProvider'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
})

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    <ThemeProvider>{children}</ThemeProvider>
  </QueryClientProvider>
)

// Mock the notification sound utilities
vi.mock('../../utils/notificationSound', () => ({
  isNotificationSoundEnabled: false,
  getNotificationVolume: 0.5,
  setNotificationSoundEnabled: vi.fn(),
  setNotificationVolume: vi.fn(),
  previewNotificationSound: vi.fn(),
  isNotificationAPISupported: () => true,
  getNotificationPermission: () => 'default',
  requestNotificationPermission: vi.fn().mockResolvedValue(true),
  canShowNotifications: () => false,
}))

// Mock the vacation hook
vi.mock('../../hooks/useVacation', () => ({
  useVacation: () => ({
    data: {
      isEnabled: false,
      subject: '',
      textBody: '',
      htmlBody: '',
    },
    isLoading: false,
  }),
  useVacationActions: () => ({
    updateVacation: vi.fn(),
    isPending: false,
  }),
  useHasVacationCapability: () => true,
}))

// Mock the identities hook
vi.mock('../../hooks/jmap/useIdentities', () => ({
  useIdentities: () => ({
    data: [],
    isLoading: false,
  }),
  useIdentityActions: () => ({
    createIdentity: vi.fn(),
    updateIdentity: vi.fn(),
    deleteIdentity: vi.fn(),
    isPending: false,
  }),
  useHasIdentityCapability: () => true,
}))

// Mock the sieve hook
vi.mock('../../hooks/useSieve', () => ({
  useSieve: () => ({
    data: [],
    isLoading: false,
  }),
  useSieveActions: () => ({
    createScript: vi.fn(),
    updateScript: vi.fn(),
    deleteScript: vi.fn(),
    activateScript: vi.fn(),
    validateScript: vi.fn(),
    isPending: false,
  }),
  useHasSieveCapability: () => true,
}))

// Mock the push subscription hook
vi.mock('../../hooks/usePushSubscription', () => ({
  useHasWebPushCapability: () => true,
  usePushSubscription: () => ({
    existingSubs: null,
    subscribe: { mutate: vi.fn() },
    unsubscribe: { mutate: vi.fn() },
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  }),
  useNotificationPermission: () => ({
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  }),
}))

describe('Settings', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    isMobile: false,
  }

  it('renders dialog when isOpen is true', () => {
    render(<Settings {...defaultProps} />, { wrapper: Wrapper })

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<Settings {...defaultProps} isOpen={false} />, { wrapper: Wrapper })

    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('renders all category tabs', () => {
    render(<Settings {...defaultProps} />, { wrapper: Wrapper })

    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Vacation' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Identities' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Filters' })).toBeInTheDocument()
  })

  it('shows General settings by default', () => {
    render(<Settings {...defaultProps} />, { wrapper: Wrapper })

    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument()
    expect(screen.getByText('App Version')).toBeInTheDocument()
    expect(screen.getByText('Protocol')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<Settings {...defaultProps} />, { wrapper: Wrapper })

    await user.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('marks the active tab with aria-selected', () => {
    render(<Settings {...defaultProps} />, { wrapper: Wrapper })

    const generalTab = screen.getByRole('tab', { name: 'General' })
    const vacationTab = screen.getByRole('tab', { name: 'Vacation' })

    expect(generalTab).toHaveAttribute('aria-selected', 'true')
    expect(vacationTab).toHaveAttribute('aria-selected', 'false')
  })

  it('shows notification sound toggle in General settings', () => {
    render(<Settings {...defaultProps} />, { wrapper: Wrapper })

    expect(screen.getByText('New mail sound')).toBeInTheDocument()
  })

  it('shows desktop notifications section', () => {
    render(<Settings {...defaultProps} />, { wrapper: Wrapper })

    expect(screen.getByText('Desktop notifications')).toBeInTheDocument()
  })
})