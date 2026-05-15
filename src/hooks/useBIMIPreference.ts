import { useState, useCallback } from 'react'

const STORAGE_KEY = 'sagittarius:bimi-enabled'

function load(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) return raw === 'true'
  } catch {
    return true
  }
  return true
}

function persist(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function useBIMIPreference(): { showSenderIcons: boolean; setShowSenderIcons: (v: boolean) => void } {
  const [showSenderIcons, setState] = useState(load)

  const setShowSenderIcons = useCallback((value: boolean) => {
    setState(value)
    persist(value)
  }, [])

  return { showSenderIcons, setShowSenderIcons }
}
