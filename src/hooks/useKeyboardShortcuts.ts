import { useEffect, useRef } from 'react'
import type { Email } from '../types/jmap'

interface KeyboardShortcutsConfig {
  emails: Email[] | undefined
  selectedMailboxId: string | null
  selectedEmailId: string | null
  selectedEmail: Email | undefined
  selectedEmailIds: Set<string>
  rawViewerBlobId: string | null
  isSettingsOpen: boolean
  isComposerOpen: boolean
  moreMenuOpen: boolean
  showShortcutsHelp: boolean
  onSelectAll: () => void
  onClearSelection: () => void
  onToggleSidebar: () => void
  onCompose: () => void
  onCloseShortcutsHelp: () => void
  onCloseRawViewer: () => void
  onCloseSettings: () => void
  onCloseComposer: () => void
  onCloseMoreMenu: () => void
  onNavigateEmail: (direction: 'next' | 'prev') => void
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onToggleStar: (emailId: string, currentStarred: boolean) => void
  onArchive: () => void
  onDelete: () => void
  onShowShortcutsHelp: () => void
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const {
    emails,
    selectedMailboxId,
    selectedEmailId,
    selectedEmail,
    selectedEmailIds,
    rawViewerBlobId,
    isSettingsOpen,
    isComposerOpen,
    moreMenuOpen,
    showShortcutsHelp,
    onSelectAll,
    onClearSelection,
    onToggleSidebar,
    onCompose,
    onCloseShortcutsHelp,
    onCloseRawViewer,
    onCloseSettings,
    onCloseComposer,
    onCloseMoreMenu,
    onNavigateEmail,
    onReply,
    onReplyAll,
    onForward,
    onToggleStar,
    onArchive,
    onDelete,
    onShowShortcutsHelp,
  } = config;

  // Use refs to store callbacks and avoid re-registering keyboard listeners on every render
  const callbacksRef = useRef({
    onSelectAll,
    onClearSelection,
    onToggleSidebar,
    onCompose,
    onCloseShortcutsHelp,
    onCloseRawViewer,
    onCloseSettings,
    onCloseComposer,
    onCloseMoreMenu,
    onNavigateEmail,
    onReply,
    onReplyAll,
    onForward,
    onToggleStar,
    onArchive,
    onDelete,
    onShowShortcutsHelp,
  });

  // Update refs whenever callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onSelectAll,
      onClearSelection,
      onToggleSidebar,
      onCompose,
      onCloseShortcutsHelp,
      onCloseRawViewer,
      onCloseSettings,
      onCloseComposer,
      onCloseMoreMenu,
      onNavigateEmail,
      onReply,
      onReplyAll,
      onForward,
      onToggleStar,
      onArchive,
      onDelete,
      onShowShortcutsHelp,
    };
  }, [
    onSelectAll, onClearSelection, onToggleSidebar, onCompose,
    onCloseShortcutsHelp, onCloseRawViewer, onCloseSettings, onCloseComposer,
    onCloseMoreMenu, onNavigateEmail, onReply, onReplyAll, onForward,
    onToggleStar, onArchive, onDelete, onShowShortcutsHelp,
  ]);

  // Use a ref for selectedEmailIds to avoid stale closure issues
  // (dependency array including .size alone misses content changes with same size)
  const selectedEmailIdsRef = useRef(selectedEmailIds);
  useEffect(() => {
    selectedEmailIdsRef.current = selectedEmailIds;
  }, [selectedEmailIds]);

  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const cbs = callbacksRef.current;
      // Use ref for selectedEmailIds to avoid stale closure issues
      const currentSelectedIds = selectedEmailIdsRef.current;
      
      // CMD/CTRL + A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && emails && selectedMailboxId) {
        e.preventDefault();
        cbs.onSelectAll();
      }
      // CMD/CTRL + B to toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        cbs.onToggleSidebar();
      }
      // CMD/CTRL + Shift + N: new compose
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        e.preventDefault();
        cbs.onCompose();
        return;
      }
      // ESC: close modals first, then clear selection
      if (e.key === 'Escape') {
        if (showShortcutsHelp) { cbs.onCloseShortcutsHelp(); return; }
        if (rawViewerBlobId) { cbs.onCloseRawViewer(); return; }
        if (isSettingsOpen) { cbs.onCloseSettings(); return; }
        if (isComposerOpen) { cbs.onCloseComposer(); return; }
        if (moreMenuOpen) { cbs.onCloseMoreMenu(); return; }
        if (currentSelectedIds.size > 0) cbs.onClearSelection();
        return;
      }

      // --- Shortcuts that only fire when NOT typing in an input ---
      if (!isInputFocused()) {
        switch (e.key) {
          case 'j':
          case 'ArrowDown':
            cbs.onNavigateEmail('next');
            e.preventDefault();
            break;
          case 'k':
          case 'ArrowUp':
            cbs.onNavigateEmail('prev');
            e.preventDefault();
            break;
          case 'r':
            if (e.shiftKey) {
              cbs.onReplyAll();
            } else {
              cbs.onReply();
            }
            e.preventDefault();
            break;
          case 'f':
            cbs.onForward();
            e.preventDefault();
            break;
          case 's':
            if (selectedEmailId && selectedEmail) {
              cbs.onToggleStar(selectedEmailId, !!selectedEmail.keywords?.['$flagged']);
            }
            e.preventDefault();
            break;
          case 'a':
          case 'e':
            if (!e.metaKey && !e.ctrlKey) {
              cbs.onArchive();
              e.preventDefault();
            }
            break;
          case 'd':
          case '#':
            if (!e.metaKey && !e.ctrlKey) {
              cbs.onDelete();
              e.preventDefault();
            }
            break;
          case '?':
            cbs.onShowShortcutsHelp();
            e.preventDefault();
            break;
          case '/':
            (document.querySelector('input[placeholder="Search"]') as HTMLInputElement)?.focus();
            e.preventDefault();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    // Only state values that affect listener behavior - NOT callbacks (stored in ref)
    // selectedEmailIds is now accessed via ref to avoid stale closure issues
    emails, selectedMailboxId, rawViewerBlobId,
    isSettingsOpen, isComposerOpen, moreMenuOpen, showShortcutsHelp,
    selectedEmailId, selectedEmail,
  ]);
}
