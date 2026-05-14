import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MessageListHeader } from '../MessageListHeader'

const baseProps = {
  title: 'Inbox',
  isMobile: false,
  emails: [],
  selectedEmailIds: new Set<string>(),
  searchTerm: '',
  showFilterDialog: false,
  activeFilters: { unread: false, flagged: false, toMe: false, attachments: false, headerFilters: [] },
  hasActiveFilters: false,
  activeFilterCount: 0,
  onShowSidebar: vi.fn(),
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  onOpenFilterDialog: vi.fn(),
  onCloseFilterDialog: vi.fn(),
  onApplyFilters: vi.fn(),
  onClearFilters: vi.fn(),
  onSearchChange: vi.fn(),
  onClearSearch: vi.fn(),
}

describe('MessageListHeader', () => {
  it('shows a sidebar reopen control when the sidebar is collapsed', () => {
    render(<MessageListHeader {...baseProps} isSidebarCollapsed />)

    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeInTheDocument()
  })
})
