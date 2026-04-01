import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { fetchEmailWithBody } from './jmap/useEmailQueries'
import { clearComposerDraft, getComposerDraftKey } from '../utils/draftStorage'
import { jmapClient } from '../api/jmap'

export interface ReplyContext {
  id: string
  subject: string
  from: Array<{ name?: string; email?: string }>
  to: Array<{ name?: string; email?: string }>
  cc?: Array<{ name?: string; email?: string }>
  textBody?: string
  htmlBody?: string
  blobId?: string
  threadId?: string
  _replyAll?: boolean
  _forward?: boolean
}

interface UseComposerStateReturn {
  isComposerOpen: boolean
  replyToEmail: ReplyContext | null
  draftEmail: any | null
  openComposer: () => void
  closeComposer: () => void
  handleReply: (selectedEmail: any) => void
  handleReplyAll: (selectedEmail: any) => void
  handleForward: (selectedEmail: any) => void
  handleOpenDraft: (emailId: string) => Promise<void>
}

/**
 * Hook for managing composer UI state.
 * Handles opening/closing composer, reply/reply-all/forward modes, and draft reopening.
 */
export function useComposerState(): UseComposerStateReturn {
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [replyToEmail, setReplyToEmail] = useState<ReplyContext | null>(null)
  const [draftEmail, setDraftEmail] = useState<any | null>(null)

  const openComposer = useCallback(() => {
    // Clear any lingering localStorage draft for new messages
    const accountId = jmapClient.getPrimaryAccount?.() ?? null
    const draftKey = getComposerDraftKey(accountId, null)
    clearComposerDraft(draftKey)
    
    setReplyToEmail(null)
    setDraftEmail(null)
    setIsComposerOpen(true)
  }, [])

  const closeComposer = useCallback(() => {
    setIsComposerOpen(false)
    setReplyToEmail(null)
    setDraftEmail(null)
  }, [])

  const handleReply = useCallback((selectedEmail: any) => {
    if (!selectedEmail) return
    setReplyToEmail(selectedEmail)
    setDraftEmail(null)
    setIsComposerOpen(true)
  }, [])

  const handleReplyAll = useCallback((selectedEmail: any) => {
    if (!selectedEmail) return
    setReplyToEmail({ ...selectedEmail, _replyAll: true })
    setDraftEmail(null)
    setIsComposerOpen(true)
  }, [])

  const handleForward = useCallback((selectedEmail: any) => {
    if (!selectedEmail) return
    setReplyToEmail({ ...selectedEmail, _forward: true })
    setDraftEmail(null)
    setIsComposerOpen(true)
  }, [])

  const handleOpenDraft = useCallback(async (emailId: string) => {
    try {
      const fullDraft = await fetchEmailWithBody(emailId)
      if (!fullDraft) {
        toast.error('Failed to reopen draft')
        return
      }

      setReplyToEmail(null)
      setDraftEmail(fullDraft)
      setIsComposerOpen(true)
    } catch (error: any) {
      toast.error(`Failed to reopen draft: ${error?.message || 'Unknown error'}`)
    }
  }, [])

  return {
    isComposerOpen,
    replyToEmail,
    draftEmail,
    openComposer,
    closeComposer,
    handleReply,
    handleReplyAll,
    handleForward,
    handleOpenDraft,
  }
}
