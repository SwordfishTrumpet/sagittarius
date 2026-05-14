import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Composer } from '../../components/Composer'
import { checkA11y } from './helpers'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
})

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
)

vi.mock('../../hooks/jmap/useCompose', () => ({
  useCompose: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../../hooks/jmap/useIdentities', () => ({
  useIdentities: () => ({ data: [{ id: 'identity-1', email: 'user@example.com', name: 'User Example' }] }),
}))

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getAccountCapability: () => ({ maxDelayedSend: 3600 }),
    getCapabilityConfig: () => ({ maxSizeUpload: 50_000_000 }),
    uploadBlob: vi.fn(),
    getPrimaryAccount: () => 'account-1',
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
    div: forwardRef<any, any>(function MotionDiv({ children, ...props }, ref) {
      return <div ref={ref} {...props}>{children}</div>
    }),
  },
}))

vi.mock('@tiptap/react', () => ({
  useEditor: () => ({
    commands: { focus: vi.fn() },
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
    getHTML: () => '<p>Hello</p>',
    isActive: () => false,
  }),
  EditorContent: () => <div data-testid="editor-content">Editor</div>,
}))

vi.mock('@tiptap/starter-kit', () => ({ default: {} }))
vi.mock('@tiptap/extension-placeholder', () => ({ default: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-underline', () => ({ default: {} }))
vi.mock('@tiptap/extension-link', () => ({ default: { configure: () => ({}) } }))

describe('Composer accessibility', () => {
  it('renders without axe violations and keeps focus within the dialog', async () => {
    const user = userEvent.setup()
    const { container } = render(<Composer onClose={() => {}} />, { wrapper: Wrapper })

    expect((await checkA11y(container)).violations).toHaveLength(0)

    expect(screen.getByRole('button', { name: 'Close and save draft' })).toHaveFocus()

    await user.tab({ shift: true })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Discard draft' })).toHaveFocus())
  })

  it('exposes an accessible minimized state and supports keyboard re-open', async () => {
    const user = userEvent.setup()
    render(<Composer onClose={() => {}} />, { wrapper: Wrapper })

    await user.click(screen.getByRole('button', { name: 'Minimize composer' }))

    const minimizedBar = screen.getByRole('button', { name: 'Expand composer' })
    minimizedBar.focus()
    await user.keyboard('[Enter]')

    expect(await screen.findByRole('dialog', { name: 'New Message' })).toBeInTheDocument()
  })
})
