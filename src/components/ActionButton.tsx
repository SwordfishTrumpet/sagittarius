export interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  disabled?: boolean
  pressed?: boolean
  onClick?: () => void
}

export function ActionButton({ icon, label, disabled = false, pressed, onClick }: ActionButtonProps) {
  return (
    <button 
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      aria-disabled={disabled}
      className="flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] text-icloud-accent hover:opacity-70 disabled:opacity-20 disabled:grayscale transition-all focus:outline-none focus:ring-2 focus:ring-icloud-accent rounded-md" 
      disabled={disabled}
    >
      <span aria-hidden="true">{icon}</span>
      <span aria-hidden="true" className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  )
}
