import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Toaster, toast } from 'sonner'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { Login } from './components/Login'
import { Composer } from './components/Composer'
import { VirtualMessageList } from './components/VirtualMessageList'
import { jmapClient } from './api/jmap'
import { useMailboxes } from './hooks/jmap/useMailboxes'
import { useEmailDetail, useThreads, fetchEmailWithBody } from './hooks/jmap/useEmailQueries'
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
import { useIsMobile } from './hooks/useIsMobile'
import { Toolbar } from './components/Toolbar'
import { EmailReader } from './components/EmailReader'
import { Sidebar } from './components/Sidebar'
import { ConnectionStatusBadge } from './components/ConnectionStatusBadge'
import { MessageListHeader } from './components/MessageListHeader'
import { LiveRegion } from './components/accessible/LiveRegion'
import { CalendarView } from './components/CalendarView'
import { ContactsView } from './components/ContactsView'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { formatMessageDate } from './utils/dateFormat'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { DEBOUNCE } from './utils/constants'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useOfflineSyncQueue } from './hooks/useOfflineSyncQueue'
import { usePushConnection } from './hooks/usePushConnection'
import { useAppUpdateChecker } from './hooks/useAppUpdateChecker'
import type { Mailbox, Email } from './types/jmap'

// Extracted state hooks
import { useEmailSelection } from './hooks/useEmailSelection'
import { useComposerState } from './hooks/useComposerState'
import { useListFilters } from './hooks/useListFilters'
import { useEmailNavigation } from './hooks/useEmailNavigation'
import { useAnimatedEmailMoves } from './hooks/useAnimatedEmailMoves'
import { useAppSidebar } from './hooks/useAppSidebar'
import { useTheme } from './hooks/useTheme'

function App() {
  const queryClient = useQueryClient()
  const [session, setSession] = useState(jmapClient.getStoredSession())
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm, DEBOUNCE.search)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [liveAnnouncement, setLiveAnnouncement] = useState('')
  const [rawViewerBlobId, setRawViewerBlobId] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isContactsOpen, setIsContactsOpen] = useState(false)

  // Check for app updates periodically
  useAppUpdateChecker()

  // Mobile detection and navigation
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState<'mailboxes' | 'list' | 'reader'>('mailboxes')

  // Theme
  const { isDark } = useTheme()

  // Data fetching hooks
  const { data: mailboxes, isLoading: mailboxesLoading, refetch: refetchMailboxes } = useMailboxes()
  const { data: identities } = useIdentities()
  const primaryIdentity = identities?.[0]

  // User email for "To Me" filter and sidebar display
  const userEmail = primaryIdentity?.email || session?.username || ''
  const userLabel = userEmail.includes('@') ? userEmail.split('@')[0] : (session?.username || '')

  // List filters
  const {
    activeFilters,
    hasActiveFilters,
    activeFilterCount,
    dialogSearchFilter,
    showFilterDialog,
    openFilterDialog,
    closeFilterDialog,
    applyFilters,
    clearFilters,
  } = useListFilters({ userEmail })

  const allMailExcludeIds = useMemo(() => {
    if (!mailboxes) return undefined
    const EXCLUDE_ROLES = new Set(['trash', 'spam', 'junk'])
    return mailboxes
      .filter((m: Mailbox) => m.role && EXCLUDE_ROLES.has(m.role as string))
      .map((m: Mailbox) => m.id)
  }, [mailboxes])

  // Email threads
  const { data: emails, isLoading: emailsLoading, isRefetching: emailsRefetching, refetch: refetchEmails } = useThreads(
    selectedMailboxId || undefined,
    debouncedSearchTerm,
    dialogSearchFilter,
    selectedMailboxId === 'all' ? allMailExcludeIds : undefined,
  )

  // Email selection state
  const {
    selectedEmailId,
    selectedThreadId,
    selectedEmailIds,
    setSelectedEmailId,
    setSelectedThreadId,
    setSelectedEmailIds,
    resetSelection,
    toggleEmailSelection,
    selectAllEmails,
    clearSelection,
    selectedEmail,
  } = useEmailSelection({ emails })

  // Email detail
  const { data: threadEmails, isLoading: emailLoading, error: emailDetailError, isError: isEmailDetailError } = useEmailDetail(
    selectedEmailId || undefined,
    selectedThreadId || undefined
  )

  const { updateKeywords, destroyEmail } = useEmailActions()

  // Memoized handlers to prevent unnecessary re-renders
  const handleToggleStar = useCallback((emailId: string, starred: boolean) => {
    updateKeywords.mutate({ emailId, keywords: { '$flagged': !starred } })
  }, [updateKeywords])

  // Handler for marking email as unread
  const handleMarkUnread = useCallback(() => {
    if (selectedEmailId) {
      updateKeywords.mutate({ emailId: selectedEmailId, keywords: { '$seen': false } })
    }
  }, [selectedEmailId, updateKeywords])

  // Sidebar state
  const {
    isSidebarCollapsed,
    expandedSections,
    toggleSidebarCollapsed,
    expandSidebar,
    collapseSidebar,
    toggleSectionExpanded,
  } = useAppSidebar()

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

  // Custom folder tree
  const { customFolderTree, handleMailboxReorder, handleMailboxReparent, handleToggleFolderExpanded } = useCustomFolderTree(mailboxes)

  // Folder dialogs
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
  } = useFolderDialogs({ selectedMailboxId, setSelectedMailboxId, mailboxes, onReparentMailbox: handleMailboxReparent })

  // Push connection
  const { pushEnabled, pushConnected, hasNewMail, clearNewMail } = usePushConnection(!!session)

  // Quota and MDN
  const { data: quota } = useQuota()
  const sendMDN = useSendMDN()

  // Offline sync
  const { isOffline } = useNetworkStatus()
  const { pendingCount, isReplaying, replayQueue } = useOfflineSyncQueue()

  // Composer state
  const {
    isComposerOpen,
    replyToEmail,
    draftEmail,
    openComposer,
    closeComposer,
    handleReply,
    handleReplyAll,
    handleForward,
    handleOpenDraft,
  } = useComposerState()

  // Dynamic page title
  const viewTitle = useMemo(() => {
    if (!session) return 'Sign In – Sagittarius';
    const mailboxName = selectedMailboxId === 'all' ? 'All Mail' :
      selectedMailboxId === 'flagged' ? 'Flagged' :
      mailboxes?.find((m: Mailbox) => m.id === selectedMailboxId)?.name || '';
    if (isComposerOpen) return `Compose – Sagittarius`;
    if (isSettingsOpen) return `Settings – Sagittarius`;
    if (isCalendarOpen) return `Calendar – Sagittarius`;
    if (isContactsOpen) return `Contacts – Sagittarius`;
    if (mailboxName) return `${mailboxName} – Sagittarius`;
    return 'Sagittarius';
  }, [session, selectedMailboxId, mailboxes, isComposerOpen, isSettingsOpen, isCalendarOpen, isContactsOpen]);

  useEffect(() => {
    document.title = viewTitle;
  }, [viewTitle]);

  // Bulk email actions
  const { handleArchive, handleDelete, moveEmail, moveEmailBulk } = useEmailBulkActions({
    emails,
    mailboxes,
    selectedEmailId,
    selectedEmailIds,
    selectedMailboxId,
    resetSelection,
  })

  // Context menu action handlers that accept emailId
  // Fetch full email body first since list emails only have preview
  const handleReplyFromId = useCallback(async (emailId: string) => {
    const listEmail = emails?.find((e) => e.id === emailId)
    if (!listEmail) return
    
    // Fetch full email with body content for quoting
    const fullEmail = await fetchEmailWithBody(emailId)
    if (fullEmail) {
      handleReply(fullEmail)
    } else {
      // Fallback to list email if fetch fails (no quoting)
      handleReply(listEmail)
    }
  }, [emails, handleReply])

  const handleReplyAllFromId = useCallback(async (emailId: string) => {
    const listEmail = emails?.find((e) => e.id === emailId)
    if (!listEmail) return
    
    const fullEmail = await fetchEmailWithBody(emailId)
    if (fullEmail) {
      handleReplyAll(fullEmail)
    } else {
      handleReplyAll(listEmail)
    }
  }, [emails, handleReplyAll])

  const handleForwardFromId = useCallback(async (emailId: string) => {
    const listEmail = emails?.find((e) => e.id === emailId)
    if (!listEmail) return
    
    const fullEmail = await fetchEmailWithBody(emailId)
    if (fullEmail) {
      handleForward(fullEmail)
    } else {
      handleForward(listEmail)
    }
  }, [emails, handleForward])

  // Animated email moves
  const { removingEmailIds, moveEmailsToFolder } = useAnimatedEmailMoves({
    onMoveAsync: moveEmail.mutateAsync,
    onMoveBulkAsync: moveEmailBulk.mutateAsync,
  })

  const handleArchiveFromId = useCallback((emailId: string) => {
    if (!mailboxes) return
    const archiveBox = mailboxes.find((m: Mailbox) => m.role === 'archive' || m.name.toLowerCase() === 'archive')
    if (archiveBox) {
      moveEmailsToFolder([emailId], archiveBox.id, 'Archive')
    }
  }, [mailboxes, moveEmailsToFolder])

  const handleDeleteFromId = useCallback((emailId: string) => {
    if (!mailboxes) return
    const trashBox = mailboxes.find((m: Mailbox) => 
      m.role === 'trash' || m.name.toLowerCase() === 'trash' || m.name.toLowerCase() === 'deleted items'
    )
    if (trashBox && selectedMailboxId === trashBox.id) {
      destroyEmail.mutate({ emailId })
    } else if (trashBox) {
      moveEmailsToFolder([emailId], trashBox.id, 'Trash')
    } else {
      destroyEmail.mutate({ emailId })
    }
  }, [mailboxes, selectedMailboxId, destroyEmail, moveEmailsToFolder])

  // Mobile swipe handlers - work directly with emailId, not selectedEmailId
  const handleSwipeArchive = useCallback((emailId: string) => {
    if (!mailboxes) return
    const archiveBox = mailboxes.find((m: Mailbox) => m.role === 'archive' || m.name.toLowerCase() === 'archive')
    if (archiveBox) {
      moveEmailsToFolder([emailId], archiveBox.id, 'Archive')
    }
  }, [mailboxes, moveEmailsToFolder])

  const handleSwipeDelete = useCallback((emailId: string) => {
    if (!mailboxes) return
    const trashBox = mailboxes.find((m: Mailbox) => 
      m.role === 'trash' || m.name.toLowerCase() === 'trash' || m.name.toLowerCase() === 'deleted items'
    )
    if (trashBox) {
      // Move to trash (soft delete)
      moveEmailsToFolder([emailId], trashBox.id, 'Trash')
    } else {
      // Permanent delete if no trash folder
      destroyEmail.mutate({ emailId })
    }
  }, [mailboxes, moveEmailsToFolder, destroyEmail])

  // Select mailbox helper
  const selectMailbox = useCallback((mailboxId: string) => {
    // Cancel any in-flight email detail queries to prevent stale data display
    queryClient.cancelQueries({ queryKey: ['emailDetail'] })
    setSelectedMailboxId(mailboxId)
    resetSelection()
    setSearchTerm('')
    clearFilters()
    // On mobile, switch to list view when selecting a mailbox
    if (isMobile) {
      setMobileView('list')
    }
  }, [queryClient, resetSelection, clearFilters, isMobile])

  // Mobile navigation helpers
  const handleShowSidebar = useCallback(() => {
    if (isMobile) {
      setMobileView('mailboxes')
    } else {
      expandSidebar()
    }
  }, [isMobile, expandSidebar])

  const navigateToEmailList = useCallback(() => {
    setMobileView('list')
  }, [])

  const navigateToReader = useCallback(() => {
    if (selectedEmailId) {
      setMobileView('reader')
    }
  }, [selectedEmailId])

  // Handle email selection with mobile navigation
  const handleSelectEmail = useCallback((emailId: string, threadId: string | null) => {
    setSelectedEmailId(emailId)
    setSelectedThreadId(threadId)
    setSelectedEmailIds(new Set([emailId]))
    // On mobile, navigate to reader when selecting an email
    if (isMobile) {
      setMobileView('reader')
    }
  }, [isMobile])

  const { scrollToEmailId, navigateToNext, navigateToPrevious } = useEmailNavigation({
    emails,
    currentEmailId: selectedEmailId,
    onSelectEmail: handleSelectEmail,
  })

  useEffect(() => {
    if (!moreMenuOpen) return
    let listener: (() => void) | null = null
    const timer = setTimeout(() => {
      listener = () => setMoreMenuOpen(false)
      document.addEventListener('click', listener)
    }, 0)
    return () => {
      clearTimeout(timer)
      if (listener) document.removeEventListener('click', listener)
    }
  }, [moreMenuOpen])

  // Keyboard shortcuts
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
    onToggleSidebar: toggleSidebarCollapsed,
    onCompose: openComposer,
    onCloseShortcutsHelp: () => setShowShortcutsHelp(false),
    onCloseRawViewer: () => setRawViewerBlobId(null),
    onCloseSettings: () => setIsSettingsOpen(false),
    onCloseComposer: closeComposer,
    onCloseMoreMenu: () => setMoreMenuOpen(false),
    onNavigateEmail: (direction) => {
      if (direction === 'next') navigateToNext()
      else navigateToPrevious()
    },
    onReply: async () => { 
      if (!selectedEmailId) return
      try {
        const fullEmail = await fetchEmailWithBody(selectedEmailId)
        if (fullEmail) handleReply(fullEmail)
      } catch (error) {
        toast.error(`Failed to load email: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },
    onReplyAll: async () => { 
      if (!selectedEmailId) return
      try {
        const fullEmail = await fetchEmailWithBody(selectedEmailId)
        if (fullEmail) handleReplyAll(fullEmail)
      } catch (error) {
        toast.error(`Failed to load email: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },
    onForward: async () => { 
      if (!selectedEmailId) return
      try {
        const fullEmail = await fetchEmailWithBody(selectedEmailId)
        if (fullEmail) handleForward(fullEmail)
      } catch (error) {
        toast.error(`Failed to load email: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },
    onToggleStar: handleToggleStar,
    onArchive: handleArchive,
    onDelete: handleDelete,
    onShowShortcutsHelp: () => setShowShortcutsHelp(true),
  })

  // Auto-select inbox on first load
  useEffect(() => {
    if (mailboxes && !selectedMailboxId) {
      const inbox = mailboxes.find((m: Mailbox) => m.role === 'inbox' || (!m.role && m.name.toLowerCase() === 'inbox')) || mailboxes[0]
      if (inbox) setSelectedMailboxId(inbox.id)
    }
  }, [mailboxes, selectedMailboxId])

  // Live region announcements
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
    const fullEmail = threadEmails?.find((e: Email) => e.id === selectedEmailId)
    if (fullEmail) {
      const sender = fullEmail.from?.[0]?.name || fullEmail.from?.[0]?.email || 'unknown sender'
      setLiveAnnouncement(`Email from ${sender} loaded`)
    }
  }, [emailLoading, threadEmails, selectedEmailId])

  // Keyboard resize handler
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

  // Selected email detail for reader
  const selectedEmailDetail = useMemo(() => {
    return threadEmails?.find((e: Email) => e.id === selectedEmailId) || threadEmails?.[threadEmails.length - 1]
  }, [threadEmails, selectedEmailId])

  // Move to folder handler (keyboard-accessible alternative to drag-and-drop)
  const handleMoveToFolder = useCallback((emailId: string) => {
    if (!mailboxes) return;
    const customMailboxes = mailboxes.filter((m: Mailbox) => !m.role);
    const folderNames = customMailboxes.map((m: Mailbox) => m.name).join(', ');
    const folderName = window.prompt(`Enter folder name to move to. Available folders: ${folderNames || '(none)'}`);
    if (!folderName) return;
    const target = mailboxes.find((m: Mailbox) => m.name.toLowerCase() === folderName.toLowerCase());
    if (target) {
      moveEmailsToFolder([emailId], target.id, target.name);
      toast.success(`Moved to ${target.name}`);
    } else {
      toast.error(`Folder "${folderName}" not found`);
    }
  }, [mailboxes, moveEmailsToFolder]);

  // Memoized handler for toggling star on the currently selected email
  const handleToggleSelectedStar = useCallback(() => {
    if (selectedEmailId && selectedEmailDetail) {
      const isStarred = !!selectedEmailDetail.keywords?.['$flagged']
      updateKeywords.mutate({ emailId: selectedEmailId, keywords: { '$flagged': !isStarred } })
    }
  }, [selectedEmailId, selectedEmailDetail, updateKeywords])

  if (!session) {
    return <Login onLoginSuccess={() => setSession(jmapClient.getStoredSession())} />
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={`relative flex h-full w-full bg-icloud-bg-primary text-[13px] ${isMobile ? 'overflow-hidden' : ''}`}>
        <LiveRegion message={liveAnnouncement} />
        {(isOffline || pendingCount > 0) && (
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto absolute left-1/2 top-4 z-[350] -translate-x-1/2 flex items-center gap-3 rounded-full px-4 py-2 text-[12px] font-semibold text-white shadow-lg backdrop-blur ${
              isOffline ? 'bg-icloud-orange/95' : 'bg-icloud-accent/95'
            }`}
          >
            <span>{isOffline ? 'Offline — cached mail only' : isReplaying ? 'Syncing queued changes…' : 'Pending sync available'}</span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{pendingCount} pending</span>
            )}
            <button
              type="button"
              onClick={() => {
                void replayQueue().then(({ syncedCount }) => {
                  if (syncedCount > 0) toast.success(`Synced ${syncedCount} queued change${syncedCount === 1 ? '' : 's'}`)
                }).catch(() => { /* replay errors handled internally */ })
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
          className="sr-only absolute left-4 top-4 z-[400] rounded-md bg-icloud-card px-3 py-2 text-[13px] font-medium text-icloud-accent shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-icloud-accent"
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
              background: isDark ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(20px)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '12px',
              boxShadow: isDark ? '0 11px 34px rgba(0, 0, 0, 0.65)' : '0 11px 34px rgba(0, 0, 0, 0.16)',
              color: isDark ? 'rgba(255, 255, 255, 0.98)' : 'rgba(0, 0, 0, 0.88)',
              fontSize: '14px',
              fontWeight: 500,
            },
          }}
        />
        <Sidebar
          session={session}
          userLabel={userLabel}
          mailboxes={mailboxes}
          mailboxesLoading={mailboxesLoading}
          refetchMailboxes={refetchMailboxes}
          selectedMailboxId={selectedMailboxId}
          isSidebarCollapsed={isMobile ? false : isSidebarCollapsed}
          isAnyPaneResizing={isAnyPaneResizing}
          sidebarWidth={isMobile ? '100%' : sidebarResize.width}
          expandedSections={expandedSections}
          customFolderTree={customFolderTree}
          hasNewMail={hasNewMail}
          isOffline={isOffline}
          quota={quota ?? null}
          isMobile={isMobile}
          mobileVisible={isMobile ? mobileView === 'mailboxes' : true}
          onToggleSidebarCollapsed={toggleSidebarCollapsed}
          onCompose={openComposer}
          onSelectMailbox={selectMailbox}
          onClearNewMail={clearNewMail}
          onMailboxContextMenu={handleMailboxContextMenu}
          onMoveEmailsToFolder={moveEmailsToFolder}
          onToggleSectionExpanded={(section) => toggleSectionExpanded(section as 'mailboxes' | 'folders')}
          onCreateFolder={openCreateFolder}
          onToggleFolderExpanded={handleToggleFolderExpanded}
          onRenameMailbox={(mailboxId, newName) => renameMailbox.mutate({ mailboxId, newName })}
          onDeleteMailbox={(mailboxId) => deleteMailbox.mutate({ mailboxId })}
          onReorderMailbox={handleMailboxReorder}
          onReparentMailbox={handleMailboxReparent}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenCalendar={() => setIsCalendarOpen(true)}
          onOpenContacts={() => setIsContactsOpen(true)}
          resetSelection={resetSelection}
          setSelectedMailboxId={setSelectedMailboxId}
          setSelectedFolderId={setSelectedFolderId}
          setSelectedFolderName={setSelectedFolderName}
        />
        {!isSidebarCollapsed && !isMobile && (
          <ResizeHandle
            onPointerDown={sidebarResize.handlePointerDown}
            isDragging={sidebarResize.isDragging}
            onDoubleClick={collapseSidebar}
            onKeyDown={(event) => handleResizeKeyDown(sidebarResize, event)}
            ariaLabel="Resize sidebar"
            valueNow={sidebarResize.width}
            valueMin={sidebarResize.minWidth}
            valueMax={sidebarResize.maxWidth}
          />
        )}
        <main
          id="main-content"
          aria-label="Message list"
          className={`flex flex-col bg-icloud-bg-layer1 border-r border-icloud-border h-full overflow-hidden shrink-0 select-none ${isAnyPaneResizing ? '' : 'transition-all duration-300'} ${isMobile ? (mobileView === 'list' ? 'fixed inset-0 z-[200] w-full' : 'hidden') : ''}`}
          style={{ width: isMobile ? '100%' : messageListResize.width }}
        >
          <MessageListHeader
            title={
              selectedMailboxId === 'all' ? 'All Mail' :
      selectedMailboxId === 'flagged' ? 'Starred' :
              mailboxes?.find((m: Mailbox) => m.id === selectedMailboxId)?.name || 'Messages'
            }
            isSidebarCollapsed={isSidebarCollapsed}
            isMobile={isMobile}
            emails={emails}
            selectedEmailIds={selectedEmailIds}
            searchTerm={searchTerm}
            showFilterDialog={showFilterDialog}
            activeFilters={activeFilters}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onShowSidebar={handleShowSidebar}
            onSelectAll={selectAllEmails}
            onClearSelection={clearSelection}
            onOpenFilterDialog={openFilterDialog}
            onCloseFilterDialog={closeFilterDialog}
            onApplyFilters={applyFilters}
            onClearFilters={clearFilters}
            onSearchChange={setSearchTerm}
            onClearSearch={() => setSearchTerm('')}
          />
          <VirtualMessageList
            emails={emails || []}
            isLoading={emailsLoading}
            isRefetching={emailsRefetching}
            selectedEmailId={selectedEmailId}
            selectedEmailIds={selectedEmailIds}
            mailboxes={mailboxes || []}
            onToggleSelection={toggleEmailSelection}
            onSelectEmail={handleSelectEmail}
            onToggleStar={handleToggleStar}
            formatMessageDate={formatMessageDate}
            removingEmailIds={removingEmailIds}
            scrollToEmailId={scrollToEmailId}
            isMobile={isMobile}
            onSwipeArchive={handleSwipeArchive}
            onSwipeDelete={handleSwipeDelete}
            onOpenDraft={handleOpenDraft}
            onRefresh={refetchEmails}
            onReply={handleReplyFromId}
            onReplyAll={handleReplyAllFromId}
            onForward={handleForwardFromId}
            onArchive={handleArchiveFromId}
            onDelete={handleDeleteFromId}
            onMoveToFolder={handleMoveToFolder}
          />
        </main>
        {!isMobile && (
          <ResizeHandle
            onPointerDown={messageListResize.handlePointerDown}
            isDragging={messageListResize.isDragging}
            onKeyDown={(event) => handleResizeKeyDown(messageListResize, event)}
            ariaLabel="Resize message list"
            valueNow={messageListResize.width}
            valueMin={messageListResize.minWidth}
            valueMax={messageListResize.maxWidth}
          />
        )}
        <ErrorBoundary>
          <section 
            aria-label="Email reading pane" 
            className={`flex-1 flex flex-col bg-icloud-bg-layer2 h-full overflow-hidden relative select-none ${isMobile ? (mobileView === 'reader' ? 'fixed inset-0 z-[200] w-full' : 'hidden') : ''}`}
          >
            <Toolbar
              selectedEmailId={selectedEmailId}
              selectedEmail={selectedEmailDetail ?? null}
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
              isMobile={isMobile}
              onBack={navigateToEmailList}
              onReply={() => { if (selectedEmailDetail) handleReply(selectedEmailDetail) }}
              onReplyAll={() => { if (selectedEmailDetail) handleReplyAll(selectedEmailDetail) }}
              onForward={() => { if (selectedEmailDetail) handleForward(selectedEmailDetail) }}
              onToggleStar={handleToggleSelectedStar}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onMarkUnread={handleMarkUnread}
              onToggleMoreMenu={() => setMoreMenuOpen(!moreMenuOpen)}
              onViewSource={(blobId) => setRawViewerBlobId(blobId)}
              onCloseMoreMenu={() => setMoreMenuOpen(false)}
              onShowKeyboardShortcuts={() => setShowShortcutsHelp(true)}
            />
            <EmailReader
              threadEmails={threadEmails as Parameters<typeof EmailReader>[0]['threadEmails']}
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
        <ErrorBoundary>
          <AnimatePresence>
            {isComposerOpen && (
              <Composer
                onClose={closeComposer}
                replyTo={replyToEmail ?? undefined}
                draftEmail={draftEmail ?? undefined}
                isMobile={isMobile}
              />
            )}
          </AnimatePresence>
        </ErrorBoundary>
        <FolderDialogsUI />
        <ErrorBoundary>
          <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} isMobile={isMobile} />
        </ErrorBoundary>
        <ErrorBoundary>
          <CalendarView isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} />
        </ErrorBoundary>
        <ErrorBoundary>
          <ContactsView isOpen={isContactsOpen} onClose={() => setIsContactsOpen(false)} />
        </ErrorBoundary>
        <KeyboardShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} isMobile={isMobile} />
        {selectedMailboxId && selectedMailboxId !== 'all' && selectedMailboxId !== 'flagged' && (
          <EmailImportZone mailboxId={selectedMailboxId} />
        )}
        {rawViewerBlobId && (
          <RawEmailViewer blobId={rawViewerBlobId} onClose={() => setRawViewerBlobId(null)} />
        )}
      </div>
    </DndProvider>
  )
}

export default App
