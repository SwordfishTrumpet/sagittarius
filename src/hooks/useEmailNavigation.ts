import { useState, useCallback } from 'react'

interface UseEmailNavigationOptions {
  emails: any[] | undefined
  currentEmailId: string | null
  onSelectEmail: (emailId: string, threadId: string | null) => void
}

interface UseEmailNavigationReturn {
  scrollToEmailId: string | null
  navigateToNext: () => void
  navigateToPrevious: () => void
  navigateToEmail: (emailId: string) => void
  clearScrollTarget: () => void
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
      ? emails.findIndex((e: any) => e.id === currentEmailId)
      : -1

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
      ? emails.findIndex((e: any) => e.id === currentEmailId)
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
    const email = emails?.find((e: any) => e.id === emailId)
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
  }
}
