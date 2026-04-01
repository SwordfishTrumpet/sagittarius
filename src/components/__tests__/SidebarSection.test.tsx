import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SidebarSection } from '../SidebarSection'

describe('SidebarSection', () => {
  it('keeps the controlled group in the DOM for aria-controls and toggles visibility', async () => {
    const user = userEvent.setup()
    const onToggleExpand = vi.fn()
    const { rerender } = render(
      <SidebarSection title="Folders" isExpanded={false} onToggleExpand={onToggleExpand}>
        <div>Child content</div>
      </SidebarSection>,
    )

    const toggle = screen.getByRole('button', { name: /folders/i })
    const panel = document.getElementById('folders-section-panel')

    expect(toggle).toHaveAttribute('aria-controls', 'folders-section-panel')
    expect(panel).not.toBeNull()
    expect(panel).toHaveAttribute('hidden')

    await user.click(toggle)
    expect(onToggleExpand).toHaveBeenCalledTimes(1)

    rerender(
      <SidebarSection title="Folders" isExpanded onToggleExpand={onToggleExpand}>
        <div>Child content</div>
      </SidebarSection>,
    )

    expect(document.getElementById('folders-section-panel')).not.toHaveAttribute('hidden')
  })
})
