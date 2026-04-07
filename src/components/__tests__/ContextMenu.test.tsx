import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ContextMenu } from '../ContextMenu'

describe('ContextMenu', () => {
  it('supports keyboard navigation and submenu activation', async () => {
    const user = userEvent.setup()
    const openSubAction = vi.fn()
    const onClose = vi.fn()

    render(
      <ContextMenu
        x={20}
        y={20}
        onClose={onClose}
        items={[
          { id: 'reply', label: 'Reply', onSelect: vi.fn() },
          {
            id: 'move',
            label: 'Move',
            onSelect: vi.fn(),
            submenu: [
              { id: 'archive', label: 'Archive', onSelect: openSubAction },
            ],
          },
        ]}
      />,
    )

    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Reply' })).toHaveFocus())

    await user.keyboard('[ArrowDown]')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Move' })).toHaveFocus())

    // Small delay to ensure refs are set
    await new Promise(resolve => setTimeout(resolve, 50))
    
    await user.keyboard('[ArrowRight]')
    expect(await screen.findByRole('menu', { name: 'Move submenu' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveFocus())

    await user.keyboard('[Enter]')
    expect(openSubAction).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes only the submenu on first Escape and the menu on second Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <ContextMenu
        x={20}
        y={20}
        onClose={onClose}
        items={[
          { id: 'reply', label: 'Reply', onSelect: vi.fn() },
          {
            id: 'move',
            label: 'Move',
            onSelect: vi.fn(),
            submenu: [
              { id: 'archive', label: 'Archive', onSelect: vi.fn() },
            ],
          },
        ]}
      />,
    )

    await user.keyboard('[ArrowDown]')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Move' })).toHaveFocus())

    // Small delay to ensure refs are set
    await new Promise(resolve => setTimeout(resolve, 50))
    
    await user.keyboard('[ArrowRight]')
    expect(await screen.findByRole('menu', { name: 'Move submenu' })).toBeInTheDocument()

    await user.keyboard('[Escape]')
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Move submenu' })).not.toBeInTheDocument())
    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard('[Escape]')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
