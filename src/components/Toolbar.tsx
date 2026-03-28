import { Reply, ReplyAll, Forward, Star, Archive, Trash2, MoreHorizontal, Code, Eye } from 'lucide-react'
import { ActionButton } from './ActionButton'

export interface ToolbarProps {
  selectedEmailId: string | null
  selectedEmail: any
  selectedEmailIds: Set<string>
  moreMenuOpen: boolean
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onToggleFlag: (emailId: string, currentFlagged: boolean) => void
  onArchive: () => void
  onDelete: () => void
  onToggleMoreMenu: () => void
  onViewSource: (blobId: string) => void
  onCloseMoreMenu: () => void
}

export function Toolbar({
  selectedEmailId,
  selectedEmail,
  selectedEmailIds,
  moreMenuOpen,
  onReply,
  onReplyAll,
  onForward,
  onToggleFlag,
  onArchive,
  onDelete,
  onToggleMoreMenu,
  onViewSource,
  onCloseMoreMenu,
}: ToolbarProps) {
  return (
    <header className="px-6 py-2 border-b border-[#E5E5E5] flex items-center justify-between min-h-[52px]">
      <div className="flex gap-7">
        <ActionButton 
          icon={<Reply className="w-[22px] h-[22px]" />} 
          label="Reply" 
          disabled={!selectedEmailId} 
          onClick={onReply}
        />
        <ActionButton icon={<ReplyAll className="w-[22px] h-[22px]" />} label="Reply All" disabled={!selectedEmailId} onClick={onReplyAll} />
        <ActionButton icon={<Forward className="w-[22px] h-[22px]" />} label="Forward" disabled={!selectedEmailId} onClick={onForward} />
        <div className="w-[1px] h-7 bg-[#E5E5E5] self-center"></div>
        <ActionButton 
          icon={<Star className={`w-[22px] h-[22px] ${selectedEmail?.keywords?.['$flagged'] ? 'fill-current' : ''}`} />} 
          label="Flag" 
          disabled={!selectedEmailId} 
          onClick={() => onToggleFlag(selectedEmailId!, !!selectedEmail?.keywords?.['$flagged'])}
        />
        <div className="w-[1px] h-7 bg-[#E5E5E5] self-center"></div>
         <ActionButton 
           icon={<Archive className="w-[22px] h-[22px]" />} 
           label="Archive" 
           disabled={selectedEmailIds.size === 0 && !selectedEmailId} 
           onClick={onArchive} 
         />
         <ActionButton 
           icon={<Trash2 className="w-[22px] h-[22px]" />} 
           label="Trash" 
           disabled={selectedEmailIds.size === 0 && !selectedEmailId} 
           onClick={onDelete} 
         />
      </div>
      <div className="flex items-center relative">
         <button 
           onClick={onToggleMoreMenu}
           className="p-2 text-[#007AFF] hover:bg-[#F2F2F7] rounded-full transition-colors disabled:opacity-20" 
           disabled={!selectedEmailId}
         >
           <MoreHorizontal className="w-5 h-5" />
         </button>
         {moreMenuOpen && selectedEmail && (
           <div className="absolute right-0 top-full mt-1 bg-white border border-[#E5E5E5] rounded-xl shadow-2xl py-1 z-50 min-w-[180px]">
             <button
               onClick={() => {
                 onViewSource(selectedEmail.blobId || selectedEmail.id);
                 onCloseMoreMenu();
               }}
               className="flex items-center gap-3 w-full px-4 py-2 text-[13px] text-[#1C1C1E] hover:bg-[#F2F2F7] transition-colors"
             >
               <Code className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.5} />
               View Source
             </button>
             <button
               onClick={() => { onCloseMoreMenu(); }}
               className="flex items-center gap-3 w-full px-4 py-2 text-[13px] text-[#1C1C1E] hover:bg-[#F2F2F7] transition-colors"
             >
               <Eye className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.5} />
               Mark as Unread
             </button>
           </div>
         )}
      </div>
    </header>
  )
}
