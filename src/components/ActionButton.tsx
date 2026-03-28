export interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  disabled?: boolean
  onClick?: () => void
}

export function ActionButton({ icon, label, disabled = false, onClick }: ActionButtonProps) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-[#007AFF] hover:opacity-70 disabled:opacity-20 disabled:grayscale transition-all" 
      disabled={disabled}
    >
      <span>{icon}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  )
}
