import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RawEmailViewer } from '../RawEmailViewer'

vi.mock('../../hooks/useEmailParse', () => ({
  useEmailParse: () => ({
    data: {
      headers: [{ name: 'From', value: 'alice@example.com' }],
      textBody: [{ partId: 'text-1' }],
      htmlBody: [{ partId: 'html-1' }],
      bodyValues: {
        'text-1': { value: 'Hello text body' },
        'html-1': { value: '<p>Hello html body</p>' },
      },
      bodyStructure: { type: 'multipart/alternative', subParts: [] },
    },
    isLoading: false,
    error: null,
  }),
}))

describe('RawEmailViewer', () => {
  it('renders dialog tabs and supports keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<RawEmailViewer blobId="blob-1" onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'Raw Email' })
    expect(dialog).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus())

    const headersTab = screen.getByRole('tab', { name: 'Headers' })
    headersTab.focus()

    await user.keyboard('[ArrowRight]')
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Text Body' })).toHaveFocus())
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Hello text body')

    await user.keyboard('[End]')
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Structure' })).toHaveFocus())
  })
})
