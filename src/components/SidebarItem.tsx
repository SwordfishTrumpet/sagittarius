import { useDrop } from 'react-dnd'
import { memo } from 'react'

export interface SidebarItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  count?: number
  mailboxId?: string
  hasNewMail?: boolean
  level?: number
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onDrop?: (emailIds: string[]) => void
}

function SidebarItemComponent({ icon, label, active = false, count, mailboxId, hasNewMail = false, level = 1, onClick, onContextMenu, onDrop }: SidebarItemProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'EMAIL',
    canDrop: () => !!mailboxId,
    drop: (item: { id: string; ids: string[] }) => {
      if (onDrop) onDrop(item.ids || [item.id]);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [mailboxId, onDrop]);

  return (
    <div 
      ref={mailboxId ? drop : null}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="treeitem"
      tabIndex={0}
      aria-selected={active}
      aria-level={level}
      aria-current={active ? 'page' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-default group transition-all relative focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 dark:focus:ring-[#0A84FF]/50 ${
        active ? 'bg-[#007AFF] dark:bg-[#0A84FF] text-white shadow-md' : 
        isOver && canDrop ? 'bg-[#007AFF]/10 dark:bg-[#0A84FF]/10 ring-2 ring-[#007AFF] dark:ring-[#0A84FF] text-[#007AFF] dark:text-[#0A84FF]' :
        'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[#1C1C1E] dark:text-white'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <span aria-hidden="true" className={`${active ? 'text-white' : 'text-[#007AFF] dark:text-[#0A84FF]'} shrink-0 relative`}>
          {icon}
          {hasNewMail && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#007AFF] dark:bg-[#0A84FF] rounded-full animate-pulse" />
          )}
        </span>
        <span className={`text-[14px] truncate leading-none ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span aria-label={`${count} unread`} className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-[#E5E5EA] dark:bg-[#3A3A3C] text-[#636366] dark:text-[#8E8E93]'}`}>{count}</span>
      )}
    </div>
  )
}

export const SidebarItem = memo(SidebarItemComponent)
