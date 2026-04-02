import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VirtualMessageList } from '../VirtualMessageList'
import { createTestEmail } from '../../test/testUtils'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

vi.mock('react-dnd', () => ({
  useDrag: () => [{ isDragging: false }, vi.fn()],
}))

vi.mock('react-virtuoso', () => ({
  Virtuoso: forwardRef<any, any>(function VirtuosoMock({ data = [], itemContent, ...props }, ref) {
    return (
      <div ref={ref} {...props}>
        {data.map((item: any, index: number) => (
          <div key={item.id}>{itemContent(index, item)}</div>
        ))}
      </div>
    )
  }),
}))

describe('VirtualMessageList draft behavior', () => {
  it('reopens draft messages on double click', async () => {
    const user = userEvent.setup()
    const onToggleSelection = vi.fn()
    const onOpenDraft = vi.fn()

    render(
      <VirtualMessageList
        emails={[
          createTestEmail({
            id: 'draft-1',
            threadId: 'thread-1',
            from: [{ email: 'user@example.com' }],
            subject: 'Draft subject',
            preview: 'Draft preview',
            receivedAt: '2026-04-01T10:00:00.000Z',
            keywords: { '$draft': true },
            mailboxIds: { 'mailbox-drafts': true },
          }),
        ]}
        isLoading={false}
        isRefetching={false}
        selectedEmailId={null}
        selectedEmailIds={new Set()}
        mailboxes={[]}
        onToggleSelection={onToggleSelection}
        onToggleFlag={vi.fn()}
        formatMessageDate={() => 'Apr 1'}
        onOpenDraft={onOpenDraft}
      />,
    )

    await user.dblClick(screen.getByLabelText(/Draft subject/))

    expect(onToggleSelection).toHaveBeenCalledWith('draft-1', false, false)
    expect(onOpenDraft).toHaveBeenCalledWith('draft-1')
  })
})
