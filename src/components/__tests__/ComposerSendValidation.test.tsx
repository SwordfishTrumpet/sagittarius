/**
 * Tests for BUG-2026-054 — Composer send validation.
 *
 * 1. Sending with an EMPTY SUBJECT must work (the old `!subject` guard made
 *    the enabled Send button silently no-op).
 * 2. Invalid recipient addresses must ABORT the send with a toast listing
 *    the rejected addresses (parseRecipients used to drop them silently).
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Composer } from '../Composer'

const { composeMutate, toastError, toastSuccess } = vi.hoisted(() => ({
  composeMutate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    info: vi.fn(),
  },
}))

// Mock the JMAP client
vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getPrimaryAccount: () => 'account-001',
    getAccountCapability: () => ({ maxDelayedSend: 3600 }),
    getCapabilityConfig: () => ({ maxSizeUpload: 50_000_000 }),
  },
}))

// Mock TipTap editor
vi.mock('@tiptap/react', () => ({
  useEditor: () => ({
    getHTML: () => '<p>Test content</p>',
    view: { dom: null },
    commands: {
      focus: vi.fn(),
      setContent: vi.fn(),
      toggleLink: () => ({ run: vi.fn() }),
    },
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        toggleBulletList: () => ({ run: vi.fn() }),
        toggleOrderedList: () => ({ run: vi.fn() }),
        toggleLink: () => ({ run: vi.fn() }),
      }),
    }),
    isActive: () => false,
    isEditable: true,
  }),
  EditorContent: () => <div data-testid="tiptap-editor">Editor Content</div>,
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

vi.mock('../../hooks/jmap/useCompose', () => ({
  useCompose: () => ({
    mutate: composeMutate,
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}))

vi.mock('../../hooks/jmap/useIdentities', () => ({
  useIdentities: () => ({
    data: [
      { id: 'identity-1', name: 'Test User', email: 'user@example.com' },
    ],
  }),
}))

vi.mock('../../hooks/jmap/useSaveDraft', () => ({
  useSaveDraft: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}))

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => {},
}))

// Mock draft storage
vi.mock('../../utils/draftStorage', () => ({
  getComposerDraftKey: () => 'draft-key',
  loadComposerDraft: () => null,
  saveComposerDraft: vi.fn(),
  clearComposerDraft: vi.fn(),
}))

// Mock utils
vi.mock('../../utils/quoteBuilder', () => ({
  buildReplyQuote: () => '<blockquote>Reply quote</blockquote>',
  buildForwardQuote: () => '<blockquote>Forwarded message</blockquote>',
  getEmailBodyHtml: () => '<p>Draft body</p>',
}))

vi.mock('../../utils/signatureBuilder', () => ({
  upsertIdentitySignature: (_content: string) => _content,
}))

vi.mock('../../utils/offlineSyncQueue', () => ({
  isDeferredMutationResult: () => false,
}))

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
})

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
)

describe('Composer send validation (BUG-2026-054)', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    composeMutate.mockImplementation((_values: unknown, callbacks?: { onSuccess?: (result: unknown) => void }) => {
      callbacks?.onSuccess?.({});
    })
  })

  it('sends successfully with an empty subject (button was enabled but click did nothing before)', async () => {
    const user = userEvent.setup()
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    await user.type(screen.getByLabelText(/Recipients \(required\)/i), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: /^Send$/i }))

    await waitFor(() => {
      expect(composeMutate).toHaveBeenCalledTimes(1)
    })
    expect(composeMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ email: 'alice@example.com' }],
        subject: '',
      }),
      expect.anything(),
    )
    expect(toastError).not.toHaveBeenCalled()
  })

  it('aborts the send and lists invalid recipients instead of silently dropping them', async () => {
    const user = userEvent.setup()
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    await user.type(screen.getByLabelText(/Recipients \(required\)/i), 'alice@example.com, john doe@x.com')
    await user.click(screen.getByRole('button', { name: /^Send$/i }))

    // Send must NOT proceed and the rejected address must be surfaced.
    expect(composeMutate).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining('john doe@x.com'),
    )
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining('(To)'),
    )
  })

  it('aborts the send when a Cc recipient is invalid', async () => {
    const user = userEvent.setup()
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    await user.type(screen.getByLabelText(/Recipients \(required\)/i), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: /Cc\/Bcc/i }))
    await user.type(screen.getByLabelText(/^Cc:/i), 'bad@address')
    await user.click(screen.getByRole('button', { name: /^Send$/i }))

    expect(composeMutate).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining('bad@address (Cc)'),
    )
  })
})
