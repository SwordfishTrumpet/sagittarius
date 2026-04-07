import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilterBar } from '../FilterBar'

describe('FilterBar', () => {
  it('renders all four filter buttons', () => {
    render(<FilterBar activeFilters={new Set()} onToggleFilter={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Filter Unread' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter Flagged' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter To Me' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter Attachments' })).toBeInTheDocument()
  })

  it('marks active filters with aria-pressed=true', () => {
    render(<FilterBar activeFilters={new Set(['unread', 'flagged'])} onToggleFilter={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Filter Unread' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Filter Flagged' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Filter To Me' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Filter Attachments' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onToggleFilter when a filter button is clicked', async () => {
    const user = userEvent.setup()
    const onToggleFilter = vi.fn()

    render(<FilterBar activeFilters={new Set()} onToggleFilter={onToggleFilter} />)

    await user.click(screen.getByRole('button', { name: 'Filter Unread' }))
    expect(onToggleFilter).toHaveBeenCalledWith('unread')

    await user.click(screen.getByRole('button', { name: 'Filter Flagged' }))
    expect(onToggleFilter).toHaveBeenCalledWith('flagged')

    await user.click(screen.getByRole('button', { name: 'Filter To Me' }))
    expect(onToggleFilter).toHaveBeenCalledWith('toMe')

    await user.click(screen.getByRole('button', { name: 'Filter Attachments' }))
    expect(onToggleFilter).toHaveBeenCalledWith('attachments')
  })

  it('applies active styling to selected filters', () => {
    render(<FilterBar activeFilters={new Set(['unread'])} onToggleFilter={vi.fn()} />)

    const unreadButton = screen.getByRole('button', { name: 'Filter Unread' })
    const flaggedButton = screen.getByRole('button', { name: 'Filter Flagged' })

    // Active filter should have blue background class
    expect(unreadButton.className).toContain('bg-[#007AFF]')
    expect(unreadButton.className).toContain('text-white')

    // Inactive filter should have gray background class
    expect(flaggedButton.className).toContain('bg-[#F2F2F7]')
    expect(flaggedButton.className).toContain('text-[#8E8E93]')
  })

  it('supports keyboard navigation between filters', async () => {
    const user = userEvent.setup()
    render(<FilterBar activeFilters={new Set()} onToggleFilter={vi.fn()} />)

    const firstButton = screen.getByRole('button', { name: 'Filter Unread' })
    firstButton.focus()

    await user.keyboard('{Tab}')
    // After tab, focus should move to next button
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Filter Flagged' }))
  })
})