import { useState, useRef, useCallback, useEffect } from 'react'

interface UseResizablePaneOptions {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
}

interface UseResizablePaneReturn {
  width: number
  isDragging: boolean
  setWidth: (w: number) => void
  handlePointerDown: (e: React.PointerEvent) => void
}

export function useResizablePane({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
}: UseResizablePaneOptions): UseResizablePaneReturn {
  const [width, setWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = Number(stored)
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed
        }
      }
    } catch {
      // localStorage unavailable
    }
    return defaultWidth
  })

  const [isDragging, setIsDragging] = useState(false)

  const dragState = useRef({
    startX: 0,
    startWidth: 0,
    rafId: 0,
    latestWidth: 0,
  })

  // Persist width to localStorage whenever it changes (debounced via drag end)
  const persistWidth = useCallback((w: number) => {
    try {
      localStorage.setItem(storageKey, String(w))
    } catch {
      // localStorage unavailable
    }
  }, [storageKey])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    dragState.current.startX = e.clientX
    dragState.current.startWidth = width
    dragState.current.latestWidth = width

    setIsDragging(true)
    document.body.classList.add('is-resizing')

    const onPointerMove = (ev: PointerEvent) => {
      const delta = ev.clientX - dragState.current.startX
      const clamped = Math.min(maxWidth, Math.max(minWidth, dragState.current.startWidth + delta))
      dragState.current.latestWidth = clamped

      cancelAnimationFrame(dragState.current.rafId)
      dragState.current.rafId = requestAnimationFrame(() => {
        setWidth(clamped)
      })
    }

    const onPointerUp = () => {
      cancelAnimationFrame(dragState.current.rafId)
      setIsDragging(false)
      document.body.classList.remove('is-resizing')

      // Persist final width
      setWidth(dragState.current.latestWidth)
      persistWidth(dragState.current.latestWidth)

      target.removeEventListener('pointermove', onPointerMove)
      target.removeEventListener('pointerup', onPointerUp)
      target.removeEventListener('pointercancel', onPointerUp)
    }

    target.addEventListener('pointermove', onPointerMove)
    target.addEventListener('pointerup', onPointerUp)
    target.addEventListener('pointercancel', onPointerUp)
  }, [width, minWidth, maxWidth, persistWidth])

  // Safety cleanup: remove body class if component unmounts during drag
  useEffect(() => {
    return () => {
      document.body.classList.remove('is-resizing')
      cancelAnimationFrame(dragState.current.rafId)
    }
  }, [])

  return { width, isDragging, setWidth, handlePointerDown }
}
