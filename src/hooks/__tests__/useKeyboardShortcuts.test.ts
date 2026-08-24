/**
 * useKeyboardShortcuts tests — BUG-2026-028: CMD+A (select all) and CMD+B
 * (toggle sidebar) must NOT hijack those shortcuts while the user is typing
 * in an input, textarea, select, or contentEditable area (e.g. the composer).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts, type KeyboardShortcutsConfig } from '../useKeyboardShortcuts'
import type { Email } from '../../types/jmap'

function makeConfig(overrides: Partial<KeyboardShortcutsConfig> = {}): KeyboardShortcutsConfig {
  return {
    emails: [{ id: 'e1' } as Email],
    selectedMailboxId: 'inbox',
    selectedEmailId: null,
    selectedEmail: undefined,
    selectedEmailIds: new Set(),
    rawViewerBlobId: null,
    isSettingsOpen: false,
    isComposerOpen: false,
    moreMenuOpen: false,
    showShortcutsHelp: false,
    onSelectAll: vi.fn(),
    onClearSelection: vi.fn(),
    onToggleSidebar: vi.fn(),
    onCompose: vi.fn(),
    onCloseShortcutsHelp: vi.fn(),
    onCloseRawViewer: vi.fn(),
    onCloseSettings: vi.fn(),
    onCloseComposer: vi.fn(),
    onCloseMoreMenu: vi.fn(),
    onNavigateEmail: vi.fn(),
    onReply: vi.fn(),
    onReplyAll: vi.fn(),
    onForward: vi.fn(),
    onToggleStar: vi.fn(),
    onArchive: vi.fn(),
    onDelete: vi.fn(),
    onShowShortcutsHelp: vi.fn(),
    ...overrides,
  }
}

function dispatchKey(e: Partial<KeyboardEventInit>) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...e }))
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('triggers CMD+A select-all when no input is focused', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardShortcuts(config))

    dispatchKey({ key: 'a', ctrlKey: true })
    expect(config.onSelectAll).toHaveBeenCalledTimes(1)
  })

  it('does NOT trigger CMD+A while typing in an input (BUG-2026-028)', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardShortcuts(config))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    dispatchKey({ key: 'a', ctrlKey: true })
    expect(config.onSelectAll).not.toHaveBeenCalled()
  })

  it('does NOT trigger CMD+B while typing in the composer body (BUG-2026-028)', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardShortcuts(config))

    // NOTE: jsdom does not implement isContentEditable, so we exercise the
    // guard with a textarea (a composer body is contentEditable in real
    // browsers; the guard covers input/textarea/select/contentEditable).
    const editor = document.createElement('textarea')
    document.body.appendChild(editor)
    editor.focus()

    dispatchKey({ key: 'b', ctrlKey: true })
    expect(config.onToggleSidebar).not.toHaveBeenCalled()
  })

  it('triggers CMD+B sidebar toggle when NOT typing', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardShortcuts(config))

    dispatchKey({ key: 'b', metaKey: true })
    expect(config.onToggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('still fires single-key navigation outside inputs', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardShortcuts(config))

    dispatchKey({ key: 'j' })
    expect(config.onNavigateEmail).toHaveBeenCalledWith('next')
  })

  it('does NOT trigger CMD+Shift+N while typing in an input (BUG-2026-061)', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardShortcuts(config))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    dispatchKey({ key: 'N', shiftKey: true, metaKey: true })
    expect(config.onCompose).not.toHaveBeenCalled()
  })

  it('triggers CMD+Shift+N new compose when NOT typing', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardShortcuts(config))

    dispatchKey({ key: 'N', shiftKey: true, metaKey: true })
    expect(config.onCompose).toHaveBeenCalledTimes(1)
  })
})
