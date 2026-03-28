interface ResizeHandleProps {
  onPointerDown: (e: React.PointerEvent) => void
  isDragging: boolean
  onDoubleClick?: () => void
}

export function ResizeHandle({ onPointerDown, isDragging, onDoubleClick }: ResizeHandleProps) {
  return (
    <div
      className="resize-handle"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      data-dragging={isDragging || undefined}
    >
      <div className="resize-handle-line" />
    </div>
  )
}
