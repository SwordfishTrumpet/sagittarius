import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MailboxTree } from '../RecursiveSidebarItem'
import type { MailboxNode } from '../../utils/mailboxTree'

vi.mock('react-dnd', () => ({
  useDrag: (factory: () => any) => {
    const monitor = { isDragging: () => false }
    const config = factory()
    return [config.collect?.(monitor) || { isDragging: false }, vi.fn()]
  },
  useDrop: (factory: () => any) => {
    const monitor = { isOver: () => false, canDrop: () => false, getItemType: () => null, getClientOffset: () => null }
    const config = factory()
    return [config.collect?.(monitor) || { isOver: false, canDrop: false }, vi.fn()]
  },
}))

const rootNode: MailboxNode = {
  id: 'folder-1',
  name: 'Projects',
  role: null,
  parentId: null,
  unreadEmails: 2,
  sortOrder: 0,
  children: [],
  isExpanded: false,
  depth: 0,
}

describe('RecursiveSidebarItem', () => {
  it('allows keyboard focus and activation on custom folder treeitems', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <MailboxTree
        nodes={[rootNode]}
        selectedMailboxId={null}
        onSelect={onSelect}
        onToggleExpand={vi.fn()}
        onDrop={vi.fn()}
        getMailboxIcon={() => <span aria-hidden="true">I</span>}
      />,
    )

    const treeItem = screen.getByRole('treeitem', { name: /Projects/ })
    await user.tab()
    expect(treeItem).toHaveFocus()

    await user.keyboard('[Enter]')
    expect(onSelect).toHaveBeenCalledWith('folder-1')

    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('supports arrow key expansion shortcuts for parent folders', async () => {
    const user = userEvent.setup()
    const onToggleExpand = vi.fn()
    const parentNode: MailboxNode = {
      ...rootNode,
      children: [{
        id: 'folder-2',
        name: 'Child',
        role: null,
        parentId: 'folder-1',
        unreadEmails: 0,
        sortOrder: 1,
        children: [],
        isExpanded: false,
        depth: 1,
      }],
    }

    render(
      <MailboxTree
        nodes={[parentNode]}
        selectedMailboxId={null}
        onSelect={vi.fn()}
        onToggleExpand={onToggleExpand}
        onDrop={vi.fn()}
        getMailboxIcon={() => <span aria-hidden="true">I</span>}
      />,
    )

    const treeItem = screen.getByRole('treeitem', { name: /Projects/ })
    treeItem.focus()

    await user.keyboard('[ArrowRight]')
    expect(onToggleExpand).toHaveBeenCalledWith('folder-1')
  })
})
