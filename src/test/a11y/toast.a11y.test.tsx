import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toaster, toast } from 'sonner'
import { checkA11y } from './helpers'

function ToastHarness({ onUndo }: { onUndo: () => void }) {
  return (
    <div>
      <Toaster
        containerAriaLabel="Notifications"
        closeButton
        toastOptions={{ closeButtonAriaLabel: 'Dismiss notification' }}
      />
      <button
        type="button"
        onClick={() => {
          toast.success('Message archived', {
            duration: 100000,
            action: {
              label: 'Undo',
              onClick: onUndo,
            },
          })
        }}
      >
        Trigger toast
      </button>
    </div>
  )
}

afterEach(() => {
  toast.dismiss()
})

describe('Toast accessibility', () => {
  it('renders notifications in an accessible live region with keyboard-operable action buttons', async () => {
    const user = userEvent.setup()
    const onUndo = vi.fn()
    const { container } = render(<ToastHarness onUndo={onUndo} />)

    await user.click(screen.getByRole('button', { name: 'Trigger toast' }))

    const notifications = await screen.findByLabelText(/Notifications/)
    expect(notifications).toHaveAttribute('aria-live')

    const toastMessage = await screen.findByText('Message archived')
    const toastElement = toastMessage.closest('[data-sonner-toast]')
    expect(toastElement).not.toBeNull()

    const undoButton = within(toastElement as HTMLElement).getByRole('button', { name: 'Undo' })
    expect(within(toastElement as HTMLElement).getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument()
    expect(undoButton).toBeInTheDocument()

    expect((await checkA11y(container)).violations).toHaveLength(0)

    undoButton.focus()
    await user.keyboard('[Enter]')

    await waitFor(() => expect(onUndo).toHaveBeenCalledTimes(1))
  })
})
