import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { fetchEmailWithBody } from './jmap/useEmailQueries'
import { clearComposerDraft, getComposerDraftKey } from '../utils/draftStorage'
import { jmapClient } from '../api/jmap'
import { toastOperationError } from '../utils/toastHelpers'
import type { Email, EmailAddress } from '../types/jmap'

export interface ReplyContext {
  id: string
  subject: string
  from: Array<{ name?: string; email: string }>
  to: Array<{ name?: string; email: string }>
  cc?: Array<{ name?: string; email: string }>
  /** HTML body content (string, not EmailBodyPart) */
  textBody?: string
  /** Plain text body content (string) */
  htmlBody?: string
  blobId?: string
  threadId?: string
  receivedAt?: string
  /** For quote building - body parts and values */
  bodyParts?: {
    htmlBody?: { partId?: string; type?: string }[]
    textBody?: { partId?: string; type?: string }[]
    bodyValues?: Record<string, { value: string }>
  }
  _replyAll?: boolean
  _forward?: boolean
}

interface UseComposerStateReturn {
  isComposerOpen: boolean
  replyToEmail: ReplyContext | null
  draftEmail: Email | null
  openComposer: () => void
  closeComposer: () => void
  handleReply: (selectedEmail: Email) => void
  handleReplyAll: (selectedEmail: Email) => void
  handleForward: (selectedEmail: Email) => void
  handleOpenDraft: (emailId: string) => Promise<void>
}

/**
 * Hook for managing composer UI state.
 * Handles opening/closing composer, reply/reply-all/forward modes, and draft reopening.
 */
export function useComposerState(): UseComposerStateReturn {
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [replyToEmail, setReplyToEmail] = useState<ReplyContext | null>(null)
  const [draftEmail, setDraftEmail] = useState<Email | null>(null)

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

  const handleReply = useCallback((selectedEmail: Email) => {
    if (!selectedEmail) return
    const context: ReplyContext = {
      id: selectedEmail.id,
      subject: selectedEmail.subject || '',
      from: (selectedEmail.from || []).map((a: EmailAddress) => ({ name: a.name || undefined, email: a.email })),
      to: (selectedEmail.to || []).map((a: EmailAddress) => ({ name: a.name || undefined, email: a.email })),
      cc: selectedEmail.cc?.map((a: EmailAddress) => ({ name: a.name || undefined, email: a.email })),
      blobId: selectedEmail.blobId,
      threadId: selectedEmail.threadId,
      receivedAt: selectedEmail.receivedAt,
      bodyParts: {
        htmlBody: selectedEmail.htmlBody?.map(p => ({ partId: p.partId, type: p.type })) || undefined,
        textBody: selectedEmail.textBody?.map(p => ({ partId: p.partId, type: p.type })) || undefined,
        bodyValues: selectedEmail.bodyValues ? 
          Object.fromEntries(Object.entries(selectedEmail.bodyValues).map(([k, v]) => [k, { value: v.value }])) : 
          undefined,
      },
    }
    setReplyToEmail(context)
    setDraftEmail(null)
    setIsComposerOpen(true)
  }, [])

  const handleReplyAll = useCallback((selectedEmail: Email) => {
    if (!selectedEmail) return
    const context: ReplyContext = {
      id: selectedEmail.id,
      subject: selectedEmail.subject || '',
      from: (selectedEmail.from || []).map((a: EmailAddress) => ({ name: a.name || undefined, email: a.email })),
      to: (selectedEmail.to || []).map((a: EmailAddress) => ({ name: a.name || undefined, email: a.email })),
      cc: selectedEmail.cc?.map((a: EmailAddress) => ({ name: a.name || undefined, email: a.email })),
      blobId: selectedEmail.blobId,
      threadId: selectedEmail.threadId,
      receivedAt: selectedEmail.receivedAt,
      bodyParts: {
        htmlBody: selectedEmail.htmlBody?.map(p => ({ partId: p.partId, type: p.type })) || undefined,
        textBody: selectedEmail.textBody?.map(p => ({ partId: p.partId, type: p.type })) || undefined,
        bodyValues: selectedEmail.bodyValues ? 
          Object.fromEntries(Object.entries(selectedEmail.bodyValues).map(([k, v]) => [k, { value: v.value }])) : 
          undefined,
      },
      _replyAll: true,
    }
    setReplyToEmail(context)
    setDraftEmail(null)
    setIsComposerOpen(true)
  }, [])

  const handleForward = useCallback((selectedEmail: Email) => {
    if (!selectedEmail) return
    const context: ReplyContext = {
      id: selectedEmail.id,
      subject: selectedEmail.subject || '',
      from: (selectedEmail.from || []).map((a: EmailAddress) => ({ name: a.name || undefined, email: a.email })),
      to: (selectedEmail.to || []).map((a: EmailAddress) => ({ name: a.name || undefined, email: a.email })),
      cc: selectedEmail.cc?.map((a: EmailAddress) => ({ name: a.name || undefined, email: a.email })),
      blobId: selectedEmail.blobId,
      threadId: selectedEmail.threadId,
      receivedAt: selectedEmail.receivedAt,
      bodyParts: {
        htmlBody: selectedEmail.htmlBody?.map(p => ({ partId: p.partId, type: p.type })) || undefined,
        textBody: selectedEmail.textBody?.map(p => ({ partId: p.partId, type: p.type })) || undefined,
        bodyValues: selectedEmail.bodyValues ? 
          Object.fromEntries(Object.entries(selectedEmail.bodyValues).map(([k, v]) => [k, { value: v.value }])) : 
          undefined,
      },
      _forward: true,
    }
    setReplyToEmail(context)
    setDraftEmail(null)
    setIsComposerOpen(true)
  }, [])

  const handleOpenDraft = useCallback(async (emailId: string) => {
    try {
      const fullDraft = await fetchEmailWithBody(emailId)
      if (!fullDraft) {
        toastOperationError('email.reopen')
        return
      }

      setReplyToEmail(null)
      setDraftEmail(fullDraft as Email)
      setIsComposerOpen(true)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toastOperationError('email.reopen', errorMessage)
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
