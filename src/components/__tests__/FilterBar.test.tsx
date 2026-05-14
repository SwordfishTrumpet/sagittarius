import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilterDialog } from '../FilterDialog'
import type { FilterState } from '../../hooks/useListFilters'

const EMPTY_FILTERS: FilterState = {
  unread: false,
  flagged: false,
  toMe: false,
  attachments: false,
  headerFilters: [],
}

describe('FilterDialog', () => {
  it('renders all four checkbox filters', () => {
    render(
      <FilterDialog
        isOpen={true}
        onClose={vi.fn()}
        currentFilters={EMPTY_FILTERS}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />
    )

    expect(screen.getByRole('checkbox', { name: 'Unread' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Flagged' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'To Me' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Attachments' })).toBeInTheDocument()
  })

  it('shows header filter section', () => {
    render(
      <FilterDialog
        isOpen={true}
        onClose={vi.fn()}
        currentFilters={EMPTY_FILTERS}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />
    )

    expect(screen.getByText('Headers')).toBeInTheDocument()
    expect(screen.getByText('Add Header Filter')).toBeInTheDocument()
  })

  it('calls onApply with updated filters when Apply is clicked', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()

    render(
      <FilterDialog
        isOpen={true}
        onClose={vi.fn()}
        currentFilters={EMPTY_FILTERS}
        onApply={onApply}
        onClear={vi.fn()}
      />
    )

    await user.click(screen.getByRole('checkbox', { name: 'Unread' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(onApply).toHaveBeenCalledWith({
      unread: true,
      flagged: false,
      toMe: false,
      attachments: false,
      headerFilters: [],
    })
  })

  it('calls onClear when Clear All is clicked', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()

    render(
      <FilterDialog
        isOpen={true}
        onClose={vi.fn()}
        currentFilters={{ unread: true, flagged: false, toMe: false, attachments: false, headerFilters: [] }}
        onApply={vi.fn()}
        onClear={onClear}
      />
    )

    await user.click(screen.getByText('Clear All'))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('allows adding and removing header filter rows', async () => {
    const user = userEvent.setup()

    render(
      <FilterDialog
        isOpen={true}
        onClose={vi.fn()}
        currentFilters={EMPTY_FILTERS}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />
    )

    await user.click(screen.getByText('Add Header Filter'))
    expect(screen.getByPlaceholderText('Header name (e.g. List-Id)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Value contains... (leave empty for exists)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove header filter' }))
    expect(screen.queryByPlaceholderText('Header name (e.g. List-Id)')).not.toBeInTheDocument()
  })
})
