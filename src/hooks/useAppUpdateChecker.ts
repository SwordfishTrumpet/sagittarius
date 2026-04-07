import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { logger } from '../utils/logger'

const CURRENT_VERSION = '1.0.1-20260402'
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000 // Check every 5 minutes

/**
 * Hook to check for app updates and prompt user to refresh.
 * Works with service worker to detect when a new version is available.
 */
export function useAppUpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  const checkForUpdate = useCallback(async () => {
    try {
      // Fetch current index.html to check version meta tag
      const response = await fetch('/index.html', {
        method: 'HEAD',
        cache: 'no-store',
      })
      
      if (!response.ok) return

      // Try to get version from response headers or fetch full HTML
      // For now, we use a simple timestamp-based check
      const lastModified = response.headers.get('last-modified')
      
      // Check if service worker is waiting
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        if (registration.waiting) {
          logger.info('[AppUpdate] New service worker waiting')
          setUpdateAvailable(true)
          
          toast.info('App update available', {
            description: 'Click to refresh and get the latest version',
            duration: 0, // Don't auto-dismiss
            action: {
              label: 'Update Now',
              onClick: () => {
                // Tell service worker to skip waiting
                registration.waiting?.postMessage('skipWaiting')
                // Reload after a brief delay
                setTimeout(() => window.location.reload(), 500)
              },
            },
          })
        }
      }
    } catch (err) {
      // Silently fail - don't show errors for version check failures
      logger.debug('[AppUpdate] Version check failed:', err)
    }
  }, [])

  const forceRefresh = useCallback(() => {
    // Clear all caches and reload
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key))
      })
    }
    
    // Tell service worker to clear cache
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.active?.postMessage('clearCache')
      })
    }
    
    // Force reload from server (not cache)
    window.location.reload()
  }, [])

  useEffect(() => {
    // Check immediately on mount
    checkForUpdate()

    // Set up periodic checks
    const interval = setInterval(checkForUpdate, VERSION_CHECK_INTERVAL)

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        logger.info('[AppUpdate] Service worker controller changed')
        setUpdateAvailable(true)
      })
    }

    return () => clearInterval(interval)
  }, [checkForUpdate])

  return { updateAvailable, checkForUpdate, forceRefresh }
}

/**
 * Utility to clear all browser caches and reload.
 * Call this when user reports seeing old/stale content.
 */
export async function clearAllCachesAndReload(): Promise<void> {
  // Clear service worker cache
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(r => r.unregister()))
  }

  // Clear all caches
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map(key => caches.delete(key)))
  }

  // Clear localStorage and sessionStorage
  localStorage.clear()
  sessionStorage.clear()

  // Reload with cache-busting query param
  window.location.href = window.location.pathname + '?nocache=' + Date.now()
}
