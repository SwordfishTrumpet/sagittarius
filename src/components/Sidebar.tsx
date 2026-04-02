import { Mail, Send, FileText, Archive, Trash2, ShieldAlert, Inbox, Star, Plus, ChevronLeft, Settings as SettingsIcon, Wifi, WifiOff } from 'lucide-react'
import { useMemo } from 'react'
import { SidebarItem } from './SidebarItem'
import { SidebarSection } from './SidebarSection'
import { MailboxTree } from './RecursiveSidebarItem'
import { QuotaBar } from './QuotaBar'
import { classifyMailboxes } from '../utils/mailboxClassifier'
import { jmapClient } from '../api/jmap'
import type { MailboxNode } from '../utils/mailboxTree'

export interface SidebarProps {
  session: any
  userLabel?: string
  mailboxes: any[] | undefined
  mailboxesLoading: boolean
  refetchMailboxes: () => void
  selectedMailboxId: string | null
  isSidebarCollapsed: boolean
  isAnyPaneResizing: boolean
  sidebarWidth: number | string
  expandedSections: { mailboxes: boolean; folders: boolean }
  customFolderTree: MailboxNode[]
  hasNewMail: boolean
  esConnected: boolean
  isOffline: boolean
  quota: any
  isMobile?: boolean
  mobileVisible?: boolean
  onToggleSidebarCollapsed: () => void
  onCompose: () => void
  onSelectMailbox: (mailboxId: string) => void
  onClearNewMail: () => void
  onMailboxContextMenu: (mailboxId: string, mailboxName: string, e: React.MouseEvent) => void
  onMoveEmailsToFolder: (emailIds: string[], mailboxId: string, folderName: string) => void
  onToggleSectionExpanded: (section: 'mailboxes' | 'folders') => void
  onCreateFolder: () => void
  onToggleFolderExpanded: (mailboxId: string) => void
  onRenameMailbox: (mailboxId: string, newName: string) => void
  onDeleteMailbox: (mailboxId: string) => void
  onReorderMailbox: (draggedId: string, targetId: string) => void
  onReparentMailbox: (draggedId: string, newParentId: string | null) => void
  onOpenSettings: () => void
  resetSelection: () => void
  setSelectedMailboxId: (id: string | null) => void
  setSelectedFolderId: (id: string | null) => void
  setSelectedFolderName: (name: string) => void
}

// Pre-created icon components to avoid creating new JSX on each call
const MAILBOX_ICONS: Record<string, React.ReactNode> = {
  inbox: <Inbox className="w-[18px] h-[18px]" strokeWidth={1.5} />,
  sent: <Send className="w-[18px] h-[18px]" strokeWidth={1.5} />,
  drafts: <FileText className="w-[18px] h-[18px]" strokeWidth={1.5} />,
  trash: <Trash2 className="w-[18px] h-[18px]" strokeWidth={1.5} />,
  archive: <Archive className="w-[18px] h-[18px]" strokeWidth={1.5} />,
  junk: <ShieldAlert className="w-[18px] h-[18px]" strokeWidth={1.5} />,
  spam: <ShieldAlert className="w-[18px] h-[18px]" strokeWidth={1.5} />,
  default: <Mail className="w-[18px] h-[18px]" strokeWidth={1.5} />,
}

function getMailboxIcon(mailbox: any) {
  const role = mailbox._effectiveRole || mailbox.role;
  return MAILBOX_ICONS[role] || MAILBOX_ICONS.default;
}

export function Sidebar({
  session,
  userLabel,
  mailboxes,
  mailboxesLoading,
  refetchMailboxes,
  selectedMailboxId,
  isSidebarCollapsed,
  isAnyPaneResizing,
  sidebarWidth,
  expandedSections,
  customFolderTree,
  hasNewMail,
  esConnected,
  isOffline,
  quota,
  isMobile = false,
  mobileVisible = true,
  onToggleSidebarCollapsed,
  onCompose,
  onSelectMailbox,
  onClearNewMail,
  onMailboxContextMenu,
  onMoveEmailsToFolder,
  onToggleSectionExpanded,
  onCreateFolder,
  onToggleFolderExpanded,
  onRenameMailbox,
  onDeleteMailbox,
  onReorderMailbox,
  onReparentMailbox,
  onOpenSettings,
  resetSelection,
  setSelectedMailboxId,
  setSelectedFolderId,
  setSelectedFolderName,
}: SidebarProps) {
  // Memoize mailbox classification to avoid recalculating on every render
  const { systemMailboxes, customMailboxes } = useMemo(() => {
    const classified = classifyMailboxes(mailboxes || []);
    return {
      systemMailboxes: classified.system,
      customMailboxes: classified.custom,
    };
  }, [mailboxes]);

  return (
    <aside
      aria-label="Mailbox navigation"
      aria-hidden={isSidebarCollapsed && !isMobile}
      className={`flex flex-col bg-white/70 backdrop-blur-xl border-r border-[#E5E5E5] h-full overflow-hidden shrink-0 select-none ${isAnyPaneResizing ? '' : 'transition-all duration-300'} ${isMobile ? (mobileVisible ? 'fixed inset-0 z-[200] w-full' : 'hidden') : ''}`}
      style={{ width: isMobile ? '100%' : (isSidebarCollapsed ? 0 : sidebarWidth) }}
    >
      {!isSidebarCollapsed && (
      <>
      <header className="px-5 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight flex items-center leading-none">
          sagittarius
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={onToggleSidebarCollapsed}
            className="p-1.5 hover:bg-black/5 rounded-md transition-colors"
            title={isSidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
            aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            <ChevronLeft className="w-5 h-5 text-[#8E8E93]" strokeWidth={1.5} />
          </button>
          <button 
            onClick={onCompose}
            className="p-1.5 hover:bg-black/5 rounded-md transition-colors"
            aria-label="Compose message"
          >
            <Plus className="w-5 h-5 text-[#007AFF]" strokeWidth={2} />
          </button>
        </div>
      </header>

      <nav aria-label="Mailboxes" className="flex-1 overflow-y-auto px-3 space-y-3 py-2">
        {mailboxesLoading ? (
          <div className="flex items-center justify-center py-10 opacity-30">
            <div className="w-5 h-5 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !mailboxes || mailboxes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Mail className="w-8 h-8 text-[#8E8E93] mb-2 opacity-40" strokeWidth={1.25} />
            <p className="text-[12px] text-[#8E8E93] font-medium">No folders loaded</p>
            <button 
              onClick={() => refetchMailboxes()} 
              className="mt-2 text-[12px] text-[#007AFF] font-medium hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* MAILBOXES Section */}
            {systemMailboxes.length > 0 && (
              <SidebarSection
                title="Mailboxes"
                isExpanded={expandedSections.mailboxes}
                onToggleExpand={() => onToggleSectionExpanded('mailboxes')}
              >
                <div role="tree" aria-label="System mailboxes" className="space-y-0.5">
                  {systemMailboxes.map((mailbox: any) => (
                    <SidebarItem 
                      key={mailbox.id}
                      mailboxId={mailbox.id}
                      icon={getMailboxIcon(mailbox)} 
                      label={mailbox.name} 
                      active={selectedMailboxId === mailbox.id} 
                      count={mailbox.unreadEmails}
                      hasNewMail={(mailbox._effectiveRole || mailbox.role) === 'inbox' && hasNewMail}
                       onClick={() => {
                         onSelectMailbox(mailbox.id)
                         if ((mailbox._effectiveRole || mailbox.role) === 'inbox') onClearNewMail()
                       }}
                       onContextMenu={(e) => onMailboxContextMenu(mailbox.id, mailbox.name, e)}
                       onDrop={(emailIds) => onMoveEmailsToFolder(emailIds, mailbox.id, mailbox.name)}
                    />
                  ))}
                </div>
              </SidebarSection>
            )}

            {/* FOLDERS Section */}
            {customMailboxes.length > 0 && (
              <SidebarSection
                title="Folders"
                isExpanded={expandedSections.folders}
                onToggleExpand={() => onToggleSectionExpanded('folders')}
                actionButton={{
                  icon: <Plus className="w-4 h-4" strokeWidth={2} />,
                  label: 'Create new folder',
                  onClick: onCreateFolder,
                }}
              >
                <MailboxTree
                  nodes={customFolderTree}
                  selectedMailboxId={selectedMailboxId}
                  onSelect={onSelectMailbox}
                   onToggleExpand={onToggleFolderExpanded}
                   onDrop={(emailIds, mailboxId) => {
                     const folderName = mailboxes?.find((m: any) => m.id === mailboxId)?.name || 'Folder';
                     onMoveEmailsToFolder(emailIds, mailboxId, folderName);
                   }}
                  getMailboxIcon={getMailboxIcon}
                  showRecursiveUnread={false}
                  onRename={(mailboxId, newName) => {
                    setSelectedFolderId(mailboxId);
                    setSelectedFolderName(newName);
                    onRenameMailbox(mailboxId, newName);
                  }}
                  onDelete={(mailboxId) => {
                    setSelectedFolderId(mailboxId);
                    if (selectedMailboxId === mailboxId) {
                      resetSelection();
                      setSelectedMailboxId(null);
                    }
                    onDeleteMailbox(mailboxId);
                  }}
                  onReorder={onReorderMailbox}
                  onReparent={onReparentMailbox}
                  onContextMenu={onMailboxContextMenu}
                />
              </SidebarSection>
            )}

            {/* Create "Folders" section button if no custom folders exist */}
            {customMailboxes.length === 0 && systemMailboxes.length > 0 && (
              <button
                onClick={onCreateFolder}
                className="flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-medium text-[#007AFF] hover:bg-[#007AFF]/10 rounded-lg transition-colors mt-2"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
                Create Folder
              </button>
            )}
            
            {/* Smart Mailboxes Section */}
            <div className="pt-2 border-t border-[#E5E5E5]">
              <div className="pt-3 pb-2 px-3 text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider opacity-60">Smart Mailboxes</div>
              <div role="tree" aria-label="Smart mailboxes" className="space-y-0.5">
                <SidebarItem 
                  icon={<Mail className="w-[18px] h-[18px]" strokeWidth={1.5} />} 
                  label="All Mail" 
                  active={selectedMailboxId === 'all'} 
                  onClick={() => onSelectMailbox('all')} 
                />
                <SidebarItem 
                  icon={<Star className="w-[18px] h-[18px]" strokeWidth={1.5} />} 
                  label="Flagged" 
                  active={selectedMailboxId === 'flagged'} 
                  onClick={() => onSelectMailbox('flagged')} 
                />
              </div>
            </div>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-[#E5E5E5] text-[11px] text-[#8E8E93] bg-white/30 space-y-2">
         {quota && quota.hardLimit > 0 && (
           <QuotaBar used={quota.used || 0} total={quota.hardLimit || 0} />
         )}
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <span className="truncate max-w-[100px] font-medium">{userLabel || session.username}</span>
              {isOffline ? (
                <>
                  <WifiOff className="w-3 h-3 text-[#FF9500]" strokeWidth={2} />
                  <span className="text-[#FF9500] font-medium">Offline cache</span>
                </>
              ) : esConnected ? (
                <Wifi className="w-3 h-3 text-green-500" strokeWidth={2} />
              ) : (
                <WifiOff className="w-3 h-3 text-[#8E8E93]" strokeWidth={2} />
              )}
            </div>
           <div className="flex items-center gap-2">
              <button onClick={onOpenSettings} className="p-1 hover:bg-black/5 rounded transition-colors" title="Settings" aria-label="Settings">
                <SettingsIcon className="w-3.5 h-3.5 text-[#8E8E93]" strokeWidth={1.5} />
              </button>
             <button onClick={() => jmapClient.logout()} className="text-[#007AFF] font-medium hover:underline">Sign Out</button>
           </div>
          </div>
        </div>
      </>
      )}
     </aside>
  )
}
