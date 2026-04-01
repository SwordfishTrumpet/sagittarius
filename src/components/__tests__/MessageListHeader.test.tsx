import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MessageListHeader } from '../MessageListHeader'

const baseProps = {
  title: 'Inbox',
  isMobile: false,
  emails: [],
  selectedEmailIds: new Set<string>(),
  searchTerm: '',
  showFilterBar: false,
  activeListFilters: new Set<string>(),
  onShowSidebar: vi.fn(),
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  onToggleFilterBar: vi.fn(),
  onSearchChange: vi.fn(),
  onClearSearch: vi.fn(),
  onToggleListFilter: vi.fn(),
}

describe('MessageListHeader', () => {
  it('shows a sidebar reopen control when the sidebar is collapsed', () => {
    render(<MessageListHeader {...baseProps} isSidebarCollapsed />)

    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeInTheDocument()
  })
})
