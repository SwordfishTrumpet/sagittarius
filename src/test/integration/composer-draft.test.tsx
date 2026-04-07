import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useRef, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Composer } from '../../components/Composer'
import { getComposerDraftKey } from '../../utils/draftStorage'
import { createTestEmail } from '../testUtils'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
})

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
)

let lastEditorOptions: any = null
let mockIdentities = [{ id: 'identity-1', email: 'user@example.com', name: 'User Example', textSignature: '' }]
let editorHtml = '<p>Editor body</p>'
const composeMutate = vi.fn((_: any, options?: any) => options?.onSuccess?.())

const mockEditor = {
  commands: {
    focus: vi.fn(),
    setContent: vi.fn((value: string) => {
      mockEditor.__setHTML(value)
      return true
    }),
  },
  __setHTML: vi.fn(),
  chain: () => {
    const chainResult = {
      focus: () => chainResult,
      toggleBold: () => chainResult,
      toggleItalic: () => chainResult,
      toggleUnderline: () => chainResult,
      toggleBulletList: () => chainResult,
      toggleOrderedList: () => chainResult,
      extendMarkRange: () => chainResult,
      unsetLink: () => chainResult,
      setLink: () => chainResult,
      run: () => true,
    }

    return chainResult
  },
  getAttributes: () => ({}),
  getHTML: () => editorHtml,
  isActive: () => false,
}

vi.mock('../../hooks/jmap/useCompose', () => {
  return {
    useCompose: () => ({ mutate: composeMutate, isPending: false }),
  }
})

vi.mock('../../hooks/jmap/useSaveDraft', () => {
  return {
    useSaveDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
  }
})

vi.mock('../../hooks/jmap/useIdentities', () => ({
  useIdentities: () => ({ data: mockIdentities }),
}))

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getPrimaryAccount: () => 'account-1',
    getAccountCapability: () => ({ maxDelayedSend: 3600 }),
    uploadBlob: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: forwardRef<HTMLDivElement, any>(function MotionDiv({ children, ...props }, ref) {
      return <div ref={ref} {...props}>{children}</div>
    }),
  },
}))

vi.mock('@tiptap/react', () => ({
  useEditor: (options: any) => {
    lastEditorOptions = options
    const initializedRef = useRef(false)

    if (!initializedRef.current) {
      editorHtml = options.content || ''
      mockEditor.__setHTML = vi.fn((value: string) => {
        editorHtml = value
      })
      mockEditor.commands.setContent = vi.fn((value: string) => {
        editorHtml = value
        return true
      })
      initializedRef.current = true
    }

    return mockEditor
  },
   EditorContent: ({ editor }: { editor: typeof mockEditor }) => {
    const [value, setValue] = useState(editor.getHTML())

    return (
      <textarea
        aria-label="Message body"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          editor.__setHTML(event.target.value)
        }}
      />
    )
   },
}))

vi.mock('@tiptap/starter-kit', () => ({ default: {} }))
vi.mock('@tiptap/extension-placeholder', () => ({ default: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-underline', () => ({ default: {} }))
vi.mock('@tiptap/extension-link', () => ({ default: { configure: () => ({}) } }))

beforeEach(() => {
  localStorage.clear()
  lastEditorOptions = null
  mockIdentities = [{ id: 'identity-1', email: 'user@example.com', name: 'User Example', textSignature: '' }]
  editorHtml = '<p>Editor body</p>'
  mockEditor.commands.focus.mockClear()
  mockEditor.commands.setContent.mockClear()
  mockEditor.__setHTML.mockClear()
  composeMutate.mockClear()
})

describe('Composer draft recovery', () => {
  it('restores a saved draft on mount', () => {
    const key = getComposerDraftKey('account-1')
    localStorage.setItem(key, JSON.stringify({
      to: 'friend@example.com',
      cc: 'copy@example.com',
      bcc: 'blind@example.com',
      subject: 'Saved subject',
      body: '<p>Saved body</p>',
      attachments: [{ blobId: 'blob-1', name: 'agenda.pdf', type: 'application/pdf', size: 1024 }],
      selectedIdentityId: 'identity-1',
      showCcBcc: true,
      sendAt: '2026-03-31T12:00:00.000Z',
      isQuoteCollapsed: true,
    }))

    render(<Composer onClose={() => {}} />, { wrapper: Wrapper })

    expect(lastEditorOptions.content).toBe('<p>Saved body</p>')
    expect(screen.getByDisplayValue('friend@example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Saved subject')).toBeInTheDocument()
    expect(screen.getByDisplayValue('copy@example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('blind@example.com')).toBeInTheDocument()
    expect(screen.getByText('agenda.pdf')).toBeInTheDocument()
  })

  it('autosaves edits and clears drafts when discarded', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const key = getComposerDraftKey('account-1')

    render(<Composer onClose={onClose} />, { wrapper: Wrapper })

    await user.type(screen.getByRole('textbox', { name: /Recipients/ }), 'friend@example.com')
    await user.type(screen.getByRole('textbox', { name: 'Subject:' }), 'Auto saved subject')

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(key) || 'null')).toMatchObject({
        to: 'friend@example.com',
        subject: 'Auto saved subject',
      })
    }, { timeout: 2500 })

    await user.click(screen.getByRole('button', { name: 'Discard draft' }))

    expect(localStorage.getItem(key)).toBeNull()
    expect(onClose).toHaveBeenCalled()
  })

  it('clears drafts after a successful send', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const key = getComposerDraftKey('account-1')

    render(<Composer onClose={onClose} />, { wrapper: Wrapper })

    await user.type(screen.getByRole('textbox', { name: /Recipients/ }), 'friend@example.com')
    await user.type(screen.getByRole('textbox', { name: 'Subject:' }), 'Send clears draft')

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(key) || 'null')).toMatchObject({
        to: 'friend@example.com',
        subject: 'Send clears draft',
      })
    }, { timeout: 2500 })

    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(localStorage.getItem(key)).toBeNull()
    expect(onClose).toHaveBeenCalled()
  })

  it('injects the selected identity signature into new messages', () => {
    mockIdentities = [{
      id: 'identity-1',
      email: 'user@example.com',
      name: 'User Example',
      textSignature: '—\nUser Example',
    }]

    render(<Composer onClose={() => {}} />, { wrapper: Wrapper })

    expect(lastEditorOptions.content).toContain('data-sagittarius-signature="1"')
    expect(lastEditorOptions.content).toContain('User Example')
  })

  it('loads an existing server draft into the composer', () => {
    render(
      <Composer
        onClose={() => {}}
        draftEmail={createTestEmail({
          id: 'draft-123',
          from: [{ email: 'user@example.com' }],
          to: [{ email: 'friend@example.com' }],
          cc: [{ email: 'copy@example.com' }],
          bcc: [{ email: 'blind@example.com' }],
          subject: 'Existing draft',
          attachments: [{ blobId: 'blob-1', name: 'agenda.pdf', type: 'application/pdf', size: 1024 }],
          bodyValues: {
            'body-1': { value: '<p>Saved on server</p>', isTruncated: false },
          },
          htmlBody: [{ partId: 'body-1', type: 'text/html' }],
        })}
      />,
      { wrapper: Wrapper },
    )

    expect(lastEditorOptions.content).toBe('<p>Saved on server</p>')
    expect(screen.getByDisplayValue('friend@example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('copy@example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('blind@example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Existing draft')).toBeInTheDocument()
    expect(screen.getByText('agenda.pdf')).toBeInTheDocument()
  })

  it('sends reopened drafts using the original draft id', async () => {
    const user = userEvent.setup()

    render(
      <Composer
        onClose={() => {}}
        draftEmail={createTestEmail({
          id: 'draft-123',
          from: [{ email: 'user@example.com' }],
          to: [{ email: 'friend@example.com' }],
          subject: 'Existing draft',
          bodyValues: {
            'body-1': { value: '<p>Saved on server</p>', isTruncated: false },
          },
          htmlBody: [{ partId: 'body-1', type: 'text/html' }],
        })}
      />,
      { wrapper: Wrapper },
    )

    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(composeMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'draft-123',
        subject: 'Existing draft',
        to: [{ email: 'friend@example.com' }],
      }),
      expect.any(Object),
    )
  })

  it('replaces the signature when the selected identity changes', async () => {
    const user = userEvent.setup()
    mockIdentities = [
      {
        id: 'identity-1',
        email: 'user@example.com',
        name: 'User Example',
        textSignature: '—\nUser Example',
      },
      {
        id: 'identity-2',
        email: 'alias@example.com',
        name: 'Alias Example',
        textSignature: '—\nAlias Example',
      },
    ]

    render(<Composer onClose={() => {}} />, { wrapper: Wrapper })

    await user.selectOptions(screen.getByRole('combobox'), 'identity-2')

    await waitFor(() => {
      expect(editorHtml).toContain('Alias Example')
    })

    expect(editorHtml).not.toContain('User Example</div>')
  })
})
