import React, { forwardRef, useImperativeHandle, useState } from 'react'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../../App'
import { jmapClient, type JMAPSession } from '../../api/jmap'

type FetchCall = {
  input: RequestInfo | URL
  init?: RequestInit
  url: string
  body?: any
}

type MockFetchResponse = {
  url?: string | RegExp
  methodCalls?: string[]
  status?: number
  body?: any
  text?: string
}

const hoisted = vi.hoisted(() => ({
  fetchQueue: [] as MockFetchResponse[],
  fetchCalls: [] as FetchCall[],
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('framer-motion', async () => {
  const { forwardRef, createElement } = await import('react')
  
  // Helper to create stable motion components
  const createMotion = (tag: string) => forwardRef<any, any>(({ children, ...props }, ref) =>
    createElement(tag, { ...props, ref }, children),
  )
  
  // Create all components upfront so they're stable across renders
  const motionComponents = {
    div: createMotion('div'),
    span: createMotion('span'),
    button: createMotion('button'),
    nav: createMotion('nav'),
    aside: createMotion('aside'),
    main: createMotion('main'),
    section: createMotion('section'),
    header: createMotion('header'),
    footer: createMotion('footer'),
    ul: createMotion('ul'),
    li: createMotion('li'),
    form: createMotion('form'),
    input: createMotion('input'),
    textarea: createMotion('textarea'),
    p: createMotion('p'),
  }

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: motionComponents,
  }
})

vi.mock('react-dnd', () => ({
  DndProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

vi.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: {},
}))

vi.mock('react-virtuoso', () => ({
  Virtuoso: forwardRef<any, any>(function VirtuosoMock({
    data = [],
    itemContent,
    computeItemKey,
    increaseViewportBy: _increaseViewportBy,
    defaultItemHeight: _defaultItemHeight,
    rangeChanged: _rangeChanged,
    overscan: _overscan,
    ...props
  }, ref) {
    useImperativeHandle(ref, () => ({ scrollToIndex: vi.fn() }))

    return (
      <div {...props}>
        {data.map((item: any, index: number) => (
          <div key={computeItemKey ? computeItemKey(index, item) : index}>
            {itemContent(index, item)}
          </div>
        ))}
      </div>
    )
  }),
}))

vi.mock('@tiptap/react', () => ({
  useEditor: ({ content = '' }: { content?: string }) => {
    const state = {
      html: content,
    }

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

    return {
      __setHTML: (value: string) => {
        state.html = value
      },
      commands: {
        focus: vi.fn(),
      },
      chain: () => chainResult,
      getAttributes: () => ({}),
      getHTML: () => state.html,
      isActive: () => false,
    }
  },
  EditorContent: ({ editor }: { editor: any }) => {
    const [value, setValue] = useState(editor?.getHTML?.() || '')

    return (
      <textarea
        aria-label="Message body"
        className="ProseMirror"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          editor?.__setHTML?.(event.target.value)
        }}
      />
    )
  },
}))

vi.mock('../../hooks/useEventSource', () => ({
  useEventSource: () => ({
    isConnected: false,
    hasNewMail: false,
    clearNewMail: vi.fn(),
  }),
}))

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    isConnected: false,
    hasNewMail: false,
    clearNewMail: vi.fn(),
  }),
}))

vi.mock('../../components/EmailBodyFrame', () => ({
  EmailBodyFrame: ({ html }: { html: string }) => <div data-testid="email-frame" dangerouslySetInnerHTML={{ __html: html }} />,
}))

function matchesResponse(response: MockFetchResponse, call: FetchCall) {
  if (response.url) {
    if (typeof response.url === 'string' && response.url !== call.url) return false
    if (response.url instanceof RegExp && !response.url.test(call.url)) return false
  }

  if (response.methodCalls) {
    const actualMethodCalls = Array.isArray(call.body?.methodCalls)
      ? call.body.methodCalls.map((entry: [string]) => entry[0])
      : []

    if (actualMethodCalls.length !== response.methodCalls.length) return false
    if (!response.methodCalls.every((method, index) => actualMethodCalls[index] === method)) return false
  }

  return true
}

function toFetchResponse(response: MockFetchResponse) {
  const status = response.status ?? 200
  const body = response.body ?? null
  const text = response.text ?? JSON.stringify(body)

  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text,
  }
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
  const call = { input, init, url, body }

  hoisted.fetchCalls.push(call)

  const index = hoisted.fetchQueue.findIndex((entry) => matchesResponse(entry, call))
  if (index === -1) {
    throw new Error(`Unhandled fetch request: ${url} ${JSON.stringify(body ?? {})}`)
  }

  return toFetchResponse(hoisted.fetchQueue.splice(index, 1)[0])
})

export const toastSpies = {
  success: hoisted.toastSuccess,
  error: hoisted.toastError,
}

export function respondWith(responses: MockFetchResponse[]) {
  hoisted.fetchQueue.push(...responses)
}

export function getJmapRequestBodies(methodCalls?: string[]) {
  return hoisted.fetchCalls
    .filter((call) => Array.isArray(call.body?.methodCalls))
    .map((call) => call.body)
    .filter((body) => {
      if (!methodCalls) return true
      const actual = body.methodCalls.map((entry: [string]) => entry[0])
      return actual.length === methodCalls.length && methodCalls.every((method, index) => actual[index] === method)
    })
}

export function getFetchCalls() {
  return [...hoisted.fetchCalls]
}

export function jsonResponse(body: any, options: Omit<MockFetchResponse, 'body'> = {}): MockFetchResponse {
  return {
    ...options,
    body,
  }
}

export function storeAuthenticatedSession(session: JMAPSession, authHeader = `Basic ${btoa('user@example.com:password')}`) {
  sessionStorage.setItem('jmap_session', JSON.stringify(session))
  sessionStorage.setItem('jmap_auth', authHeader)
  ;(jmapClient as any).session = session
  ;(jmapClient as any).authHeader = authHeader
}

function clearStoredSession() {
  sessionStorage.clear()
  localStorage.clear()
  ;(jmapClient as any).session = null
  ;(jmapClient as any).authHeader = null
}

export function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

  jmapClient.registerQueryClient(queryClient)

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    ),
    queryClient,
    screen,
    user: userEvent.setup(),
  }
}

beforeEach(() => {
  clearStoredSession()
  hoisted.fetchQueue.length = 0
  hoisted.fetchCalls.length = 0
  hoisted.toastSuccess.mockReset()
  hoisted.toastError.mockReset()
  vi.stubGlobal('fetch', fetchMock)

  if (typeof globalThis.EventSource === 'undefined') {
    vi.stubGlobal('EventSource', class {
      onopen: ((event: Event) => void) | null = null
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      addEventListener() {}
      close() {}
    })
  }
})

afterEach(() => {
  cleanup()
})
