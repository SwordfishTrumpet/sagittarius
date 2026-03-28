import { useEffect } from 'react'

interface KeyboardShortcutsConfig {
  emails: any[] | undefined
  selectedMailboxId: string | null
  selectedEmailId: string | null
  selectedEmail: any
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
  onToggleFlag: (emailId: string, currentFlagged: boolean) => void
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
    onToggleFlag,
    onArchive,
    onDelete,
    onShowShortcutsHelp,
  } = config;

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
      // CMD/CTRL + A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && emails && selectedMailboxId) {
        e.preventDefault();
        onSelectAll();
      }
      // CMD/CTRL + B to toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        onToggleSidebar();
      }
      // CMD/CTRL + Shift + N: new compose
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        e.preventDefault();
        onCompose();
        return;
      }
      // ESC: close modals first, then clear selection
      if (e.key === 'Escape') {
        if (showShortcutsHelp) { onCloseShortcutsHelp(); return; }
        if (rawViewerBlobId) { onCloseRawViewer(); return; }
        if (isSettingsOpen) { onCloseSettings(); return; }
        if (isComposerOpen) { onCloseComposer(); return; }
        if (moreMenuOpen) { onCloseMoreMenu(); return; }
        if (selectedEmailIds.size > 0) onClearSelection();
        return;
      }

      // --- Shortcuts that only fire when NOT typing in an input ---
      if (!isInputFocused()) {
        switch (e.key) {
          case 'j':
          case 'ArrowDown':
            onNavigateEmail('next');
            e.preventDefault();
            break;
          case 'k':
          case 'ArrowUp':
            onNavigateEmail('prev');
            e.preventDefault();
            break;
          case 'r':
            if (e.shiftKey) {
              onReplyAll();
            } else {
              onReply();
            }
            e.preventDefault();
            break;
          case 'f':
            onForward();
            e.preventDefault();
            break;
          case 's':
            if (selectedEmailId && selectedEmail) {
              onToggleFlag(selectedEmailId, !!selectedEmail.keywords?.['$flagged']);
            }
            e.preventDefault();
            break;
          case 'a':
          case 'e':
            if (!e.metaKey && !e.ctrlKey) {
              onArchive();
              e.preventDefault();
            }
            break;
          case 'd':
          case '#':
            if (!e.metaKey && !e.ctrlKey) {
              onDelete();
              e.preventDefault();
            }
            break;
          case '?':
            onShowShortcutsHelp();
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
    emails, selectedMailboxId, selectedEmailIds.size, rawViewerBlobId,
    isSettingsOpen, isComposerOpen, moreMenuOpen, showShortcutsHelp,
    selectedEmailId, selectedEmail, onNavigateEmail, onReply, onReplyAll, onForward,
    onSelectAll, onClearSelection, onToggleSidebar, onCompose,
    onCloseShortcutsHelp, onCloseRawViewer, onCloseSettings, onCloseComposer,
    onCloseMoreMenu, onToggleFlag, onArchive, onDelete, onShowShortcutsHelp,
  ]);
}
