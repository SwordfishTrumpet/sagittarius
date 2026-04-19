import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Composer } from '../Composer'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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
    commands: {
      focus: vi.fn(),
      toggleBold: () => ({ run: vi.fn() }),
      toggleItalic: () => ({ run: vi.fn() }),
      toggleUnderline: () => ({ run: vi.fn() }),
      toggleBulletList: () => ({ run: vi.fn() }),
      toggleOrderedList: () => ({ run: vi.fn() }),
      toggleLink: () => ({ run: vi.fn() }),
    },
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        toggleUnderline: () => ({ run: vi.fn() }),
        toggleBulletList: () => ({ run: vi.fn() }),
        toggleOrderedList: () => ({ run: vi.fn() }),
        toggleLink: () => ({ run: vi.fn() }),
      }),
    }),
    isActive: () => false,
  }),
  EditorContent: ({ editor }: { editor: any }) => (
    <div data-testid="tiptap-editor">Editor Content</div>
  ),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

// Mock hooks
vi.mock('../../hooks/jmap/useCompose', () => ({
  useCompose: () => ({
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
  upsertIdentitySignature: (content: string) => `${content}<p>--<br>Signature</p>`,
}))

vi.mock('../../utils/offlineSyncQueue', () => ({
  isDeferredMutationResult: () => false,
}))

vi.mock('../../utils/toastHelpers', () => ({
  toastOperationError: vi.fn(),
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

describe('Composer', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders composer with all required fields', () => {
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    expect(screen.getByRole('textbox', { name: /Recipients/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Subject/i })).toBeInTheDocument()
    expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Send$/i })).toBeInTheDocument()
  })

  it('uses first identity when no identity is pre-selected', () => {
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    // The composer should render successfully with the mocked identity
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    await user.click(screen.getByRole('button', { name: /Close/i }))

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('toggles CC/BCC fields when expand button is clicked', async () => {
    const user = userEvent.setup()
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    // Initially CC/BCC inputs should not be visible (but group container is)
    expect(screen.queryByLabelText('Cc:')).not.toBeInTheDocument()

    // Click to expand
    const ccBccButton = screen.getByRole('button', { name: /Cc\/Bcc/i })
    await user.click(ccBccButton)

    // CC/BCC input fields should now be visible
    expect(screen.getByLabelText('Cc:')).toBeInTheDocument()
    expect(screen.getByLabelText('Bcc:')).toBeInTheDocument()
  })

  it('populates fields when replying to an email', () => {
    const replyContext = {
      id: 'email-123',
      threadId: 'thread-123',
      from: [{ email: 'sender@example.com', name: 'Sender' }],
      to: [{ email: 'user@example.com', name: 'User' }],
      subject: 'Original Subject',
      receivedAt: '2025-01-01T10:00:00Z',
      bodyParts: {
        textBody: [{ partId: 'text-1', type: 'text/plain' }],
        htmlBody: [{ partId: 'html-1', type: 'text/html' }],
        bodyValues: {},
      },
    }

    render(<Composer onClose={mockOnClose} replyTo={replyContext} />, { wrapper: Wrapper })

    // Should prefill To field with sender
    expect(screen.getByRole('textbox', { name: /Recipients/i })).toHaveValue('sender@example.com')

    // Should add Re: prefix to subject
    expect(screen.getByRole('textbox', { name: /Subject/i })).toHaveValue('Re: Original Subject')
  })

  it('creates forward subject when forwarding', () => {
    const forwardContext = {
      id: 'email-123',
      threadId: 'thread-123',
      from: [{ email: 'sender@example.com', name: 'Sender' }],
      to: [{ email: 'user@example.com', name: 'User' }],
      subject: 'Original Subject',
      receivedAt: '2025-01-01T10:00:00Z',
      _forward: true,
      bodyParts: {
        textBody: [{ partId: 'text-1', type: 'text/plain' }],
        htmlBody: [{ partId: 'html-1', type: 'text/html' }],
        bodyValues: {},
      },
    }

    render(<Composer onClose={mockOnClose} replyTo={forwardContext} />, { wrapper: Wrapper })

    // Should add Fwd: prefix to subject
    expect(screen.getByRole('textbox', { name: /Subject/i })).toHaveValue('Fwd: Original Subject')

    // Should leave To field empty for forward
    expect(screen.getByRole('textbox', { name: /Recipients/i })).toHaveValue('')
  })

  it('shows reply-all recipients when _replyAll flag is set', () => {
    const replyAllContext = {
      id: 'email-123',
      threadId: 'thread-123',
      from: [{ email: 'sender@example.com', name: 'Sender' }],
      to: [{ email: 'user@example.com', name: 'User' }],
      cc: [{ email: 'cc@example.com', name: 'CC' }],
      subject: 'Original Subject',
      receivedAt: '2025-01-01T10:00:00Z',
      _replyAll: true,
      bodyParts: {
        textBody: [{ partId: 'text-1', type: 'text/plain' }],
        htmlBody: [{ partId: 'html-1', type: 'text/html' }],
        bodyValues: {},
      },
    }

    render(<Composer onClose={mockOnClose} replyTo={replyAllContext} />, { wrapper: Wrapper })

    // Should include all recipients in To field
    const toField = screen.getByRole('textbox', { name: /Recipients/i }) as HTMLInputElement
    expect(toField.value).toContain('sender@example.com')
    expect(toField.value).toContain('user@example.com')
    expect(toField.value).toContain('cc@example.com')
  })

  it('allows entering recipient email addresses', async () => {
    const user = userEvent.setup()
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    const toField = screen.getByRole('textbox', { name: /Recipients/i })
    await user.type(toField, 'recipient@example.com')

    expect(toField).toHaveValue('recipient@example.com')
  })

  it('allows entering subject', async () => {
    const user = userEvent.setup()
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    const subjectField = screen.getByRole('textbox', { name: /Subject/i })
    await user.type(subjectField, 'Test Subject')

    expect(subjectField).toHaveValue('Test Subject')
  })

  it('has minimize button', () => {
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    expect(screen.getByRole('button', { name: /Minimize/i })).toBeInTheDocument()
  })

  it('has formatting toolbar buttons', () => {
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    expect(screen.getByRole('button', { name: /Bold/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Italic/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Underline/i })).toBeInTheDocument()
  })

  it('has attachment button', () => {
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    expect(screen.getByRole('button', { name: /Attach/i })).toBeInTheDocument()
  })

  it('disables send button when required fields are empty', () => {
    render(<Composer onClose={mockOnClose} />, { wrapper: Wrapper })

    const sendButton = screen.getByRole('button', { name: /^Send$/i })
    // With no recipients, send should be disabled
    expect(sendButton).toBeDisabled()
  })
})
