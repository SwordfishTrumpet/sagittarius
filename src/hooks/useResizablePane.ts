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
  minWidth: number
  maxWidth: number
  setWidth: (w: number) => void
  adjustWidth: (delta: number) => void
  handlePointerDown: (e: React.PointerEvent) => void
}

export function useResizablePane({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
}: UseResizablePaneOptions): UseResizablePaneReturn {
  const [width, setWidthState] = useState<number>(() => {
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

  const clampWidth = useCallback((value: number) => {
    return Math.min(maxWidth, Math.max(minWidth, value))
  }, [maxWidth, minWidth])

  const setWidth = useCallback((value: number) => {
    const clamped = clampWidth(value)
    setWidthState(clamped)
    persistWidth(clamped)
  }, [clampWidth, persistWidth])

  const adjustWidth = useCallback((delta: number) => {
    setWidthState(prev => {
      const newWidth = clampWidth(prev + delta)
      persistWidth(newWidth)
      return newWidth
    })
  }, [clampWidth, persistWidth])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    dragState.current.startX = e.clientX
    dragState.current.startWidth = width
    dragState.current.latestWidth = width

    setIsDragging(true)
    document.body.classList.add('is-resizing')

    // Track if component is still mounted to prevent state updates after unmount
    let isMounted = true

    const onPointerMove = (ev: PointerEvent) => {
      if (!isMounted) return
      const delta = ev.clientX - dragState.current.startX
      const clamped = Math.min(maxWidth, Math.max(minWidth, dragState.current.startWidth + delta))
      dragState.current.latestWidth = clamped

      cancelAnimationFrame(dragState.current.rafId)
      dragState.current.rafId = requestAnimationFrame(() => {
        if (isMounted) setWidthState(clamped)
      })
    }

    const onPointerUp = () => {
      isMounted = false
      cancelAnimationFrame(dragState.current.rafId)
      setIsDragging(false)
      document.body.classList.remove('is-resizing')

      // Persist final width
      setWidth(dragState.current.latestWidth)

      target.removeEventListener('pointermove', onPointerMove)
      target.removeEventListener('pointerup', onPointerUp)
      target.removeEventListener('pointercancel', onPointerCancel)
    }
    
    const onPointerCancel = () => {
      // On pointercancel (system interrupt), restore original width and clean up
      isMounted = false
      cancelAnimationFrame(dragState.current.rafId)
      setIsDragging(false)
      document.body.classList.remove('is-resizing')
      
      // Restore the original width from before the drag started
      setWidthState(dragState.current.startWidth)
      persistWidth(dragState.current.startWidth)

      target.removeEventListener('pointermove', onPointerMove)
      target.removeEventListener('pointerup', onPointerUp)
      target.removeEventListener('pointercancel', onPointerCancel)
    }

    target.addEventListener('pointermove', onPointerMove)
    target.addEventListener('pointerup', onPointerUp)
    target.addEventListener('pointercancel', onPointerCancel)

    // Store cleanup function for unmount scenario
    const cleanup = () => {
      if (isMounted) {
        isMounted = false
        target.removeEventListener('pointermove', onPointerMove)
        target.removeEventListener('pointerup', onPointerUp)
        target.removeEventListener('pointercancel', onPointerCancel)
      }
    }
    // Attach cleanup to dragState for access during component unmount
    ;(dragState.current as any).cleanup = cleanup
  }, [width, minWidth, maxWidth, persistWidth, setWidth])

  // Safety cleanup: remove body class if component unmounts during drag
  useEffect(() => {
    return () => {
      document.body.classList.remove('is-resizing')
      cancelAnimationFrame(dragState.current.rafId)
      // Clean up any orphaned pointer event listeners
      const cleanup = (dragState.current as any).cleanup
      if (cleanup) cleanup()
    }
  }, [])

  return { width, isDragging, minWidth, maxWidth, setWidth, adjustWidth, handlePointerDown }
}
