/**
 * Utility for building JMAP email body structures
 * Used by useCompose and useSaveDraft to avoid code duplication
 */

export interface AttachmentInput {
  blobId: string
  name: string
  type: string
  size: number
}

export interface EmailBodyResult {
  bodyValues: Record<string, { value: string; isTruncated: false }>
  textBody?: Array<{ partId: string; type: string }> | null
  htmlBody?: Array<{ partId: string; type: string }> | null
  bodyStructure?: {
    type: 'multipart/mixed'
    subParts: Array<
      | { partId: string; type: string }
      | { blobId: string; type: string; name: string; disposition: 'attachment' }
    >
  } | null
}

/**
 * Builds the email body structure for JMAP Email/set
 * Handles both plain text and HTML bodies, with optional attachments
 * 
 * @param body - The email body content
 * @param attachments - Optional array of attachments
 * @param draftId - Optional draft ID for updates (requires nulling unused body parts)
 * @returns Email body structure for JMAP
 * 
 * @example
 * ```ts
 * const bodyStructure = buildEmailBody('<p>Hello</p>', attachments, draftId)
 * const draftEmail = {
 *   mailboxIds: { [draftBox.id]: true },
 *   from: [{ email: fromEmail }],
 *   ...bodyStructure,
 * }
 * ```
 */
export function buildEmailBody(
  body: string,
  attachments?: AttachmentInput[],
  draftId?: string
): EmailBodyResult {
  const bodyPartType: 'text/html' | 'text/plain' = body.includes('<') ? 'text/html' : 'text/plain'

  const result: EmailBodyResult = {
    bodyValues: {
      'body-1': {
        value: body,
        isTruncated: false,
      },
    },
  }

  if (attachments?.length) {
    result.bodyStructure = {
      type: 'multipart/mixed',
      subParts: [
        { partId: 'body-1', type: bodyPartType },
        ...attachments.map((attachment) => ({
          blobId: attachment.blobId,
          type: attachment.type || 'application/octet-stream',
          name: attachment.name,
          disposition: 'attachment' as const,
        })),
      ],
    }
    // Only explicitly null body arrays when updating an existing draft
    // For new drafts, we don't include these properties at all
    if (draftId) {
      result.textBody = null
      result.htmlBody = null
    }
  } else {
    // Set the appropriate body part based on content type
    if (bodyPartType === 'text/html') {
      result.htmlBody = [{ partId: 'body-1', type: bodyPartType }]
    } else {
      result.textBody = [{ partId: 'body-1', type: bodyPartType }]
    }
    
    // Only explicitly null the opposite body type and bodyStructure when updating
    if (draftId) {
      result.bodyStructure = null
      // Null the opposite body type
      if (bodyPartType === 'text/html') {
        result.textBody = null
      } else {
        result.htmlBody = null
      }
    }
  }

  return result
}
