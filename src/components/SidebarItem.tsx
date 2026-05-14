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
      className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-default group transition-all relative focus:outline-none focus:ring-2 focus:ring-icloud-accent ${
        active ? 'bg-icloud-accent text-white shadow-md' : 
        isOver && canDrop ? 'bg-icloud-accent/10 dark:bg-icloud-accent/10 ring-2 ring-icloud-accent ring-icloud-accent text-icloud-accent' :
        'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-icloud-text-primary'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <span aria-hidden="true" className={`${active ? 'text-white' : 'text-icloud-accent'} shrink-0 relative`}>
          {icon}
          {hasNewMail && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-icloud-accent rounded-full animate-pulse" />
          )}
        </span>
        <span className={`text-[14px] truncate leading-none ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span aria-label={`${count} unread`} className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-icloud-border dark:bg-icloud-gray3 text-icloud-text-secondary'}`}>{count}</span>
      )}
    </div>
  )
}

export const SidebarItem = memo(SidebarItemComponent)
