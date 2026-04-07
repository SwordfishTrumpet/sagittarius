/**
 * RFC 9404 Blob Management Extension Tests
 *
 * Tests the JMAP client's adherence to RFC 9404:
 * - Blob/copy: Copy blobs between accounts
 * - Blob/lookup: Find objects referencing blobs
 * - Blob/upload: Create blobs from data sources
 * - Blob/get: Fetch blob data with optional range
 * - Capability detection: urn:ietf:params:jmap:blob
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9404
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val; }),
  removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]); }),
  get length() { return Object.keys(mockSessionStorage).length; },
  key: vi.fn((i: number) => Object.keys(mockSessionStorage)[i] ?? null),
};

// A well-formed JMAP Session object with RFC 9404 blob capability
function makeSession(overrides: Record<string, any> = {}) {
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
      'urn:ietf:params:jmap:blob': {}, // RFC 9404 capability
    },
    accounts: {
      'account-001': {
        name: 'user@example.com',
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: {
          'urn:ietf:params:jmap:mail': {},
          'urn:ietf:params:jmap:submission': {},
          'urn:ietf:params:jmap:blob': {
            maxSizeBlobSet: 50000000,
            maxDataSources: 100,
            supportedTypeNames: ['Mailbox', 'Thread', 'Email'],
            supportedDigestAlgorithms: ['sha', 'sha-256', 'md5'],
          },
        },
      },
      'account-002': {
        name: 'shared@example.com',
        isPersonal: false,
        isReadOnly: true,
        accountCapabilities: {
          'urn:ietf:params:jmap:mail': {},
          'urn:ietf:params:jmap:blob': {
            maxSizeBlobSet: 10000000,
            maxDataSources: 64,
            supportedTypeNames: ['Email'],
            supportedDigestAlgorithms: ['sha-256'],
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
  };
}

describe('RFC 9404 — Blob Management Extension', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

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
    vi.unstubAllEnvs();
  });

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

  // =========================================================================
  // Section 3.1: Capability Detection
  // =========================================================================
  describe('§3.1 — Capability', () => {
    it('should detect blob capability availability', async () => {
      const client = await authenticatedClient();
      expect(client.hasBlobCapability()).toBe(true);
    });

    it('should return blob capability configuration for primary account', async () => {
      const client = await authenticatedClient();
      const cap = client.getBlobCapability();

      expect(cap).toBeDefined();
      expect(cap?.maxSizeBlobSet).toBe(50000000);
      expect(cap?.maxDataSources).toBe(100);
      expect(cap?.supportedTypeNames).toContain('Mailbox');
      expect(cap?.supportedTypeNames).toContain('Email');
      expect(cap?.supportedDigestAlgorithms).toContain('sha-256');
    });

    it('should return null when blob capability is not available', async () => {
      const session = makeSession({
        capabilities: {
          'urn:ietf:params:jmap:core': {},
          'urn:ietf:params:jmap:mail': {},
        },
        accounts: {
          'account-001': {
            name: 'user@example.com',
            isPersonal: true,
            accountCapabilities: {},
          },
        },
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');

      expect(jmapClient.hasBlobCapability()).toBe(false);
      expect(jmapClient.getBlobCapability()).toBeNull();
    });

    it('should handle null maxSizeBlobSet (unlimited)', async () => {
      const session = makeSession({
        accounts: {
          'account-001': {
            name: 'user@example.com',
            isPersonal: true,
            accountCapabilities: {
              'urn:ietf:params:jmap:blob': {
                maxSizeBlobSet: null,
                maxDataSources: 64,
                supportedTypeNames: ['Email'],
                supportedDigestAlgorithms: [],
              },
            },
          },
        },
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');

      const cap = jmapClient.getBlobCapability();
      expect(cap?.maxSizeBlobSet).toBeNull();
    });
  });

  // =========================================================================
  // Section 4.2: Blob/copy
  // =========================================================================
  describe('§4.2 — Blob/copy', () => {
    it('should copy blobs from one account to another', async () => {
      const client = await authenticatedClient();

      const copyResponse = {
        accountId: 'account-002',
        fromAccountId: 'account-001',
        copied: {
          'blob-1': { id: 'blob-new-1', size: 1024 },
          'blob-2': { id: 'blob-new-2', size: 2048 },
        },
        notCopied: {},
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/copy', copyResponse, 'copyBlobs0']], sessionState: 's1' }),
        text: async () => JSON.stringify({ methodResponses: [['Blob/copy', copyResponse, 'copyBlobs0']] }),
      });

      const result = await client.copyBlobs('account-001', ['blob-1', 'blob-2'], 'account-002');

      expect(result.accountId).toBe('account-002');
      expect(result.fromAccountId).toBe('account-001');
      expect(result.copied).toHaveProperty('blob-1');
      expect(result.copied?.['blob-1'].id).toBe('blob-new-1');
      expect(result.copied?.['blob-1'].size).toBe(1024);
    });

    it('should use primary account as default target for copy', async () => {
      const client = await authenticatedClient();

      const copyResponse = {
        accountId: 'account-001',
        fromAccountId: 'account-002',
        copied: { 'blob-1': { id: 'blob-new-1', size: 1024 } },
        notCopied: {},
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/copy', copyResponse, 'copyBlobs0']], sessionState: 's1' }),
      });

      const result = await client.copyBlobs('account-002', ['blob-1']);

      expect(result.accountId).toBe('account-001');
    });

    it('should handle partial copy failures', async () => {
      const client = await authenticatedClient();

      const copyResponse = {
        accountId: 'account-002',
        fromAccountId: 'account-001',
        copied: { 'blob-1': { id: 'blob-new-1', size: 1024 } },
        notCopied: {
          'blob-2': { type: 'notFound', description: 'Blob does not exist' },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/copy', copyResponse, 'copyBlobs0']], sessionState: 's1' }),
      });

      const result = await client.copyBlobs('account-001', ['blob-1', 'blob-2'], 'account-002');

      expect(result.copied).toHaveProperty('blob-1');
      expect(result.notCopied).toHaveProperty('blob-2');
      expect(result.notCopied?.['blob-2'].type).toBe('notFound');
    });

    it('should throw error when not authenticated', async () => {
      const { jmapClient } = await import('../jmap');

      await expect(
        jmapClient.copyBlobs('account-001', ['blob-1'])
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw error on method error response', async () => {
      const client = await authenticatedClient();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          methodResponses: [['error', { type: 'invalidArguments', description: 'Invalid blob IDs' }, 'copyBlobs0']],
          sessionState: 's1',
        }),
      });

      await expect(
        client.copyBlobs('account-001', ['invalid-blob'])
      ).rejects.toThrow('Invalid blob IDs');
    });

    it('should use urn:ietf:params:jmap:core capability for Blob/copy', async () => {
      const client = await authenticatedClient();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          methodResponses: [['Blob/copy', { accountId: 'account-001', fromAccountId: 'account-002', copied: {} }, 'copyBlobs0']],
          sessionState: 's1',
        }),
      });

      await client.copyBlobs('account-002', ['blob-1']);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.using).toContain('urn:ietf:params:jmap:core');
    });
  });

  // =========================================================================
  // Section 4.3: Blob/lookup
  // =========================================================================
  describe('§4.3 — Blob/lookup', () => {
    it('should find objects referencing specific blobs', async () => {
      const client = await authenticatedClient();

      const lookupResponse = {
        accountId: 'account-001',
        list: [
          {
            id: 'blob-123',
            matchedIds: {
              Email: ['email-1', 'email-2'],
              Thread: ['thread-1'],
            },
          },
        ],
        notFound: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/lookup', lookupResponse, 'lookupBlobs0']], sessionState: 's1' }),
      });

      const result = await client.lookupBlobs(['blob-123'], ['Email', 'Thread']);

      expect(result.list).toHaveLength(1);
      expect(result.list[0].id).toBe('blob-123');
      expect(result.list[0].matchedIds.Email).toContain('email-1');
      expect(result.list[0].matchedIds.Thread).toContain('thread-1');
    });

    it('should throw error if blob capability not available', async () => {
      const session = makeSession({
        capabilities: {
          'urn:ietf:params:jmap:core': {},
          'urn:ietf:params:jmap:mail': {},
        },
        accounts: {
          'account-001': {
            name: 'user@example.com',
            isPersonal: true,
            accountCapabilities: {},
          },
        },
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');

      await expect(
        jmapClient.lookupBlobs(['blob-1'], ['Email'])
      ).rejects.toThrow('Server does not support RFC 9404 Blob Management');
    });

    it('should validate type names against supported types', async () => {
      const client = await authenticatedClient();

      await expect(
        client.lookupBlobs(['blob-1'], ['UnknownType'])
      ).rejects.toThrow('Unsupported type names for Blob/lookup: UnknownType');
    });

    it('should return empty matchedIds for unknown blobs (privacy)', async () => {
      const client = await authenticatedClient();

      const lookupResponse = {
        accountId: 'account-001',
        list: [
          {
            id: 'not-a-blob',
            matchedIds: {
              Email: [],
              Thread: [],
              Mailbox: [],
            },
          },
        ],
        notFound: ['not-a-blob'],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/lookup', lookupResponse, 'lookupBlobs0']], sessionState: 's1' }),
      });

      const result = await client.lookupBlobs(['not-a-blob'], ['Email', 'Thread', 'Mailbox']);

      expect(result.list[0].matchedIds.Email).toHaveLength(0);
      expect(result.notFound).toContain('not-a-blob');
    });

    it('should validate type names against supported types', async () => {
      const client = await authenticatedClient();

      await expect(
        client.lookupBlobs(['blob-1'], ['UnknownType'])
      ).rejects.toThrow('Unsupported type names for Blob/lookup: UnknownType');
    });

    it('should use urn:ietf:params:jmap:blob capability for Blob/lookup', async () => {
      const client = await authenticatedClient();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          methodResponses: [['Blob/lookup', { accountId: 'account-001', list: [] }, 'lookupBlobs0']],
          sessionState: 's1',
        }),
      });

      await client.lookupBlobs(['blob-1'], ['Email']);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.using).toContain('urn:ietf:params:jmap:blob');
    });
  });

  // =========================================================================
  // Section 4.1: Blob/upload
  // =========================================================================
  describe('§4.1 — Blob/upload', () => {
    it('should create blobs from text data sources', async () => {
      const client = await authenticatedClient();

      const uploadResponse = {
        accountId: 'account-001',
        created: {
          'text-blob': {
            id: 'Gnewblob123',
            type: 'text/plain',
            size: 45,
          },
        },
        notCreated: {},
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/upload', uploadResponse, 'uploadBlobs0']], sessionState: 's1' }),
      });

      const result = await client.uploadBlobData({
        'text-blob': {
          data: [{ 'data:asText': 'The quick brown fox jumped over the lazy dog.' }],
          type: 'text/plain',
        },
      });

      expect(result.created).toHaveProperty('text-blob');
      expect(result.created?.['text-blob'].id).toBe('Gnewblob123');
      expect(result.created?.['text-blob'].size).toBe(45);
    });

    it('should create blobs from base64 data sources', async () => {
      const client = await authenticatedClient();

      const uploadResponse = {
        accountId: 'account-001',
        created: {
          'image-blob': {
            id: 'Gimageblob456',
            type: 'image/png',
            size: 95,
          },
        },
        notCreated: {},
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/upload', uploadResponse, 'uploadBlobs0']], sessionState: 's1' }),
      });

      const result = await client.uploadBlobData({
        'image-blob': {
          data: [{ 'data:asBase64': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }],
          type: 'image/png',
        },
      });

      expect(result.created?.['image-blob'].type).toBe('image/png');
    });

    it('should concatenate multiple data sources', async () => {
      const client = await authenticatedClient();

      const uploadResponse = {
        accountId: 'account-001',
        created: {
          'combined': {
            id: 'Gcombined789',
            type: 'text/plain',
            size: 19,
          },
        },
        notCreated: {},
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/upload', uploadResponse, 'uploadBlobs0']], sessionState: 's1' }),
      });

      // This mimics the RFC 9404 example: "How" + " quick" + "was t" + "h" + "at?"
      const result = await client.uploadBlobData({
        'combined': {
          data: [
            { 'data:asText': 'How' },
            { 'data:asText': ' quick' },
            { 'data:asText': 'was t' },
            { 'data:asText': 'h' },
            { 'data:asText': 'at?' },
          ],
        },
      });

      expect(result.created?.['combined'].size).toBe(19);
    });

    it('should create blobs from other blob sources with offset/length', async () => {
      const client = await authenticatedClient();

      const uploadResponse = {
        accountId: 'account-001',
        created: {
          'sliced': {
            id: 'Gsliced012',
            type: null,
            size: 5,
          },
        },
        notCreated: {},
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/upload', uploadResponse, 'uploadBlobs0']], sessionState: 's1' }),
      });

      const result = await client.uploadBlobData({
        'sliced': {
          data: [
            { blobId: 'source-blob', offset: 10, length: 5 },
          ],
        },
      });

      expect(result.created?.['sliced'].size).toBe(5);
    });

    it('should validate maxDataSources limit', async () => {
      const client = await authenticatedClient();

      const tooManySources = Array(101).fill({ 'data:asText': 'x' });

      await expect(
        client.uploadBlobData({
          'too-many': { data: tooManySources },
        })
      ).rejects.toThrow('exceeds maxDataSources limit');
    });

    it('should handle notCreated errors', async () => {
      const client = await authenticatedClient();

      const uploadResponse = {
        accountId: 'account-001',
        created: {},
        notCreated: {
          'bad-blob': { type: 'invalidBase64', description: 'Invalid base64 encoding' },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/upload', uploadResponse, 'uploadBlobs0']], sessionState: 's1' }),
      });

      const result = await client.uploadBlobData({
        'bad-blob': { data: [{ 'data:asBase64': '!!!invalid!!!' }] },
      });

      expect(result.notCreated).toHaveProperty('bad-blob');
      expect(result.notCreated?.['bad-blob'].type).toBe('invalidBase64');
    });

    it('should use urn:ietf:params:jmap:blob capability', async () => {
      const client = await authenticatedClient();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          methodResponses: [['Blob/upload', { accountId: 'account-001', created: {} }, 'uploadBlobs0']],
          sessionState: 's1',
        }),
      });

      await client.uploadBlobData({ 'test': { data: [{ 'data:asText': 'test' }] } });

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.using).toContain('urn:ietf:params:jmap:blob');
    });
  });

  // =========================================================================
  // Section 4.2: Blob/get
  // =========================================================================
  describe('§4.2 — Blob/get', () => {
    it('should fetch blob size only', async () => {
      const client = await authenticatedClient();

      const getResponse = {
        accountId: 'account-001',
        list: [
          { id: 'blob-123', size: 1024 },
        ],
        notFound: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/get', getResponse, 'getBlobs0']], sessionState: 's1' }),
      });

      const result = await client.getBlobData(['blob-123'], { properties: ['size'] });

      expect(result.list[0].size).toBe(1024);
    });

    it('should fetch blob data as text', async () => {
      const client = await authenticatedClient();

      const getResponse = {
        accountId: 'account-001',
        list: [
          { id: 'blob-123', size: 45, 'data:asText': 'The quick brown fox jumped over the lazy dog.' },
        ],
        notFound: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/get', getResponse, 'getBlobs0']], sessionState: 's1' }),
      });

      const result = await client.getBlobData(['blob-123'], { properties: ['data:asText', 'size'] });

      expect(result.list[0]['data:asText']).toBe('The quick brown fox jumped over the lazy dog.');
    });

    it('should fetch blob data with offset and length', async () => {
      const client = await authenticatedClient();

      const getResponse = {
        accountId: 'account-001',
        list: [
          { id: 'blob-123', size: 45, 'data:asText': 'quick bro' },
        ],
        notFound: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/get', getResponse, 'getBlobs0']], sessionState: 's1' }),
      });

      const result = await client.getBlobData(['blob-123'], {
        properties: ['data:asText', 'size'],
        offset: 4,
        length: 9,
      });

      expect(result.list[0]['data:asText']).toBe('quick bro');
      expect(result.list[0].size).toBe(45); // Size is always full blob size
    });

    it('should handle isEncodingProblem for non-UTF-8 data', async () => {
      const client = await authenticatedClient();

      const getResponse = {
        accountId: 'account-001',
        list: [
          {
            id: 'blob-123',
            size: 43,
            'data:asText': null,
            'data:asBase64': 'VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wZWQgb3ZlciB0aGUggYEgZG9nLg==',
            isEncodingProblem: true,
          },
        ],
        notFound: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/get', getResponse, 'getBlobs0']], sessionState: 's1' }),
      });

      const result = await client.getBlobData(['blob-123'], { properties: ['data:asText', 'size'] });

      expect(result.list[0].isEncodingProblem).toBe(true);
      expect(result.list[0]['data:asText']).toBeNull();
    });

    it('should handle isTruncated for out-of-range requests', async () => {
      const client = await authenticatedClient();

      const getResponse = {
        accountId: 'account-001',
        list: [
          {
            id: 'blob-123',
            size: 11,
            'data:asText': '',
            isTruncated: true,
          },
        ],
        notFound: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/get', getResponse, 'getBlobs0']], sessionState: 's1' }),
      });

      const result = await client.getBlobData(['blob-123'], {
        properties: ['data:asText', 'size'],
        offset: 20,
        length: 100,
      });

      expect(result.list[0].isTruncated).toBe(true);
    });

    it('should fetch digest values', async () => {
      const client = await authenticatedClient();

      const getResponse = {
        accountId: 'account-001',
        list: [
          {
            id: 'blob-123',
            size: 45,
            'digest:sha': 'wIVPufsDxBzOOALLDSIFKebu+U4=',
            'digest:sha-256': 'gdg9INW7lwHK6OQ9u0dwDz2ZY/gubi0En0xlFpKt0OA=',
          },
        ],
        notFound: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/get', getResponse, 'getBlobs0']], sessionState: 's1' }),
      });

      const result = await client.getBlobData(['blob-123'], {
        properties: ['size', 'digest:sha', 'digest:sha-256'],
      });

      expect(result.list[0]['digest:sha']).toBe('wIVPufsDxBzOOALLDSIFKebu+U4=');
      expect(result.list[0]['digest:sha-256']).toBe('gdg9INW7lwHK6OQ9u0dwDz2ZY/gubi0En0xlFpKt0OA=');
    });

    it('should use urn:ietf:params:jmap:blob capability', async () => {
      const client = await authenticatedClient();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          methodResponses: [['Blob/get', { accountId: 'account-001', list: [] }, 'getBlobs0']],
          sessionState: 's1',
        }),
      });

      await client.getBlobData(['blob-1']);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.using).toContain('urn:ietf:params:jmap:blob');
    });
  });

  // =========================================================================
  // Convenience Methods
  // =========================================================================
  describe('Convenience Methods', () => {
    it('createBlobFromText should wrap Blob/upload', async () => {
      const client = await authenticatedClient();

      const uploadResponse = {
        accountId: 'account-001',
        created: {
          blob: { id: 'Gtextblob', type: 'text/plain', size: 11 },
        },
        notCreated: {},
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/upload', uploadResponse, 'uploadBlobs0']], sessionState: 's1' }),
      });

      const result = await client.createBlobFromText('hello world', 'text/plain');

      expect(result.id).toBe('Gtextblob');
      expect(result.type).toBe('text/plain');
      expect(result.size).toBe(11);
    });

    it('createBlobFromBase64 should wrap Blob/upload', async () => {
      const client = await authenticatedClient();

      const uploadResponse = {
        accountId: 'account-001',
        created: {
          blob: { id: 'Gbase64blob', type: 'image/png', size: 1024 },
        },
        notCreated: {},
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/upload', uploadResponse, 'uploadBlobs0']], sessionState: 's1' }),
      });

      const result = await client.createBlobFromBase64('aGVsbG8gd29ybGQ=', 'image/png');

      expect(result.id).toBe('Gbase64blob');
    });

    it('createBlobFromText should throw on notCreated', async () => {
      const client = await authenticatedClient();

      const uploadResponse = {
        accountId: 'account-001',
        created: {},
        notCreated: {
          blob: { type: 'invalidArguments', description: 'Invalid type' },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ methodResponses: [['Blob/upload', uploadResponse, 'uploadBlobs0']], sessionState: 's1' }),
      });

      await expect(
        client.createBlobFromText('hello', 'invalid/type')
      ).rejects.toThrow('Invalid type');
    });
  });
});
