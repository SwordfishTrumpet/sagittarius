import { logger } from '../utils/logger';
import { eventSourceManager } from './eventSource';
import { webSocketManager } from './websocket';
import { stateManager } from './stateManager';
import { getCsrfToken, getCsrfHeaderName, clearCsrfToken, regenerateCsrfToken } from '../utils/csrf';
import type { QueryClient } from '@tanstack/react-query';
import type { JMAPMethodCall, JMAPAccount, JMAPSession } from '../types/jmap';
import type {
  BlobCapability,
  BlobCopyRequest,
  BlobCopyResponse,
  BlobLookupRequest,
  BlobLookupResponse,
  DataSourceObject,
  BlobUploadResponse,
  BlobGetRequest,
  BlobGetResponse,
  CreatedBlob,
} from '../types/jmap-blob';
import type { ContactsCapability } from '../types/jmap-contacts';
import type { CalendarsCapability } from '../types/jmap-calendar';

// Re-export JMAPSession from types for backward compatibility
export type { JMAPSession } from '../types/jmap';

export interface JMAPResponse {
  methodResponses: [string, unknown, string][];
  sessionState: string;
}

const configuredLoginDomain = import.meta.env.VITE_LOGIN_EMAIL_DOMAIN?.trim().replace(/^@+/, '');

function getDomainLabel(domain: string): string | null {
  const [label] = domain.split('.').map((part) => part.trim()).filter(Boolean);
  return label || null;
}

function buildAuthVariants(rawUsername: string): string[] {
  const username = rawUsername.trim();
  const variants: string[] = [];
  const seen = new Set<string>();
  const add = (value?: string | null) => {
    const variant = value?.trim();
    if (!variant || seen.has(variant)) return;
    seen.add(variant);
    variants.push(variant);
  };

  const atIndex = username.indexOf('@');
  const hasEmailDomain = atIndex > 0 && atIndex < username.length - 1;
  const localPart = hasEmailDomain ? username.slice(0, atIndex) : username;
  const emailDomain = hasEmailDomain ? username.slice(atIndex + 1) : null;
  const aliasDomain = configuredLoginDomain && (!emailDomain || emailDomain === configuredLoginDomain)
    ? configuredLoginDomain
    : null;
  const internalDomainLabel = aliasDomain ? getDomainLabel(aliasDomain) : null;

  // Try the user input first, then common email/local-part aliases, then
  // server-specific internal usernames derived from the mail domain.
  add(username);
  if (hasEmailDomain) {
    add(localPart);
  }
  if (!hasEmailDomain && configuredLoginDomain) {
    add(`${localPart}@${configuredLoginDomain}`);
  }
  if (internalDomainLabel) {
    add(`${localPart}-${internalDomainLabel}`);
  }

  return variants;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

class JMAPClient {
  private session: JMAPSession | null = null;
  private authHeader: string | null = null;
  private _queryClient: QueryClient | null = null;
  private _loggingOut = false;

  registerQueryClient(qc: QueryClient): void {
    this._queryClient = qc;
  }

  constructor() {
    this.authHeader = sessionStorage.getItem('jmap_auth');
    const storedSession = sessionStorage.getItem('jmap_session');
    if (storedSession) {
      this.session = this.rewriteSessionUrls(JSON.parse(storedSession));
    }
  }

  // Server may return absolute URLs (e.g. http://mail.example.com:8080/jmap/)
  // but the browser accesses the app via Vite proxy, so we need relative paths.
  private rewriteSessionUrls(session: JMAPSession): JMAPSession {
    const toRelative = (url: string) => {
      try {
        const parsed = new URL(url);
        // pathname and search both URL-encode {/} to %7B/%7D which breaks
        // JMAP template placeholders like {accountId}, {blobId}, {type}, etc.
        // Decode them back in the full relative URL.
        const path = parsed.pathname.replace(/%7B/gi, '{').replace(/%7D/gi, '}');
        const search = parsed.search.replace(/%7B/gi, '{').replace(/%7D/gi, '}');
        return path + search + parsed.hash;
      } catch {
        return url; // already relative or unparseable
      }
    };

    return {
      ...session,
      apiUrl: toRelative(session.apiUrl),
      downloadUrl: toRelative(session.downloadUrl),
      uploadUrl: toRelative(session.uploadUrl),
      ...(session.eventSourceUrl ? { eventSourceUrl: toRelative(session.eventSourceUrl) } : {}),
      ...(session.webSocketUrl ? { webSocketUrl: toRelative(session.webSocketUrl) } : {}),
    };
  }

  async authenticate(username: string, password: string): Promise<JMAPSession> {
    const variants = buildAuthVariants(username);

    let lastError: Error | null = null;
    const startTime = Date.now();

    for (const variant of variants) {
      // Encode to UTF-8 bytes first, then Base64 to handle non-ASCII passwords
      const credentials = btoa(unescape(encodeURIComponent(`${variant}:${password}`)));
      const authHeader = `Basic ${credentials}`;

      logger.debug(`[JMAP Auth Request] Trying username: variant`);
      const response = await fetch('/jmap/session', {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[JMAP Auth Error] HTTP ${response.status}`);
        logger.debug('[JMAP Auth Error] Response:', errorText);
        lastError = new Error('Authentication failed');
        continue; // try next variant
      }

      const session: JMAPSession = await response.json();
      logger.debug(`[JMAP Auth Success] Session:`, JSON.stringify(session, null, 2));
      logger.debug(`[JMAP Auth] primaryAccounts keys:`, Object.keys(session.primaryAccounts || {}));
      logger.debug(`[JMAP Auth] accounts keys:`, Object.keys(session.accounts || {}));

      // TEMP: Production diagnostic logging
      logger.error(`[JMAP Session Debug] accounts type: ${typeof session.accounts}, isArray: ${Array.isArray(session.accounts)}`);
      logger.error(`[JMAP Session Debug] accounts value: ${JSON.stringify(session.accounts)}`);
      logger.error(`[JMAP Session Debug] primaryAccounts value: ${JSON.stringify(session.primaryAccounts)}`);

      this.session = this.rewriteSessionUrls(session);
      this.authHeader = authHeader;

      sessionStorage.setItem('jmap_auth', authHeader);
      sessionStorage.setItem('jmap_session', JSON.stringify(session));

      // Regenerate CSRF token on successful authentication (VULN-006)
      regenerateCsrfToken();

      return session;
    }

    // VULN-009: Add artificial delay to ensure consistent timing regardless of failure path
    // This prevents timing attacks that could reveal whether a username exists
    const elapsed = Date.now() - startTime;
    const minDelay = 500; // Minimum 500ms to make all failure paths take similar time
    if (elapsed < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
    }

    throw lastError ?? new Error('Authentication failed');
  }

  getStoredSession(): JMAPSession | null {
    return this.session;
  }

  async request(methodCalls: JMAPMethodCall[], extraCapabilities?: string[], signal?: AbortSignal): Promise<JMAPResponse> {
    if (!this.session || !this.authHeader) {
      throw new Error('Not authenticated');
    }

    // Validate that all method calls have valid accountIds
    for (const call of methodCalls) {
      const tupleCall = call as [string, Record<string, unknown>, string];
      const params = tupleCall[1];
      if (!params || !params.accountId) {
        logger.error('[JMAP Error] Method call missing accountId:', tupleCall[0]);
        throw new Error(`JMAP ${tupleCall[0]} requires accountId`);
      }
    }

    const defaultCapabilities = [
      'urn:ietf:params:jmap:core',
      'urn:ietf:params:jmap:mail',
      'urn:ietf:params:jmap:submission',
    ];
    const using = extraCapabilities
      ? [...new Set([...defaultCapabilities, ...extraCapabilities])]
      : defaultCapabilities;

    const requestId = Math.random().toString(36).substring(7);
    const body = { using, methodCalls };
    
    logger.debug(`[JMAP Request ${requestId}]`, JSON.stringify(body, null, 2));

    // Create a timeout signal if no signal provided
    const timeoutController = signal ? null : new AbortController();
    const timeoutId = timeoutController ? setTimeout(() => timeoutController.abort(), DEFAULT_REQUEST_TIMEOUT_MS) : null;
    const effectiveSignal = signal || timeoutController?.signal;

    try {
      const response = await fetch(this.session.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
          [getCsrfHeaderName()]: getCsrfToken(), // CSRF protection (VULN-006)
        },
        body: JSON.stringify(body),
        signal: effectiveSignal,
      });

      if (response.status === 401) {
        logger.error(`[JMAP Error ${requestId}] 401 Unauthorized`);
        this.logout();
        throw new Error('Session expired');
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[JMAP Error ${requestId}] HTTP ${response.status}`);
        logger.error(`[JMAP Error ${requestId}] Request body:`, JSON.stringify(body, null, 2));
        logger.error(`[JMAP Error ${requestId}] Response:`, errorText.substring(0, 1000));
        throw new Error(`JMAP request failed: ${response.status}`);
      }

      const data = await response.json();
      logger.debug(`[JMAP Response ${requestId}]`, JSON.stringify(data, null, 2));
      return data;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  hasCapability(urn: string): boolean {
    return !!this.session?.capabilities?.[urn];
  }

  getCapabilityConfig(urn: string): unknown {
    return this.session?.capabilities?.[urn] || null;
  }

  getAccountCapability(urn: string): unknown {
    const accountId = this.getPrimaryAccount();
    if (!accountId || !this.session?.accounts?.[accountId]) return null;
    return this.session.accounts[accountId].accountCapabilities?.[urn] || null;
  }

  getEventSourceUrl(): string | null {
    return this.session?.eventSourceUrl || null;
  }

  getWebSocketUrl(): string | null {
    // Check both locations per RFC 8887:
    // 1. Root level `webSocketUrl` (some servers)
    // 2. Capability object `capabilities["urn:ietf:params:jmap:websocket"].url` (Stalwart, RFC 8887 §2)
    const rawUrl =
      this.session?.webSocketUrl ??
      (this.session?.capabilities?.['urn:ietf:params:jmap:websocket'] as { url?: string } | undefined)?.url;

    if (!rawUrl) return null;

    if (/^wss?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }

    try {
      const url = new URL(rawUrl, window.location.origin);
      url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return url.toString();
    } catch {
      return null;
    }
  }

  getAuthHeader(): string | null {
    return this.authHeader;
  }

  getSession(): JMAPSession | null {
    return this.session;
  }

  getBlobUrl(blobId: string, type: string, name: string): string {
    if (!this.session || !this.authHeader) return '';
    
    const accountId = this.getPrimaryAccount();
    
    return this.session.downloadUrl
      .replace('{accountId}', encodeURIComponent(accountId || ''))
      .replace('{blobId}', encodeURIComponent(blobId))
      .replace('{name}', encodeURIComponent(name))
      .replace('{type}', encodeURIComponent(type));
  }

  async uploadBlob(file: File): Promise<{ blobId: string; id: string; type: string; size: number }> {
    if (!this.session || !this.authHeader) throw new Error('No session');

    const accountId = this.getPrimaryAccount();
    if (!accountId) throw new Error('No primary account available');
    
    const url = this.session.uploadUrl.replace('{accountId}', encodeURIComponent(accountId));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  }

  logout() {
    // Guard against re-entrant calls (e.g. multiple 401s in parallel)
    if (this._loggingOut) return;
    this._loggingOut = true;

    // 1. Close push connections
    webSocketManager.disconnect();
    eventSourceManager.disconnect();
    // 2. Cancel in-flight TanStack Query requests, then clear cache
    this._queryClient?.cancelQueries();
    this._queryClient?.clear();
    // 3. Clear JMAP state cache
    stateManager.clearAll();
    // 4. Clear auth
    this.session = null;
    this.authHeader = null;
    sessionStorage.removeItem('jmap_auth');
    sessionStorage.removeItem('jmap_session');
    // 5. Clear CSRF token (VULN-006)
    clearCsrfToken();
    // 5. Redirect — use replace() to avoid caching post-logout state in browser history
    window.location.replace('/');
  }

  getPrimaryAccount(capability?: string): string | null {
    if (!this.session) return null;

    const cap = capability || 'urn:ietf:params:jmap:mail';

    // Try exact capability match in primaryAccounts first
    if (this.session.primaryAccounts?.[cap]) {
      return this.session.primaryAccounts[cap];
    }

    // Fallback: try any mail-related capability in primaryAccounts
    if (this.session.primaryAccounts) {
      for (const key of Object.keys(this.session.primaryAccounts)) {
        if (key.includes('mail')) {
          return this.session.primaryAccounts[key];
        }
      }

      // Try first available in primaryAccounts
      const primaryKeys = Object.keys(this.session.primaryAccounts);
      if (primaryKeys.length > 0) {
        return this.session.primaryAccounts[primaryKeys[0]];
      }
    }

    // Fallback: search session.accounts for an account with the required capability
    // This handles servers where primaryAccounts is empty but accounts is populated
    if (this.session.accounts) {
      for (const [accountId, account] of Object.entries(this.session.accounts)) {
        if (account.accountCapabilities?.[cap]) {
          logger.debug(`Found account ${accountId} via accountCapabilities fallback for ${cap}`);
          return accountId;
        }
      }

      // Try any mail-related capability in accounts
      for (const [accountId, account] of Object.entries(this.session.accounts)) {
        for (const capKey of Object.keys(account.accountCapabilities || {})) {
          if (capKey.includes('mail')) {
            logger.debug(`Found account ${accountId} via mail capability fallback: ${capKey}`);
            return accountId;
          }
        }
      }

      // Last resort: return first account if any exist
      const accountIds = Object.keys(this.session.accounts);
      if (accountIds.length > 0) {
        logger.debug(`Using first available account ${accountIds[0]} as fallback`);
        return accountIds[0];
      }
    }

    // Log clear error for debugging - returning null maintains backward compatibility
    logger.error(`No JMAP account found. Missing capability: ${cap}. Available capabilities: ${Object.keys(this.session.capabilities || {}).join(', ')}. Accounts: ${Object.keys(this.session.accounts || {}).join(', ')}`);
    return null;
  }

  // ============ RFC 9404 Blob Management Methods ============

  /**
   * Check if the server supports RFC 9404 Blob Management
   */
  hasBlobCapability(): boolean {
    return this.hasCapability('urn:ietf:params:jmap:blob');
  }

  /**
   * Get the blob capability configuration for the primary account
   */
  getBlobCapability(): BlobCapability | null {
    return this.getAccountCapability('urn:ietf:params:jmap:blob') as BlobCapability | null;
  }

  /**
   * Blob/copy - Copy blobs from one account to another per RFC 8620
   * Requires urn:ietf:params:jmap:core capability
   */
  async copyBlobs(fromAccountId: string, blobIds: string[], toAccountId?: string): Promise<BlobCopyResponse> {
    if (!this.session || !this.authHeader) {
      throw new Error('Not authenticated');
    }

    const targetAccountId = toAccountId ?? this.getPrimaryAccount();
    if (!targetAccountId) {
      throw new Error('No target account specified');
    }

    const request: BlobCopyRequest = {
      accountId: targetAccountId,
      fromAccountId,
      ids: blobIds,
    };

    const response = await this.request(
      [['Blob/copy', request, 'copyBlobs0']],
      ['urn:ietf:params:jmap:core']
    );

    const methodRes = response.methodResponses[0];
    if (!methodRes || methodRes[0] === 'error') {
      const error = methodRes?.[1] as { description?: string } | undefined;
      throw new Error(error?.description || 'Blob/copy failed');
    }

    return methodRes[1] as BlobCopyResponse;
  }

  /**
   * Blob/lookup - Find objects that reference specific blobs per RFC 9404
   * Requires urn:ietf:params:jmap:blob capability
   */
  async lookupBlobs(blobIds: string[], typeNames: string[], accountId?: string): Promise<BlobLookupResponse> {
    if (!this.hasBlobCapability()) {
      throw new Error('Server does not support RFC 9404 Blob Management');
    }

    const targetAccountId = accountId ?? this.getPrimaryAccount();
    if (!targetAccountId) {
      throw new Error('No account specified');
    }

    // Validate type names against supported types
    const blobCap = this.getBlobCapability();
    if (blobCap?.supportedTypeNames?.length) {
      const unsupportedTypes = typeNames.filter(t => !blobCap.supportedTypeNames.includes(t));
      if (unsupportedTypes.length > 0) {
        throw new Error(`Unsupported type names for Blob/lookup: ${unsupportedTypes.join(', ')}`);
      }
    }

    const request: BlobLookupRequest = {
      accountId: targetAccountId,
      typeNames,
      ids: blobIds,
    };

    const response = await this.request(
      [['Blob/lookup', request, 'lookupBlobs0']],
      ['urn:ietf:params:jmap:blob']
    );

    const methodRes = response.methodResponses[0];
    if (!methodRes || methodRes[0] === 'error') {
      const error = methodRes?.[1] as { description?: string; type?: string } | undefined;
      throw new Error(error?.description || error?.type || 'Blob/lookup failed');
    }

    return methodRes[1] as BlobLookupResponse;
  }

  /**
   * Blob/upload - Create blobs from data sources per RFC 9404
   * Requires urn:ietf:params:jmap:blob capability
   */
  async uploadBlobData(
    uploads: Record<string, { data: DataSourceObject[]; type?: string | null }>,
    accountId?: string
  ): Promise<BlobUploadResponse> {
    if (!this.hasBlobCapability()) {
      throw new Error('Server does not support RFC 9404 Blob Management');
    }

    const targetAccountId = accountId ?? this.getPrimaryAccount();
    if (!targetAccountId) {
      throw new Error('No account specified');
    }

    // Validate maxDataSources limit
    const blobCap = this.getBlobCapability();
    if (blobCap?.maxDataSources) {
      for (const [id, upload] of Object.entries(uploads)) {
        if (upload.data.length > blobCap.maxDataSources) {
          throw new Error(
            `Upload "${id}" exceeds maxDataSources limit (${blobCap.maxDataSources})`
          );
        }
      }
    }

    const response = await this.request(
      [['Blob/upload', { accountId: targetAccountId, create: uploads }, 'uploadBlobs0']],
      ['urn:ietf:params:jmap:blob']
    );

    const methodRes = response.methodResponses[0];
    if (!methodRes || methodRes[0] === 'error') {
      const error = methodRes?.[1] as { description?: string } | undefined;
      throw new Error(error?.description || 'Blob/upload failed');
    }

    return methodRes[1] as BlobUploadResponse;
  }

  /**
   * Blob/get - Fetch blob data per RFC 9404
   * Requires urn:ietf:params:jmap:blob capability
   */
  async getBlobData(
    blobIds: string[],
    options: {
      properties?: string[];
      offset?: number;
      length?: number;
      accountId?: string;
    } = {}
  ): Promise<BlobGetResponse> {
    if (!this.hasBlobCapability()) {
      throw new Error('Server does not support RFC 9404 Blob Management');
    }

    const targetAccountId = options.accountId ?? this.getPrimaryAccount();
    if (!targetAccountId) {
      throw new Error('No account specified');
    }

    const request: BlobGetRequest = {
      accountId: targetAccountId,
      ids: blobIds,
      ...(options.properties && { properties: options.properties }),
      ...(options.offset !== undefined && { offset: options.offset }),
      ...(options.length !== undefined && { length: options.length }),
    };

    const response = await this.request(
      [['Blob/get', request, 'getBlobs0']],
      ['urn:ietf:params:jmap:blob']
    );

    const methodRes = response.methodResponses[0];
    if (!methodRes || methodRes[0] === 'error') {
      const error = methodRes?.[1] as { description?: string } | undefined;
      throw new Error(error?.description || 'Blob/get failed');
    }

    return methodRes[1] as BlobGetResponse;
  }

  /**
   * Convenience method: Create a blob from text content
   * Uses Blob/upload with data:asText source
   */
  async createBlobFromText(
    content: string,
    type: string | null = null,
    accountId?: string
  ): Promise<CreatedBlob> {
    const result = await this.uploadBlobData(
      {
        blob: {
          data: [{ 'data:asText': content }],
          type,
        },
      },
      accountId
    );

    if (result.notCreated?.blob) {
      throw new Error(
        result.notCreated.blob.description || `Failed to create blob: ${result.notCreated.blob.type}`
      );
    }

    const created = result.created?.blob;
    if (!created) {
      throw new Error('Blob creation returned no result');
    }

    return created;
  }

  /**
   * Convenience method: Create a blob from base64 content
   * Uses Blob/upload with data:asBase64 source
   */
  async createBlobFromBase64(
    base64Content: string,
    type: string | null = null,
    accountId?: string
  ): Promise<CreatedBlob> {
    const result = await this.uploadBlobData(
      {
        blob: {
          data: [{ 'data:asBase64': base64Content }],
          type,
        },
      },
      accountId
    );

    if (result.notCreated?.blob) {
      throw new Error(
        result.notCreated.blob.description || `Failed to create blob: ${result.notCreated.blob.type}`
      );
    }

    const created = result.created?.blob;
    if (!created) {
      throw new Error('Blob creation returned no result');
    }

    return created;
  }

  // ============ RFC 9610 JMAP Contacts Methods ============

  /**
   * Check if the server supports RFC 9610 JMAP Contacts
   */
  hasContactsCapability(): boolean {
    return this.hasCapability('urn:ietf:params:jmap:contacts');
  }

  /**
   * Get the contacts capability configuration for the primary account
   */
  getContactsCapability(): ContactsCapability | null {
    return this.getAccountCapability('urn:ietf:params:jmap:contacts') as ContactsCapability | null;
  }

  // ============ RFC 8984 JSCalendar Methods ============

  /**
   * Check if the server supports RFC 8984 JSCalendar
   */
  hasCalendarCapability(): boolean {
    return this.hasCapability('urn:ietf:params:jmap:calendars');
  }

  /**
   * Check if the server supports RFC 8984 CalendarEvents
   */
  hasCalendarEventCapability(): boolean {
    return this.hasCapability('urn:ietf:params:jmap:calendarEvents');
  }

  /**
   * Get the calendar capability configuration for the primary account
   */
  getCalendarCapability(): CalendarsCapability | null {
    return this.getAccountCapability('urn:ietf:params:jmap:calendars') as CalendarsCapability | null;
  }
}

export const jmapClient = new JMAPClient();
