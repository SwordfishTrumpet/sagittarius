import type { JMAPGetResponse, JMAPQueryResponse, JMAPSetResponse } from '../../types/jmap'
import type { Mailbox, Email, Identity, Thread, JMAPAccount } from '../../types/jmap'
import type { JMAPSession } from '../../api/jmap'

type OverrideRecord = Record<string, unknown>

export function wrapMethodResponse(method: string, result: unknown, callId = '0'): [string, unknown, string] {
  return [method, result, callId]
}

export function makeSession(overrides: Partial<JMAPSession> = {}): JMAPSession {
  return {
    username: 'user@example.com',
    apiUrl: '/jmap/',
    downloadUrl: '/jmap/download/{accountId}/{blobId}/{name}?accept={type}',
    uploadUrl: '/jmap/upload/{accountId}/',
    eventSourceUrl: '/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
    capabilities: {
      'urn:ietf:params:jmap:core': {
        maxSizeUpload: 50_000_000,
        maxConcurrentUpload: 4,
        maxSizeRequest: 10_000_000,
        maxConcurrentRequests: 8,
        maxCallsInRequest: 16,
        maxObjectsInGet: 500,
        maxObjectsInSet: 500,
        collationAlgorithms: ['i;ascii-casemap'],
      },
      'urn:ietf:params:jmap:mail': {},
      'urn:ietf:params:jmap:submission': {
        maxDelayedSend: 0,
      },
      'urn:ietf:params:jmap:vacationresponse': {},
      'urn:ietf:params:jmap:sieve': {},
    },
    accounts: {
      'account-001': {
        name: 'user@example.com',
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: {
          'urn:ietf:params:jmap:mail': {},
          'urn:ietf:params:jmap:submission': {
            maxDelayedSend: 0,
          },
          'urn:ietf:params:jmap:vacationresponse': {},
          'urn:ietf:params:jmap:sieve': {},
        },
      },
    },
    primaryAccounts: {
      'urn:ietf:params:jmap:mail': 'account-001',
      'urn:ietf:params:jmap:submission': 'account-001',
    },
    state: 'session-state-001',
    ...overrides,
  }
}

export function makeMailboxList(overrides: OverrideRecord[] = []): JMAPGetResponse<Mailbox> {
  const base = [
    { id: 'mailbox-inbox', name: 'Inbox', role: 'inbox', sortOrder: 10, totalEmails: 12, unreadEmails: 3 },
    { id: 'mailbox-sent', name: 'Sent', role: 'sent', sortOrder: 20, totalEmails: 5, unreadEmails: 0 },
    { id: 'mailbox-drafts', name: 'Drafts', role: 'drafts', sortOrder: 30, totalEmails: 2, unreadEmails: 0 },
    { id: 'mailbox-trash', name: 'Trash', role: 'trash', sortOrder: 40, totalEmails: 1, unreadEmails: 0 },
    { id: 'mailbox-junk', name: 'Junk', role: 'junk', sortOrder: 50, totalEmails: 0, unreadEmails: 0 },
  ]

  return {
    accountId: 'account-001',
    state: 'mailboxes-state-001',
    list: base.map((mailbox, index) => ({
      ...mailbox,
      ...(overrides[index] || {}),
    })) as Mailbox[],
    notFound: [],
  }
}

interface EmailListFixtures {
  emails: Email[]
  query: JMAPQueryResponse
  get: JMAPGetResponse<Email>
}

export function makeEmailList(mailboxId: string, count = 3, overrides: OverrideRecord[] = []): EmailListFixtures {
  const emails: Email[] = Array.from({ length: count }, (_, index) => {
    const emailNumber = index + 1
    return {
      id: `email-${emailNumber}`,
      blobId: `blob-email-${emailNumber}`,
      threadId: `thread-${emailNumber}`,
      mailboxIds: { [mailboxId]: true },
      keywords: (index === 0 ? {} : { '$seen': true }) as Record<string, boolean>,
      size: 1024,
      preview: `Preview text ${emailNumber}`,
      subject: `Test subject ${emailNumber}`,
      receivedAt: `2025-01-0${Math.min(emailNumber, 9)}T12:00:00.000Z`,
      from: [{ name: `Sender ${emailNumber}`, email: `sender${emailNumber}@example.com` }],
      to: [{ name: 'User', email: 'user@example.com' }],
      cc: null,
      bcc: null,
      replyTo: null,
      hasAttachment: false,
      ...(overrides[index] || {}),
    }
  })

  return {
    emails,
    query: {
      accountId: 'account-001',
      queryState: 'query-state-001',
      canCalculateChanges: true,
      position: 0,
      ids: emails.map((email) => email.id),
      total: emails.length,
      limit: emails.length,
    },
    get: {
      accountId: 'account-001',
      state: 'emails-state-001',
      list: emails,
      notFound: [],
    },
  }
}

interface EmailDetailFixtures {
  email: Email
  result: JMAPGetResponse<Email>
}

export function makeEmailDetail(emailId: string, overrides: OverrideRecord = {}): EmailDetailFixtures {
  const email: Email = {
    id: emailId,
    blobId: `blob-${emailId}`,
    threadId: `thread-${emailId}`,
    mailboxIds: { 'mailbox-inbox': true },
    keywords: {},
    size: 2048,
    preview: `Preview of ${emailId}`,
    subject: `Detailed ${emailId}`,
    receivedAt: '2025-01-01T12:00:00.000Z',
    from: [{ name: 'Alice Example', email: 'alice@example.com' }],
    to: [{ name: 'User Example', email: 'user@example.com' }],
    cc: [],
    bcc: [],
    replyTo: null,
    hasAttachment: false,
    attachments: [],
    htmlBody: [{ partId: 'body-1', type: 'text/html' }],
    textBody: [],
    bodyValues: {
      'body-1': {
        value: '<p>Hello from the integration test.</p>',
        isTruncated: false,
      },
    },
    bodyStructure: {
      partId: 'body-1',
      type: 'text/html',
    },
    ...overrides,
  }

  return {
    email,
    result: {
      accountId: 'account-001',
      state: 'email-detail-state-001',
      list: [email],
      notFound: [],
    },
  }
}

export function makeThreadList(emails: Email[]): JMAPGetResponse<Thread> {
  const threadMap = new Map<string, string[]>()

  emails.forEach((email) => {
    const existing = threadMap.get(email.threadId) || []
    existing.push(email.id)
    threadMap.set(email.threadId, existing)
  })

  return {
    accountId: 'account-001',
    state: 'threads-state-001',
    list: Array.from(threadMap.entries()).map(([id, emailIds]) => ({ id, emailIds })),
    notFound: [],
  }
}

export interface SubmissionSetResult {
  emailSet: JMAPSetResponse<{ id: string; threadId: string }>
  submissionSet: JMAPSetResponse<{ id: string; emailId: string }>
}

export function makeSubmissionSuccess(): SubmissionSetResult {
  return {
    emailSet: {
      accountId: 'account-001',
      oldState: 'emails-old-state-001',
      newState: 'emails-new-state-001',
      created: {
        'draft-1': {
          id: 'email-created-001',
          threadId: 'thread-created-001',
        },
      },
    },
    submissionSet: {
      accountId: 'account-001',
      oldState: 'submissions-old-state-001',
      newState: 'submissions-new-state-001',
      created: {
        'send-1': {
          id: 'submission-001',
          emailId: 'email-created-001',
        },
      },
    },
  }
}

export function makeIdentityList(overrides: OverrideRecord[] = []): JMAPGetResponse<Identity> {
  const base = [
    {
      id: 'identity-001',
      name: 'User Example',
      email: 'user@example.com',
      replyTo: null,
      bcc: null,
      textSignature: '',
      htmlSignature: '',
      mayDelete: true,
    },
  ]

  return {
    accountId: 'account-001',
    state: 'identities-state-001',
    list: base.map((identity, index) => ({
      ...identity,
      ...(overrides[index] || {}),
    })) as Identity[],
    notFound: [],
  }
}
