import { useDrop } from 'react-dnd'

export interface SidebarItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  count?: number
  mailboxId?: string
  hasNewMail?: boolean
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onDrop?: (emailIds: string[]) => void
}

export function SidebarItem({ icon, label, active = false, count, mailboxId, hasNewMail = false, onClick, onContextMenu, onDrop }: SidebarItemProps) {
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
      className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-default group transition-all relative ${
        active ? 'bg-[#007AFF] text-white shadow-md' : 
        isOver && canDrop ? 'bg-[#007AFF]/10 ring-2 ring-[#007AFF] text-[#007AFF]' :
        'hover:bg-black/[0.04] text-[#1C1C1E]'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <span className={`${active ? 'text-white' : 'text-[#007AFF]'} shrink-0 relative`}>
          {icon}
          {hasNewMail && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#007AFF] rounded-full animate-pulse" />
          )}
        </span>
        <span className={`text-[14px] truncate leading-none ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-[#E5E5EA] text-[#8E8E93]'}`}>{count}</span>
      )}
    </div>
  )
}
