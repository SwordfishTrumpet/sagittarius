import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Toaster, toast } from 'sonner'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { AnimatePresence } from 'framer-motion'
import { Login } from './components/Login'
import { Composer } from './components/Composer'
import { VirtualMessageList } from './components/VirtualMessageList'
import { jmapClient } from './api/jmap'
import { useMailboxes } from './hooks/jmap/useMailboxes'
import { useEmailDetail, useThreads } from './hooks/jmap/useEmailQueries'
import { useEmailActions } from './hooks/jmap/useEmailMutations'
import { useIdentities } from './hooks/jmap/useIdentities'
import { useEmailBulkActions } from './hooks/useEmailBulkActions'
import { useFolderDialogs } from './hooks/useFolderDialogs'
import { useCustomFolderTree } from './hooks/useCustomFolderTree'
import { useQuota } from './hooks/useQuota'
import { Settings } from './components/Settings'
import { EmailImportZone } from './components/EmailImportZone'
import { RawEmailViewer } from './components/RawEmailViewer'
import { useSendMDN } from './hooks/useMDN'
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'
import { ResizeHandle } from './components/ResizeHandle'
import { useResizablePane } from './hooks/useResizablePane'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toolbar } from './components/Toolbar'
import { EmailReader } from './components/EmailReader'
import { Sidebar } from './components/Sidebar'
import { ConnectionStatusBadge } from './components/ConnectionStatusBadge'
import { MessageListHeader } from './components/MessageListHeader'
import { LiveRegion } from './components/accessible/LiveRegion'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { formatMessageDate } from './utils/dateFormat'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useOfflineSyncQueue } from './hooks/useOfflineSyncQueue'
import { usePushConnection } from './hooks/usePushConnection'

function App() {
  const [session, setSession] = useState(jmapClient.getStoredSession())
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set())
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [replyToEmail, setReplyToEmail] = useState<any>(null)
  const [removingEmailIds, setRemovingEmailIds] = useState<Set<string>>(new Set())
  
  // Sidebar section expansion state
  const [expandedSections, setExpandedSections] = useState({
    mailboxes: true,
    folders: true,
  })

    // Sidebar visibility state
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    // Resizable pane widths
    const sidebarResize = useResizablePane({
      storageKey: 'sagittarius_sidebar_width',
      defaultWidth: 260,
      minWidth: 180,
      maxWidth: 400,
    })
    const messageListResize = useResizablePane({
      storageKey: 'sagittarius_message_list_width',
      defaultWidth: 350,
      minWidth: 250,
      maxWidth: 600,
    })
    const isAnyPaneResizing = sidebarResize.isDragging || messageListResize.isDragging

  const { data: mailboxes, isLoading: mailboxesLoading, refetch: refetchMailboxes } = useMailboxes()
  const [searchTerm, setSearchTerm] = useState('')
  const { data: identities } = useIdentities()
  const primaryIdentity = identities?.[0]

  // Quick list filters state (must be before quickJMAPFilter memo)
  const [activeListFilters, setActiveListFilters] = useState<Set<string>>(new Set())
  const [showFilterBar, setShowFilterBar] = useState(false)

  // Keyboard shortcuts help overlay
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)

  // Track last keyboard-navigated email for scroll-to
  const [scrollToEmailId, setScrollToEmailId] = useState<string | null>(null)

  // User email for "To Me" filter and sidebar display
  const userEmail = primaryIdentity?.email || session?.username || '';
  const userLabel = userEmail.includes('@') ? userEmail.split('@')[0] : (session?.username || '');

  // Build JMAP filter from active quick filters
  const quickJMAPFilter = useMemo(() => {
    if (activeListFilters.size === 0) return undefined;
    const conditions: Record<string, any>[] = [];
    if (activeListFilters.has('unread')) conditions.push({ notHasKeyword: '$seen' });
    if (activeListFilters.has('flagged')) conditions.push({ hasKeyword: '$flagged' });
    if (activeListFilters.has('toMe')) conditions.push({ to: [{ email: userEmail }] });
    if (activeListFilters.has('attachments')) conditions.push({ hasAttachment: true });
    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return { allOf: conditions };
  }, [activeListFilters, userEmail]);

  const { data: emails, isLoading: emailsLoading, isRefetching: emailsRefetching } = useThreads(selectedMailboxId || undefined, searchTerm, quickJMAPFilter)
  const { data: threadEmails, isLoading: emailLoading, error: emailDetailError, isError: isEmailDetailError } = useEmailDetail(selectedEmailId || undefined, selectedThreadId || undefined)
  const { updateKeywords } = useEmailActions()
  // Custom folder tree (expansion, reorder, reparent)
  const { customFolderTree, handleMailboxReorder, handleMailboxReparent, handleToggleFolderExpanded } = useCustomFolderTree(mailboxes)

  // Folder dialogs & context menu
  const {
    handleMailboxContextMenu,
    openCreateFolder,
    selectedFolderId,
    setSelectedFolderId,
    selectedFolderName,
    setSelectedFolderName,
    renameMailbox,
    deleteMailbox,
    FolderDialogsUI,
  } = useFolderDialogs({ selectedMailboxId, setSelectedMailboxId })

  const {
    pushEnabled,
    pushConnected,
    hasNewMail,
    clearNewMail,
  } = usePushConnection(!!session)
  const { data: quota } = useQuota()
  const sendMDN = useSendMDN()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [rawViewerBlobId, setRawViewerBlobId] = useState<string | null>(null)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [liveAnnouncement, setLiveAnnouncement] = useState('')
  const delayedMoveTimersRef = useRef<Set<number>>(new Set())
  const { isOffline } = useNetworkStatus()
  const { pendingCount, isReplaying, replayQueue } = useOfflineSyncQueue()

  // DRY helper: reset all selection state (used on mailbox change, archive, delete)
  const resetSelection = useCallback(() => {
    setSelectedEmailId(null);
    setSelectedThreadId(null);
    setSelectedEmailIds(new Set());
  }, []);

  // Bulk email actions (archive, delete) with undo support
  const { handleArchive, handleDelete, moveEmail, moveEmailBulk } = useEmailBulkActions({
    emails,
    mailboxes,
    selectedEmailId,
    selectedEmailIds,
    resetSelection,
  });

  // DRY helper: select a mailbox and reset all transient state
  const selectMailbox = useCallback((mailboxId: string) => {
    setSelectedMailboxId(mailboxId);
    resetSelection();
    setSearchTerm('');
    setActiveListFilters(new Set());
    setShowFilterBar(false);
  }, [resetSelection]);

  // DRY helper: move emails to a mailbox with animation + toast
  const moveEmailsToFolder = useCallback((emailIds: string[], mailboxId: string, folderName: string) => {
    emailIds.forEach(id => setRemovingEmailIds(prev => new Set(prev).add(id)));
    const timerId = window.setTimeout(() => {
      delayedMoveTimersRef.current.delete(timerId)
      if (emailIds.length === 1) {
        moveEmail.mutate({ emailId: emailIds[0], mailboxIds: { [mailboxId]: true } });
      } else {
        moveEmailBulk.mutate({ emailIds, mailboxIds: { [mailboxId]: true } });
      }
      toast.success(`Moved ${emailIds.length > 1 ? emailIds.length + ' messages' : '1 message'} to ${folderName}`);
      setRemovingEmailIds(prev => { const n = new Set(prev); emailIds.forEach(id => n.delete(id)); return n; });
    }, 300);
    delayedMoveTimersRef.current.add(timerId)
  }, [moveEmail, moveEmailBulk]);

  // Quick filter toggle handler
  const handleToggleListFilter = useCallback((filter: string) => {
    setActiveListFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }, []);

  // --- Selected email (from thread detail) ---
  const selectedEmail = useMemo(() => {
    return threadEmails?.find((e: any) => e.id === selectedEmailId) || threadEmails?.[threadEmails.length - 1];
  }, [threadEmails, selectedEmailId]);

  // --- Reply / Forward handlers (shared between buttons + keyboard shortcuts) ---
  const handleReply = useCallback(() => {
    if (!selectedEmail) return;
    setReplyToEmail(selectedEmail);
    setIsComposerOpen(true);
  }, [selectedEmail]);

  const handleReplyAll = useCallback(() => {
    if (!selectedEmail) return;
    setReplyToEmail({ ...selectedEmail, _replyAll: true });
    setIsComposerOpen(true);
  }, [selectedEmail]);

  const handleForward = useCallback(() => {
    if (!selectedEmail) return;
    setReplyToEmail({ ...selectedEmail, _forward: true });
    setIsComposerOpen(true);
  }, [selectedEmail]);

  // --- Keyboard navigation helper ---
  const navigateEmail = useCallback((direction: 'next' | 'prev') => {
    if (!emails || emails.length === 0) return;
    const currentIndex = selectedEmailId
      ? emails.findIndex((e: any) => e.id === selectedEmailId)
      : -1;
    let newIndex: number;
    if (direction === 'next') {
      newIndex = currentIndex < emails.length - 1 ? currentIndex + 1 : currentIndex;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    }
    const newEmail = emails[newIndex];
    if (newEmail) {
      setSelectedEmailId(newEmail.id);
      setSelectedThreadId(newEmail.threadId || null);
      setSelectedEmailIds(new Set([newEmail.id]));
      setScrollToEmailId(newEmail.id);
    }
  }, [emails, selectedEmailId]);

  const handleToggleFlag = (emailId: string, currentFlagged: boolean) => {
    updateKeywords.mutate({ 
      emailId, 
      keywords: { '$flagged': !currentFlagged } 
    });
  }

  const toggleEmailSelection = (emailId: string, ctrlKey: boolean, shiftKey: boolean) => {
    const newSelection = new Set(selectedEmailIds);
    
    if (shiftKey && selectedEmailId && emails) {
      // Shift+click: select range
      const currentIndex = emails.findIndex((e: any) => e.id === selectedEmailId);
      const clickedIndex = emails.findIndex((e: any) => e.id === emailId);
      const start = Math.min(currentIndex, clickedIndex);
      const end = Math.max(currentIndex, clickedIndex);
      for (let i = start; i <= end; i++) {
        newSelection.add(emails[i].id);
      }
    } else if (ctrlKey) {
      // Ctrl/Cmd+click: toggle individual
      if (newSelection.has(emailId)) {
        newSelection.delete(emailId);
      } else {
        newSelection.add(emailId);
      }
    } else {
      // Regular click: select only this one
      newSelection.clear();
      newSelection.add(emailId);
    }
    
    setSelectedEmailIds(newSelection);
    setSelectedEmailId(emailId);
    setSelectedThreadId(emails?.find((e: any) => e.id === emailId)?.threadId || null);
  }

  const selectAllEmails = () => {
    if (emails) {
      const allIds = new Set<string>(emails.map((e: any) => e.id));
      setSelectedEmailIds(allIds);
    }
  }

  const clearSelection = () => {
    setSelectedEmailIds(new Set());
  }


  // Close more menu on outside click
  useEffect(() => {
    return () => {
      delayedMoveTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      delayedMoveTimersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClickOutside = () => setMoreMenuOpen(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [moreMenuOpen]);

  useKeyboardShortcuts({
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
    onSelectAll: selectAllEmails,
    onClearSelection: clearSelection,
    onToggleSidebar: () => setIsSidebarCollapsed(prev => !prev),
    onCompose: () => { setReplyToEmail(null); setIsComposerOpen(true); },
    onCloseShortcutsHelp: () => setShowShortcutsHelp(false),
    onCloseRawViewer: () => setRawViewerBlobId(null),
    onCloseSettings: () => setIsSettingsOpen(false),
    onCloseComposer: () => { setIsComposerOpen(false); setReplyToEmail(null); },
    onCloseMoreMenu: () => setMoreMenuOpen(false),
    onNavigateEmail: navigateEmail,
    onReply: handleReply,
    onReplyAll: handleReplyAll,
    onForward: handleForward,
    onToggleFlag: handleToggleFlag,
    onArchive: handleArchive,
    onDelete: handleDelete,
    onShowShortcutsHelp: () => setShowShortcutsHelp(true),
  });

  useEffect(() => {
    if (mailboxes && !selectedMailboxId) {
      const inbox = mailboxes.find((m: any) => m.role === 'inbox' || (!m.role && m.name.toLowerCase() === 'inbox')) || mailboxes[0]
      if (inbox) setSelectedMailboxId(inbox.id)
    }
  }, [mailboxes, selectedMailboxId])

  useEffect(() => {
    if (!session) return

    if (emailsLoading || emailsRefetching) {
      setLiveAnnouncement('Loading messages...')
      return
    }

    if (selectedMailboxId) {
      const count = emails?.length ?? 0
      setLiveAnnouncement(`${count} ${count === 1 ? 'message' : 'messages'} loaded`)
    }
  }, [emails, emailsLoading, emailsRefetching, selectedMailboxId, session])

  useEffect(() => {
    if (!selectedEmailId) return

    if (emailLoading) {
      setLiveAnnouncement('Loading email...')
      return
    }

    if (selectedEmail) {
      const sender = selectedEmail.from?.[0]?.name || selectedEmail.from?.[0]?.email || 'unknown sender'
      setLiveAnnouncement(`Email from ${sender} loaded`)
    }
  }, [emailLoading, selectedEmail, selectedEmailId])

  const handleResizeKeyDown = useCallback((pane: typeof sidebarResize, event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      pane.adjustWidth(-10)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      pane.adjustWidth(10)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      pane.setWidth(pane.minWidth)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      pane.setWidth(pane.maxWidth)
    }
  }, [])

  if (!session) {
    return <Login onLoginSuccess={() => setSession(jmapClient.getStoredSession())} />
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="relative flex h-full w-full bg-[#F2F2F7] text-[13px]">
        <LiveRegion message={liveAnnouncement} />
        {(isOffline || pendingCount > 0) && (
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto absolute left-1/2 top-4 z-[350] -translate-x-1/2 flex items-center gap-3 rounded-full px-4 py-2 text-[12px] font-semibold text-white shadow-lg backdrop-blur ${
              isOffline ? 'bg-[#FF9500]/95' : 'bg-[#007AFF]/95'
            }`}
          >
            <span>{isOffline ? 'Offline — cached mail only' : isReplaying ? 'Syncing queued changes…' : 'Pending sync available'}</span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
                {pendingCount} pending
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                void replayQueue().then(({ syncedCount }) => {
                  if (syncedCount > 0) {
                    toast.success(`Synced ${syncedCount} queued change${syncedCount === 1 ? '' : 's'}`)
                  }
                })
              }}
              disabled={isOffline || isReplaying || pendingCount === 0}
              className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isReplaying ? 'Syncing…' : 'Retry now'}
            </button>
          </div>
        )}
        <a
          href="#main-content"
          className="sr-only absolute left-4 top-4 z-[400] rounded-md bg-white px-3 py-2 text-[13px] font-medium text-[#007AFF] shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
        >
          Skip to main content
        </a>
        <Toaster
          position="bottom-center"
          containerAriaLabel="Notifications"
          closeButton
          toastOptions={{
            closeButtonAriaLabel: 'Dismiss notification',
            style: {
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              color: '#1C1C1E',
              fontSize: '14px',
              fontWeight: 500,
            },
          }}
        />
        {/* Sidebar - iCloud Glassmorphic */}
        <Sidebar
          session={session}
          userLabel={userLabel}
          mailboxes={mailboxes}
          mailboxesLoading={mailboxesLoading}
          refetchMailboxes={refetchMailboxes}
          selectedMailboxId={selectedMailboxId}
          isSidebarCollapsed={isSidebarCollapsed}
          isAnyPaneResizing={isAnyPaneResizing}
          sidebarWidth={sidebarResize.width}
          expandedSections={expandedSections}
          customFolderTree={customFolderTree}
          hasNewMail={hasNewMail}
          esConnected={pushConnected}
          isOffline={isOffline}
          quota={quota}
          onToggleSidebarCollapsed={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onCompose={() => { setReplyToEmail(null); setIsComposerOpen(true); }}
          onSelectMailbox={selectMailbox}
          onClearNewMail={clearNewMail}
          onMailboxContextMenu={handleMailboxContextMenu}
          onMoveEmailsToFolder={moveEmailsToFolder}
          onToggleSectionExpanded={(section) => setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))}
           onCreateFolder={openCreateFolder}
          onToggleFolderExpanded={handleToggleFolderExpanded}
          onRenameMailbox={(mailboxId, newName) => renameMailbox.mutate({ mailboxId, newName })}
          onDeleteMailbox={(mailboxId) => deleteMailbox.mutate({ mailboxId })}
          onReorderMailbox={handleMailboxReorder}
          onReparentMailbox={handleMailboxReparent}
          onOpenSettings={() => setIsSettingsOpen(true)}
          resetSelection={resetSelection}
          setSelectedMailboxId={setSelectedMailboxId}
          setSelectedFolderId={setSelectedFolderId}
          setSelectedFolderName={setSelectedFolderName}
        />

        {/* Sidebar Resize Handle */}
        {!isSidebarCollapsed && (
          <ResizeHandle
            onPointerDown={sidebarResize.handlePointerDown}
            isDragging={sidebarResize.isDragging}
            onDoubleClick={() => setIsSidebarCollapsed(true)}
            onKeyDown={(event) => handleResizeKeyDown(sidebarResize, event)}
            ariaLabel="Resize sidebar"
            valueNow={sidebarResize.width}
            valueMin={sidebarResize.minWidth}
            valueMax={sidebarResize.maxWidth}
          />
        )}

        {/* Message List Pane */}
        <main
          id="main-content"
          aria-label="Message list"
          className={`flex flex-col bg-white border-r border-[#E5E5E5] h-full overflow-hidden shrink-0 select-none ${isAnyPaneResizing ? '' : 'transition-all duration-300'}`}
          style={{ width: messageListResize.width }}
        >
          <MessageListHeader
            title={
              selectedMailboxId === 'all' ? 'All Mail' : 
              selectedMailboxId === 'flagged' ? 'Flagged' :
              mailboxes?.find((m: any) => m.id === selectedMailboxId)?.name || 'Messages'
            }
            isSidebarCollapsed={isSidebarCollapsed}
            emails={emails}
            selectedEmailIds={selectedEmailIds}
            searchTerm={searchTerm}
            showFilterBar={showFilterBar}
            activeListFilters={activeListFilters}
            onShowSidebar={() => setIsSidebarCollapsed(false)}
            onSelectAll={selectAllEmails}
            onClearSelection={clearSelection}
            onToggleFilterBar={() => setShowFilterBar(prev => !prev)}
            onSearchChange={setSearchTerm}
            onClearSearch={() => setSearchTerm('')}
            onToggleListFilter={handleToggleListFilter}
          />
           
           <VirtualMessageList
             emails={emails || []}
             isLoading={emailsLoading}
             isRefetching={emailsRefetching}
             selectedEmailId={selectedEmailId}
             selectedEmailIds={selectedEmailIds}
             mailboxes={mailboxes || []}
             onToggleSelection={toggleEmailSelection}
             onToggleFlag={handleToggleFlag}
             formatMessageDate={formatMessageDate}
             removingEmailIds={removingEmailIds}
             scrollToEmailId={scrollToEmailId}
           />
        </main>

        {/* Message List Resize Handle */}
        <ResizeHandle
          onPointerDown={messageListResize.handlePointerDown}
          isDragging={messageListResize.isDragging}
          onKeyDown={(event) => handleResizeKeyDown(messageListResize, event)}
          ariaLabel="Resize message list"
          valueNow={messageListResize.width}
          valueMin={messageListResize.minWidth}
          valueMax={messageListResize.maxWidth}
        />

        {/* Reading Pane */}
        <ErrorBoundary>
        <section aria-label="Email reading pane" className="flex-1 flex flex-col bg-white h-full overflow-hidden relative select-none">
          <Toolbar
            selectedEmailId={selectedEmailId}
            selectedEmail={selectedEmail}
            selectedEmailIds={selectedEmailIds}
            moreMenuOpen={moreMenuOpen}
            statusBadge={
              <ConnectionStatusBadge
                isOffline={isOffline}
                isPushEnabled={pushEnabled}
                isPushConnected={pushConnected}
                pendingCount={pendingCount}
                isReplaying={isReplaying}
              />
            }
            onReply={handleReply}
            onReplyAll={handleReplyAll}
            onForward={handleForward}
            onToggleFlag={handleToggleFlag}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onToggleMoreMenu={() => setMoreMenuOpen(!moreMenuOpen)}
            onViewSource={(blobId) => setRawViewerBlobId(blobId)}
            onCloseMoreMenu={() => setMoreMenuOpen(false)}
          />

          <EmailReader
            threadEmails={threadEmails}
            emailLoading={emailLoading}
            isEmailDetailError={isEmailDetailError}
            emailDetailError={emailDetailError as Error | null}
            selectedEmailId={selectedEmailId}
            mailboxes={mailboxes}
            primaryIdentity={primaryIdentity}
            sendMDN={sendMDN}
            updateKeywords={updateKeywords}
          />

        </section>
        </ErrorBoundary>
        {/* Composer Modal */}
        <ErrorBoundary>
        <AnimatePresence>
          {isComposerOpen && (
            <Composer 
              onClose={() => {
                setIsComposerOpen(false);
                setReplyToEmail(null);
              }} 
              replyTo={replyToEmail}
            />
          )}
        </AnimatePresence>
        </ErrorBoundary>

        {/* Context Menu & Folder Dialogs */}
        <FolderDialogsUI />

        {/* Settings Modal */}
        <ErrorBoundary>
        <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </ErrorBoundary>

        {/* Keyboard Shortcuts Help */}
        <KeyboardShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />

        {/* Email Import Zone (drag .eml files to import) */}
        {selectedMailboxId && selectedMailboxId !== 'all' && selectedMailboxId !== 'flagged' && (
          <EmailImportZone mailboxId={selectedMailboxId} />
        )}

        {/* Raw Email Source Viewer */}
        {rawViewerBlobId && (
          <RawEmailViewer blobId={rawViewerBlobId} onClose={() => setRawViewerBlobId(null)} />
        )}
      </div>
    </DndProvider>
  )
}

export default App
