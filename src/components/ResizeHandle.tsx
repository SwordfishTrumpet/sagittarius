interface ResizeHandleProps {
  onPointerDown: (e: React.PointerEvent) => void
  isDragging: boolean
  onDoubleClick?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  ariaLabel?: string
  valueNow?: number
  valueMin?: number
  valueMax?: number
}

export function ResizeHandle({
  onPointerDown,
  isDragging,
  onDoubleClick,
  onKeyDown,
  ariaLabel,
  valueNow,
  valueMin,
  valueMax,
}: ResizeHandleProps) {
  return (
    <div
      className="resize-handle"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      data-dragging={isDragging || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      tabIndex={0}
    >
      <div className="resize-handle-line" />
    </div>
  )
}
