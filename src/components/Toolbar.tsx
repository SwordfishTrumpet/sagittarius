import type { ReactNode } from 'react'
import { MoreHorizontal, Code, Eye, ChevronLeft } from 'lucide-react'
import { SFReply, SFReplyAll, SFForward, SFStar, SFArchive, SFTrash } from './SFIcon'
import { ActionButton } from './ActionButton'
import type { Email } from '../types/jmap'

export interface ToolbarProps {
  selectedEmailId: string | null
  selectedEmail: Email | null
  selectedEmailIds: Set<string>
  moreMenuOpen: boolean
  statusBadge?: ReactNode
  isMobile?: boolean
  onBack?: () => void
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onToggleFlag: () => void
  onArchive: () => void
  onDelete: () => void
  onMarkUnread?: () => void
  onToggleMoreMenu: () => void
  onViewSource: (blobId: string) => void
  onCloseMoreMenu: () => void
}

export function Toolbar({
  selectedEmailId,
  selectedEmail,
  selectedEmailIds,
  moreMenuOpen,
  statusBadge,
  isMobile = false,
  onBack,
  onReply,
  onReplyAll,
  onForward,
  onToggleFlag,
  onArchive,
  onDelete,
  onMarkUnread,
  onToggleMoreMenu,
  onViewSource,
  onCloseMoreMenu,
}: ToolbarProps) {
  return (
    <header role="toolbar" aria-label="Email actions" className={`border-b border-icloud-border flex items-center justify-between min-h-[52px] ${isMobile ? 'px-3 py-2' : 'px-6 py-2'}`}>
      <div className={`flex ${isMobile ? 'gap-3' : 'gap-7'}`}>
        {isMobile && onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-icloud-accent font-medium text-[15px] pr-1"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
            <span className="text-[14px]">Back</span>
          </button>
        )}
        {(() => {
          const iconSize = isMobile ? 'w-[20px] h-[20px]' : 'w-[22px] h-[22px]';
          return (
            <>
              <ActionButton 
                icon={<SFReply className={iconSize} />} 
                label="Reply" 
                disabled={!selectedEmailId} 
                onClick={onReply}
              />
              {!isMobile && <ActionButton icon={<SFReplyAll className={iconSize} />} label="Reply All" disabled={!selectedEmailId} onClick={onReplyAll} />}
              <ActionButton icon={<SFForward className={iconSize} />} label="Forward" disabled={!selectedEmailId} onClick={onForward} />
              {!isMobile && <div aria-hidden="true" className="w-[1px] h-7 bg-icloud-divider self-center"></div>}
              <ActionButton 
                icon={<SFStar className={`${iconSize} ${selectedEmail?.keywords?.['$flagged'] ? 'text-icloud-orange' : ''}`} filled={!!selectedEmail?.keywords?.['$flagged']} />} 
                label={selectedEmail?.keywords?.['$flagged'] ? 'Unflag' : 'Flag'}
                pressed={!!selectedEmail?.keywords?.['$flagged']}
                disabled={!selectedEmailId} 
                onClick={onToggleFlag}
              />
              {!isMobile && <div aria-hidden="true" className="w-[1px] h-7 bg-icloud-divider self-center"></div>}
              <ActionButton 
                icon={<SFArchive className={iconSize} />} 
                label="Archive" 
                disabled={selectedEmailIds.size === 0 && !selectedEmailId} 
                onClick={onArchive} 
              />
              <ActionButton 
                icon={<SFTrash className={iconSize} />} 
                label="Trash" 
                disabled={selectedEmailIds.size === 0 && !selectedEmailId} 
                onClick={onDelete} 
              />
            </>
          );
        })()}
      </div>
<div className="flex items-center gap-2 relative">
         {statusBadge}
          <button 
            onClick={onToggleMoreMenu}
            aria-label="More options"
           aria-expanded={moreMenuOpen}
           aria-haspopup="menu"
           className="p-2 text-icloud-accent hover:bg-icloud-bg-layer1 rounded-full transition-colors disabled:opacity-20" 
           disabled={!selectedEmailId}
         >
           <MoreHorizontal className="w-5 h-5" />
         </button>
         {moreMenuOpen && selectedEmail && (
           <div role="menu" aria-label="More options" className="absolute right-0 top-full mt-1 bg-icloud-card border border-icloud-border rounded-xl shadow-icloud py-1 z-50 min-w-[180px]">
              <button
              onClick={() => {
                onViewSource(selectedEmail?.blobId || selectedEmail?.id || '');
                onCloseMoreMenu();
              }}
              role="menuitem"
              className="flex items-center gap-3 w-full px-4 py-2 text-[13px] text-icloud-text-primary hover:bg-icloud-bg-layer1 transition-colors"
            >
              <Code className="w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} />
              View Source
            </button>
            <button
              onClick={() => {
                onMarkUnread?.();
                onCloseMoreMenu();
              }}
              role="menuitem"
              className="flex items-center gap-3 w-full px-4 py-2 text-[13px] text-icloud-text-primary hover:bg-icloud-bg-layer1 transition-colors"
            >
              <Eye className="w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} />
              Mark as Unread
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
