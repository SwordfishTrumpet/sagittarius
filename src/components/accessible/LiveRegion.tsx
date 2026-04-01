interface LiveRegionProps {
  message: string
}

export function LiveRegion({ message }: LiveRegionProps) {
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
