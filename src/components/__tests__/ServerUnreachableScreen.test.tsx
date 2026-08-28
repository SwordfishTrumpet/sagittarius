import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ServerUnreachableScreen } from '../ServerUnreachableScreen'

describe('ServerUnreachableScreen (issue #6)', () => {
  it('shows the configured server host and the unreachable messaging', () => {
    render(
      <ServerUnreachableScreen
        host="mail.example.com"
        onRetry={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Mail server unreachable' })).toBeInTheDocument()
    expect(screen.getByText('mail.example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument()
  })

  it('renders without a host when the fingerprint is unknown', () => {
    render(<ServerUnreachableScreen host={null} onRetry={vi.fn()} onSignOut={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Mail server unreachable' })).toBeInTheDocument()
  })

  it('calls retry and sign-out handlers', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onSignOut = vi.fn()
    render(<ServerUnreachableScreen host="mail.example.com" onRetry={onRetry} onSignOut={onSignOut} />)

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Sign Out' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('disables actions while a retry check is running', () => {
    render(
      <ServerUnreachableScreen
        host="mail.example.com"
        onRetry={vi.fn()}
        onSignOut={vi.fn()}
        isChecking
      />,
    )
    expect(screen.getByRole('button', { name: /Checking/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeDisabled()
  })
})
