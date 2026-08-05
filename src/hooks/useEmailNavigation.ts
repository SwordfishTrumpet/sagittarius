import { useState, useCallback } from 'react'
import type { Email } from '../types/jmap'

interface UseEmailNavigationOptions {
  emails: Email[] | undefined
  currentEmailId: string | null
  onSelectEmail: (emailId: string, threadId: string | null) => void
}

interface UseEmailNavigationReturn {
  scrollToEmailId: string | null
  navigateToNext: () => void
  navigateToPrevious: () => void
  navigateToEmail: (emailId: string) => void
  clearScrollTarget: () => void
  setScrollToEmailId: (id: string | null) => void
}

/**
 * Hook for email list keyboard navigation.
 * Handles j/k navigation, scroll-to behavior, and email selection.
 */
export function useEmailNavigation({
  emails,
  currentEmailId,
  onSelectEmail,
}: UseEmailNavigationOptions): UseEmailNavigationReturn {
  const [scrollToEmailId, setScrollToEmailId] = useState<string | null>(null)

  const navigateToNext = useCallback(() => {
    if (!emails || emails.length === 0) return

    // Find currently selected email index using currentEmailId
    const currentIndex = currentEmailId
      ? emails.findIndex((e: Email) => e.id === currentEmailId)
      : -1

    // No email selected yet: j/ArrowDown should select the first email.
    // (When currentEmailId is set but not found — a stale selection — keep
    // the old no-op behavior.)
    if (currentEmailId === null) {
      const firstEmail = emails[0]
      if (firstEmail) {
        onSelectEmail(firstEmail.id, firstEmail.threadId || null)
        setScrollToEmailId(firstEmail.id)
      }
      return
    }

    // Return early if current email not found in list
    if (currentIndex === -1) return

    const newIndex = currentIndex < emails.length - 1 ? currentIndex + 1 : currentIndex
    const newEmail = emails[newIndex]

    if (newEmail && newIndex !== currentIndex) {
      onSelectEmail(newEmail.id, newEmail.threadId || null)
      setScrollToEmailId(newEmail.id)
    }
  }, [emails, currentEmailId, onSelectEmail])

  const navigateToPrevious = useCallback(() => {
    if (!emails || emails.length === 0) return

    const currentIndex = currentEmailId
      ? emails.findIndex((e: Email) => e.id === currentEmailId)
      : -1

    // Return early if current email not found in list
    if (currentIndex === -1) return

    const newIndex = currentIndex > 0 ? currentIndex - 1 : 0
    const newEmail = emails[newIndex]

    if (newEmail && newIndex !== currentIndex) {
      onSelectEmail(newEmail.id, newEmail.threadId || null)
      setScrollToEmailId(newEmail.id)
    }
  }, [emails, currentEmailId, onSelectEmail])

  const navigateToEmail = useCallback((emailId: string) => {
    const email = emails?.find((e: Email) => e.id === emailId)
    if (email) {
      onSelectEmail(emailId, email.threadId || null)
      setScrollToEmailId(emailId)
    }
  }, [emails, onSelectEmail])

  const clearScrollTarget = useCallback(() => {
    setScrollToEmailId(null)
  }, [])

  return {
    scrollToEmailId,
    navigateToNext,
    navigateToPrevious,
    navigateToEmail,
    clearScrollTarget,
    setScrollToEmailId,
  }
}
