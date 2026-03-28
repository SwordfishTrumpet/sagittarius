/**
 * RFC 8621 (JMAP Mail) Compliance Tests
 *
 * Tests the application's adherence to RFC 8621:
 * - Section 2: Mailboxes (Mailbox/get, Mailbox/set)
 * - Section 4: Emails (Email/query, Email/get, Email/set, Email/import, Email/parse)
 * - Section 3: Threads (Thread/get)
 * - Section 5: SearchSnippets (SearchSnippet/get)
 * - Section 6: Identities (Identity/get, Identity/set)
 * - Section 7: Email Submission (EmailSubmission/set, onSuccessUpdateEmail)
 * - Section 8: VacationResponse (VacationResponse/get, VacationResponse/set)
 *
 * These tests validate the method call shapes, argument structures, and
 * property sets that the client sends to the server.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockSessionStorage: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val; }),
  removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]); }),
  get length() { return Object.keys(mockSessionStorage).length; },
  key: vi.fn((i: number) => Object.keys(mockSessionStorage)[i] ?? null),
};

function makeSession() {
  return {
    username: 'user@example.com',
    apiUrl: 'https://mail.example.com/jmap/',
    downloadUrl: 'https://mail.example.com/jmap/download/{accountId}/{blobId}/{name}?accept={type}',
    uploadUrl: 'https://mail.example.com/jmap/upload/{accountId}/',
    eventSourceUrl: 'https://mail.example.com/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
    capabilities: {
      'urn:ietf:params:jmap:core': {},
      'urn:ietf:params:jmap:mail': {},
      'urn:ietf:params:jmap:submission': {},
    },
    accounts: {
      'account-001': {
        name: 'user@example.com',
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: {
          'urn:ietf:params:jmap:mail': {},
          'urn:ietf:params:jmap:submission': {},
        },
      },
    },
    primaryAccounts: {
      'urn:ietf:params:jmap:mail': 'account-001',
      'urn:ietf:params:jmap:submission': 'account-001',
    },
    state: 'session-state-001',
  };
}

/** Capture the parsed JSON body of the Nth API call (0-indexed, skipping auth call) */
function getRequestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number) {
  return JSON.parse(fetchMock.mock.calls[callIndex][1].body);
}

let fetchMock: ReturnType<typeof vi.fn>;

async function authenticatedClient() {
  const session = makeSession();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => session,
    text: async () => JSON.stringify(session),
  });
  const { jmapClient } = await import('../jmap');
  await jmapClient.authenticate('user@example.com', 'password');
  return jmapClient;
}

function mockJMAPResponse(...methodResponses: [string, any, string][]) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ methodResponses, sessionState: 's1' }),
    text: async () => JSON.stringify({ methodResponses, sessionState: 's1' }),
  });
}

describe('RFC 8621 — JMAP Mail Protocol', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('sessionStorage', sessionStorageMock);
    vi.stubGlobal('location', { replace: vi.fn(), href: '' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // §2 — Mailboxes
  // =========================================================================
  describe('§2 — Mailbox Methods', () => {
    it('Mailbox/get should use ids: null for all mailboxes (§2.2)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Mailbox/get', { list: [], state: 's1', accountId: 'account-001', notFound: [] }, '0']);

      await client.request([
        ['Mailbox/get', { accountId: 'account-001', ids: null }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Mailbox/get');
      expect(mc[1].accountId).toBe('account-001');
      // RFC 8621 §2.2: ids: null means get all mailboxes
      expect(mc[1].ids).toBeNull();
    });

    it('Mailbox/set create should include name and isSubscribed (§2.4)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Mailbox/set', { created: { 'new-1': { id: 'mb-new' } }, accountId: 'account-001' }, '0']);

      await client.request([
        ['Mailbox/set', {
          accountId: 'account-001',
          create: {
            'new-1': { name: 'Projects', isSubscribed: true },
          },
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Mailbox/set');
      const createObj = mc[1].create['new-1'];
      // RFC 8621 §2.1: Mailbox MUST have a name
      expect(createObj).toHaveProperty('name');
      expect(typeof createObj.name).toBe('string');
    });

    it('Mailbox/set destroy should provide array of ids (§2.4)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Mailbox/set', { destroyed: ['mb-123'], accountId: 'account-001' }, '0']);

      await client.request([
        ['Mailbox/set', {
          accountId: 'account-001',
          destroy: ['mb-123'],
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Mailbox/set');
      // RFC 8620 §5.3: destroy is an array of Ids
      expect(Array.isArray(mc[1].destroy)).toBe(true);
      expect(mc[1].destroy[0]).toBe('mb-123');
    });

    it('Mailbox/set update should use patch object format (§2.4)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Mailbox/set', { updated: { 'mb-123': null }, accountId: 'account-001' }, '0']);

      await client.request([
        ['Mailbox/set', {
          accountId: 'account-001',
          update: {
            'mb-123': { name: 'Renamed Folder' },
          },
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Mailbox/set');
      // RFC 8620 §5.3: update maps Id -> PatchObject
      expect(mc[1].update['mb-123']).toEqual({ name: 'Renamed Folder' });
    });
  });

  // =========================================================================
  // §4 — Emails
  // =========================================================================
  describe('§4 — Email Methods', () => {
    it('Email/query should include filter, sort, and optional collapseThreads (§4.4)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Email/query', { ids: ['e1', 'e2'], queryState: 'qs1', canCalculateChanges: true, position: 0, total: 2 }, '0']);

      await client.request([
        ['Email/query', {
          accountId: 'account-001',
          filter: { inMailbox: 'inbox-id' },
          sort: [{ property: 'receivedAt', isAscending: false }],
          collapseThreads: true,
          limit: 100,
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Email/query');

      // RFC 8621 §4.4: filter is a FilterCondition or FilterOperator
      expect(mc[1]).toHaveProperty('filter');
      // RFC 8621 §4.4: sort is an array of Comparator objects
      expect(Array.isArray(mc[1].sort)).toBe(true);
      const comp = mc[1].sort[0];
      expect(comp).toHaveProperty('property');
      expect(comp).toHaveProperty('isAscending');
      // RFC 8621 §4.4: collapseThreads is Boolean
      expect(typeof mc[1].collapseThreads).toBe('boolean');
    });

    it('Email/query sort Comparator must have property and isAscending (§4.4.2)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Email/query', { ids: [], queryState: 'qs1', canCalculateChanges: false, position: 0, total: 0 }, '0']);

      await client.request([
        ['Email/query', {
          accountId: 'account-001',
          filter: {},
          sort: [{ property: 'receivedAt', isAscending: false }],
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const comp = body.methodCalls[0][1].sort[0];

      // RFC 8621 §4.4.2: valid sort properties include "receivedAt", "sentAt", "size", etc.
      expect(['receivedAt', 'sentAt', 'size', 'from', 'to', 'subject', 'hasKeyword', 'allInThreadHaveKeyword', 'someInThreadHaveKeyword']).toContain(comp.property);
      expect(typeof comp.isAscending).toBe('boolean');
    });

    it('Email/get should request specific properties list (§4.2)', async () => {
      const client = await authenticatedClient();
      const properties = ['id', 'threadId', 'mailboxIds', 'from', 'subject', 'preview', 'receivedAt', 'keywords', 'hasAttachment'];
      mockJMAPResponse(['Email/get', { list: [], state: 's1', accountId: 'account-001', notFound: [] }, '0']);

      await client.request([
        ['Email/get', {
          accountId: 'account-001',
          ids: ['e1'],
          properties,
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Email/get');
      // RFC 8621 §4.2: properties array restricts which fields are returned
      expect(Array.isArray(mc[1].properties)).toBe(true);
      // All requested properties must be valid RFC 8621 §4.1 Email properties
      const validProps = [
        'id', 'blobId', 'threadId', 'mailboxIds', 'keywords', 'size',
        'receivedAt', 'messageId', 'inReplyTo', 'references', 'sender',
        'from', 'to', 'cc', 'bcc', 'replyTo', 'subject', 'sentAt',
        'hasAttachment', 'preview', 'bodyStructure', 'bodyValues',
        'textBody', 'htmlBody', 'attachments', 'headers',
      ];
      mc[1].properties.forEach((prop: string) => {
        // Allow header:* properties per RFC 8621 §4.1.1
        if (prop.startsWith('header:')) return;
        expect(validProps).toContain(prop);
      });
    });

    it('Email/get with fetchAllBodyValues should be boolean (§4.2)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Email/get', { list: [], state: 's1', accountId: 'account-001', notFound: [] }, '0']);

      await client.request([
        ['Email/get', {
          accountId: 'account-001',
          ids: ['e1'],
          fetchAllBodyValues: true,
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      expect(body.methodCalls[0][1].fetchAllBodyValues).toBe(true);
    });

    it('Email/set keyword patch must use "keywords/KEY" path format (§4.3)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Email/set', { updated: { 'e1': null } }, '0']);

      // Test the patch format that useEmailActions builds
      const patch = {
        'keywords/$flagged': true,
        'keywords/$seen': null,
      };

      await client.request([
        ['Email/set', {
          accountId: 'account-001',
          update: { 'e1': patch },
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const update = body.methodCalls[0][1].update['e1'];

      // RFC 8621 §4.3: use "keywords/$keyword" path to set/remove individual keywords
      // true = set keyword, null = remove keyword
      expect(update['keywords/$flagged']).toBe(true);
      expect(update['keywords/$seen']).toBeNull();
    });

    it('Email/set mailboxIds update must be an object of Id -> Boolean (§4.3)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Email/set', { updated: { 'e1': null } }, '0']);

      await client.request([
        ['Email/set', {
          accountId: 'account-001',
          update: {
            'e1': {
              mailboxIds: { 'trash-id': true },
            },
          },
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mailboxIds = body.methodCalls[0][1].update['e1'].mailboxIds;

      // RFC 8621 §4.1: mailboxIds is Id[Boolean] — object mapping mailbox IDs to true
      expect(typeof mailboxIds).toBe('object');
      expect(mailboxIds['trash-id']).toBe(true);
    });

    it('Email/import should use emails map with blobId and mailboxIds (§4.8)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Email/import', { created: { 'import-1': { id: 'e-new' } } }, '0']);

      await client.request([
        ['Email/import', {
          accountId: 'account-001',
          emails: {
            'import-1': {
              blobId: 'blob-123',
              mailboxIds: { 'inbox-id': true },
              receivedAt: '2024-01-15T10:30:00Z',
            },
          },
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Email/import');
      const importObj = mc[1].emails['import-1'];

      // RFC 8621 §4.8: required properties for Email/import
      expect(importObj).toHaveProperty('blobId');
      expect(importObj).toHaveProperty('mailboxIds');
      // receivedAt is optional but should be UTCDate if present
      if (importObj.receivedAt) {
        // Must be a valid ISO 8601 date string (UTCDate per RFC 8620 §1.4)
        // Note: Date.toISOString() always includes milliseconds (.000Z) but
        // both "2024-01-15T10:30:00Z" and "2024-01-15T10:30:00.000Z" are
        // valid ISO 8601 / RFC 3339 representations of the same instant.
        const parsed = new Date(importObj.receivedAt);
        expect(parsed.getTime()).not.toBeNaN();
        expect(parsed.getTime()).toBe(new Date('2024-01-15T10:30:00Z').getTime());
      }
    });

    it('Email/parse should use blobIds array and properties list (§4.9)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Email/parse', { parsed: {}, notParsable: [], notFound: [] }, '0']);

      await client.request([
        ['Email/parse', {
          accountId: 'account-001',
          blobIds: ['blob-123'],
          properties: ['from', 'to', 'subject'],
          fetchAllBodyValues: true,
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Email/parse');
      // RFC 8621 §4.9: blobIds is Id[] (required)
      expect(Array.isArray(mc[1].blobIds)).toBe(true);
      expect(mc[1].blobIds.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // §3 — Threads
  // =========================================================================
  describe('§3 — Thread Methods', () => {
    it('Thread/get should request by thread IDs (§3.2)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Thread/get', { list: [{ id: 't1', emailIds: ['e1', 'e2'] }], state: 's1', notFound: [] }, '0']);

      await client.request([
        ['Thread/get', {
          accountId: 'account-001',
          ids: ['t1'],
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Thread/get');
      // RFC 8621 §3.2: Standard /get with ids array
      expect(Array.isArray(mc[1].ids)).toBe(true);
    });
  });

  // =========================================================================
  // §5 — SearchSnippets
  // =========================================================================
  describe('§5 — SearchSnippet Methods', () => {
    it('SearchSnippet/get should include filter and emailIds (§5.2)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['SearchSnippet/get', { list: [], notFound: [] }, '0']);

      await client.request([
        ['SearchSnippet/get', {
          accountId: 'account-001',
          filter: { text: 'hello' },
          emailIds: ['e1', 'e2'],
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('SearchSnippet/get');
      // RFC 8621 §5.2: requires filter (same as Email/query) and emailIds
      expect(mc[1]).toHaveProperty('filter');
      expect(Array.isArray(mc[1].emailIds)).toBe(true);
    });
  });

  // =========================================================================
  // §6 — Identities
  // =========================================================================
  describe('§6 — Identity Methods', () => {
    it('Identity/get with ids: null should return all identities (§6.2)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Identity/get', { list: [], state: 's1', notFound: [] }, '0']);

      await client.request([
        ['Identity/get', { accountId: 'account-001', ids: null }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Identity/get');
      expect(mc[1].ids).toBeNull();
    });

    it('Identity/set create must include email property (§6.3)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Identity/set', { created: { 'id-new': { id: 'identity-1' } } }, '0']);

      await client.request([
        ['Identity/set', {
          accountId: 'account-001',
          create: {
            'id-new': {
              name: 'Alice',
              email: 'alice@example.com',
            },
          },
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const createObj = body.methodCalls[0][1].create['id-new'];
      // RFC 8621 §6.1: email is required for Identity
      expect(createObj).toHaveProperty('email');
      expect(typeof createObj.email).toBe('string');
    });

    it('Identity/set destroy should provide array of ids (§6.3)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['Identity/set', { destroyed: ['identity-1'] }, '0']);

      await client.request([
        ['Identity/set', {
          accountId: 'account-001',
          destroy: ['identity-1'],
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      expect(Array.isArray(body.methodCalls[0][1].destroy)).toBe(true);
    });
  });

  // =========================================================================
  // §7 — Email Submission
  // =========================================================================
  describe('§7 — EmailSubmission Methods', () => {
    it('EmailSubmission/set with back-reference must use "#" prefix (§7.5 + RFC 8620 §3.7)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(
        ['Email/set', { created: { 'draft-1': { id: 'e-created' } } }, '0'],
        ['EmailSubmission/set', { created: { 'send-1': { id: 'sub-1' } } }, '1'],
      );

      await client.request([
        ['Email/set', {
          accountId: 'account-001',
          create: {
            'draft-1': {
              mailboxIds: { 'drafts-id': true },
              from: [{ email: 'user@example.com' }],
              to: [{ email: 'bob@example.com' }],
              subject: 'Test',
              bodyValues: { 'body-1': { value: 'Hello', isTruncated: false } },
              textBody: [{ partId: 'body-1', type: 'text/plain' }],
              keywords: { '$draft': true },
            },
          },
        }, '0'],
        ['EmailSubmission/set', {
          accountId: 'account-001',
          create: {
            'send-1': {
              emailId: '#draft-1',
              identityId: 'identity-1',
            },
          },
          onSuccessUpdateEmail: {
            '#send-1': {
              mailboxIds: { 'sent-id': true },
              'keywords/$draft': null,
              'keywords/$seen': true,
            },
          },
        }, '1'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const submissionCall = body.methodCalls[1];

      // EmailSubmission/set create must use "#" prefixed creation ID for back-reference
      const submissionCreate = submissionCall[1].create['send-1'];
      expect(submissionCreate.emailId).toBe('#draft-1');
      expect(submissionCreate).toHaveProperty('identityId');

      // RFC 8621 §7.5: onSuccessUpdateEmail maps creation ID reference -> patch
      expect(submissionCall[1]).toHaveProperty('onSuccessUpdateEmail');
      const onSuccess = submissionCall[1].onSuccessUpdateEmail['#send-1'];
      expect(onSuccess).toBeDefined();
      // Should move to Sent and remove $draft keyword
      expect(onSuccess['keywords/$draft']).toBeNull();
    });

    it('EmailSubmission/query should accept filter with emailId (§7.3)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['EmailSubmission/query', { ids: ['sub-1'], queryState: 'qs1', canCalculateChanges: false, position: 0, total: 1 }, '0']);

      await client.request([
        ['EmailSubmission/query', {
          accountId: 'account-001',
          filter: { emailId: 'e1' },
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      expect(body.methodCalls[0][0]).toBe('EmailSubmission/query');
      expect(body.methodCalls[0][1].filter.emailId).toBe('e1');
    });

    it('EmailSubmission/set should support sendAt for scheduled send (§7.5)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(
        ['Email/set', { created: { 'draft-1': { id: 'e-created' } } }, '0'],
        ['EmailSubmission/set', { created: { 'send-1': { id: 'sub-1' } } }, '1'],
      );

      const sendAt = '2025-01-15T14:00:00Z';
      await client.request([
        ['Email/set', {
          accountId: 'account-001',
          create: { 'draft-1': { mailboxIds: { 'drafts-id': true }, from: [{ email: 'a@b.com' }], to: [{ email: 'c@d.com' }], subject: 'x', bodyValues: { 'b1': { value: 'y', isTruncated: false } }, textBody: [{ partId: 'b1', type: 'text/plain' }] } },
        }, '0'],
        ['EmailSubmission/set', {
          accountId: 'account-001',
          create: { 'send-1': { emailId: '#draft-1', identityId: 'id-1', sendAt } },
          onSuccessUpdateEmail: { '#send-1': { mailboxIds: { 'sent-id': true } } },
        }, '1'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const submission = body.methodCalls[1][1].create['send-1'];
      expect(submission.sendAt).toBe(sendAt);
      // sendAt must be a valid UTCDate (RFC 8620 §1.4)
      // Both "...T14:00:00Z" and "...T14:00:00.000Z" are valid ISO 8601.
      const parsed = new Date(submission.sendAt);
      expect(parsed.getTime()).not.toBeNaN();
      expect(parsed.getTime()).toBe(new Date('2025-01-15T14:00:00Z').getTime());
    });
  });

  // =========================================================================
  // §8 — VacationResponse
  // =========================================================================
  describe('§8 — VacationResponse Methods', () => {
    it('VacationResponse/get with ids: null should return singleton (§8.2)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['VacationResponse/get', { list: [{ id: 'singleton', isEnabled: false }], state: 's1', notFound: [] }, '0']);

      await client.request([
        ['VacationResponse/get', { accountId: 'account-001', ids: null }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      expect(body.methodCalls[0][0]).toBe('VacationResponse/get');
      expect(body.methodCalls[0][1].ids).toBeNull();
    });

    it('VacationResponse/set update should use "singleton" key (§8.3)', async () => {
      const client = await authenticatedClient();
      mockJMAPResponse(['VacationResponse/set', { updated: { singleton: null } }, '0']);

      await client.request([
        ['VacationResponse/set', {
          accountId: 'account-001',
          update: {
            singleton: {
              isEnabled: true,
              subject: 'Out of Office',
              textBody: 'I am currently away.',
            },
          },
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('VacationResponse/set');
      // RFC 8621 §8.3: VacationResponse has a fixed singleton ID
      expect(mc[1].update).toHaveProperty('singleton');
      expect(mc[1].update.singleton.isEnabled).toBe(true);
    });
  });

  // =========================================================================
  // §4.4.1 — Email FilterCondition
  // =========================================================================
  describe('§4.4.1 — Email FilterCondition', () => {
    it('should map SearchFilter fields to valid RFC 8621 filter conditions', async () => {
      const { buildJMAPFilter } = await import('../../utils/filterBuilder');

      const filter = buildJMAPFilter({
        from: 'alice@example.com',
        to: 'bob@example.com',
        cc: 'carol@example.com',
        subject: 'meeting',
        text: 'agenda',
        hasAttachment: true,
        isUnread: true,
        isFlagged: true,
        isDraft: true,
        isAnswered: true,
      });

      // When multiple hasKeyword conditions exist, buildJMAPFilter wraps
      // everything in allOf per RFC 8620 §5.5. The first element is the
      // base filter with non-keyword conditions, followed by individual
      // hasKeyword conditions.
      expect(filter).toHaveProperty('allOf');
      expect(Array.isArray(filter.allOf)).toBe(true);

      // The base filter (first element) contains the non-keyword conditions
      const base = filter.allOf[0];
      expect(base.from).toBe('alice@example.com');
      expect(base.to).toBe('bob@example.com');
      expect(base.cc).toBe('carol@example.com');
      expect(base.subject).toBe('meeting');
      expect(base.text).toBe('agenda');
      expect(base.hasAttachment).toBe(true);
      expect(base.notHasKeyword).toBe('$seen');

      // The remaining elements are individual hasKeyword conditions
      const keywords = filter.allOf.slice(1).map((c: any) => c.hasKeyword);
      expect(keywords).toContain('$flagged');
      expect(keywords).toContain('$draft');
      expect(keywords).toContain('$answered');
    });

    it('should map "from: me" to the user email address', async () => {
      const { buildJMAPFilter } = await import('../../utils/filterBuilder');

      const filter = buildJMAPFilter({ from: 'me' }, 'user@example.com');
      expect(filter.from).toBe('user@example.com');
    });

    it('should format date filters as ISO 8601 UTCDate strings (§4.4.1)', async () => {
      const { buildJMAPFilter } = await import('../../utils/filterBuilder');

      const after = new Date('2024-01-01T00:00:00Z');
      const before = new Date('2024-12-31T23:59:59Z');
      const filter = buildJMAPFilter({ after, before });

      // RFC 8621 §4.4.1: after and before are UTCDate (ISO 8601 format)
      expect(filter.after).toBe(after.toISOString());
      expect(filter.before).toBe(before.toISOString());
      // Verify they are valid dates
      expect(new Date(filter.after).toISOString()).toBe(filter.after);
      expect(new Date(filter.before).toISOString()).toBe(filter.before);
    });

    it('should wrap multiple hasKeyword conditions in allOf when isFlagged and isDraft both true', async () => {
      const { buildJMAPFilter } = await import('../../utils/filterBuilder');

      // RFC 8621 §4.4.1: hasKeyword is a single String, so multiple keyword
      // conditions need allOf wrapping per RFC 8620 §5.5
      const filter = buildJMAPFilter({ isFlagged: true, isDraft: true });

      expect(filter).toHaveProperty('allOf');
      const keywords = filter.allOf
        .filter((c: any) => c.hasKeyword)
        .map((c: any) => c.hasKeyword);
      expect(keywords).toContain('$flagged');
      expect(keywords).toContain('$draft');
    });

    it('should return empty object for empty filter', async () => {
      const { buildJMAPFilter } = await import('../../utils/filterBuilder');

      const filter = buildJMAPFilter({});
      expect(filter).toEqual({});
    });
  });

  // =========================================================================
  // Incremental Sync (Foo/changes — RFC 8620 §5.2)
  // =========================================================================
  describe('§5.2 — Foo/changes (Incremental Sync)', () => {
    it('Email/changes should use sinceState and maxChanges (§5.2)', async () => {
      const client = await authenticatedClient();

      // Simulate having a prior state
      const { stateManager } = await import('../stateManager');
      stateManager.setState('Email', 'state-old');

      mockJMAPResponse(['Email/changes', {
        accountId: 'account-001',
        oldState: 'state-old',
        newState: 'state-new',
        hasMoreChanges: false,
        created: ['e-new1'],
        updated: ['e-upd1'],
        destroyed: ['e-del1'],
      }, '0']);

      await client.request([
        ['Email/changes', {
          accountId: 'account-001',
          sinceState: 'state-old',
          maxChanges: 500,
        }, '0'],
      ]);

      const body = getRequestBody(fetchMock, 1);
      const mc = body.methodCalls[0];
      expect(mc[0]).toBe('Email/changes');
      // RFC 8620 §5.2: sinceState is required
      expect(mc[1].sinceState).toBe('state-old');
      // maxChanges is optional but recommended
      expect(mc[1].maxChanges).toBe(500);

      stateManager.clearAll();
    });
  });
});
