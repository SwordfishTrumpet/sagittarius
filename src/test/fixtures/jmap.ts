import type { JMAPSession } from '../../api/jmap'

type PartialRecord<T> = {
  [K in keyof T]?: T[K]
}

export function wrapMethodResponse(method: string, result: any, callId = '0'): [string, any, string] {
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

export function makeMailboxList(overrides: Array<PartialRecord<any>> = []) {
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
    })),
    notFound: [],
  }
}

export function makeEmailList(mailboxId: string, count = 3, overrides: Array<PartialRecord<any>> = []) {
  const emails = Array.from({ length: count }, (_, index) => {
    const emailNumber = index + 1
    return {
      id: `email-${emailNumber}`,
      threadId: `thread-${emailNumber}`,
      mailboxIds: { [mailboxId]: true },
      from: [{ name: `Sender ${emailNumber}`, email: `sender${emailNumber}@example.com` }],
      subject: `Test subject ${emailNumber}`,
      preview: `Preview text ${emailNumber}`,
      receivedAt: `2025-01-0${Math.min(emailNumber, 9)}T12:00:00.000Z`,
      keywords: index === 0 ? {} : { '$seen': true },
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

export function makeEmailDetail(emailId: string, overrides: PartialRecord<any> = {}) {
  const email = {
    id: emailId,
    threadId: `thread-${emailId}`,
    mailboxIds: { 'mailbox-inbox': true },
    from: [{ name: 'Alice Example', email: 'alice@example.com' }],
    to: [{ name: 'User Example', email: 'user@example.com' }],
    cc: [],
    bcc: [],
    subject: `Detailed ${emailId}`,
    receivedAt: '2025-01-01T12:00:00.000Z',
    bodyValues: {
      'body-1': {
        value: '<p>Hello from the integration test.</p>',
        isTruncated: false,
      },
    },
    htmlBody: [{ partId: 'body-1', type: 'text/html' }],
    textBody: [],
    keywords: {},
    hasAttachment: false,
    attachments: [],
    bodyStructure: {
      partId: 'body-1',
      type: 'text/html',
    },
    blobId: `blob-${emailId}`,
    'header:Disposition-Notification-To:asText': null,
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

export function makeThreadList(emails: any[]) {
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

export function makeSubmissionSuccess() {
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

export function makeIdentityList(overrides: Array<PartialRecord<any>> = []) {
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
    })),
    notFound: [],
  }
}
