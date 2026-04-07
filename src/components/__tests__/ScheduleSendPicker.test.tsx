import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ScheduleSendPicker } from '../ScheduleSendPicker'

describe('ScheduleSendPicker', () => {
  const defaultProps = {
    onSchedule: vi.fn(),
    onCancel: vi.fn(),
    maxDelaySeconds: 3600 * 24, // 24 hours
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with dialog role and proper aria attributes', () => {
    render(<ScheduleSendPicker {...defaultProps} />)

    const dialog = screen.getByRole('dialog', { name: 'Schedule send' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('renders quick schedule options', () => {
    render(<ScheduleSendPicker {...defaultProps} />)

    expect(screen.getByRole('button', { name: /Tomorrow 9 AM/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tomorrow 1 PM/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Monday 9 AM/i })).toBeInTheDocument()
  })

  it('renders custom date/time picker', () => {
    render(<ScheduleSendPicker {...defaultProps} />)

    expect(screen.getByText(/Custom Date & Time/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument()
  })

  it('calls onCancel when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<ScheduleSendPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Close schedule picker' }))
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onSchedule when quick option is clicked', async () => {
    const user = userEvent.setup()
    render(<ScheduleSendPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /Tomorrow 9 AM/i }))
    expect(defaultProps.onSchedule).toHaveBeenCalledTimes(1)
    expect(defaultProps.onSchedule).toHaveBeenCalledWith(expect.any(Date))
  })

  it('calls onCancel when Escape key is pressed', async () => {
    const user = userEvent.setup()
    render(<ScheduleSendPicker {...defaultProps} />)

    await user.keyboard('{Escape}')
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables Schedule button when no custom date selected', () => {
    render(<ScheduleSendPicker {...defaultProps} />)

    const scheduleButton = screen.getByRole('button', { name: 'Schedule' })
    expect(scheduleButton).toBeDisabled()
  })

  it('disables quick options that exceed maxDelaySeconds', () => {
    // Set max delay to 1 hour - all tomorrow/monday options should be disabled
    render(<ScheduleSendPicker {...defaultProps} maxDelaySeconds={3600} />)

    const tomorrow9am = screen.getByRole('button', { name: /Tomorrow 9 AM/i })
    const tomorrow1pm = screen.getByRole('button', { name: /Tomorrow 1 PM/i })
    const monday9am = screen.getByRole('button', { name: /Monday 9 AM/i })

    expect(tomorrow9am).toBeDisabled()
    expect(tomorrow1pm).toBeDisabled()
    expect(monday9am).toBeDisabled()
  })
})