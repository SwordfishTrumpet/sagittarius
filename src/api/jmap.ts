import { logger, redactUrl } from '../utils/logger';
import { eventSourceManager } from './eventSource';
import { webSocketManager } from './websocket';
import { stateManager } from './stateManager';
import { getCsrfToken, getCsrfHeaderName, clearCsrfToken, regenerateCsrfToken } from '../utils/csrf';
import { AuthError, ServerUnreachableError, JMAPProtocolError } from '../utils/jmapErrors';
import { markServerReachable, markServerUnreachable } from '../utils/serverReachability';
import {
  fetchServerFingerprint,
  getStoredFingerprint,
  storeFingerprint,
  fingerprintKey,
  ServerIdentityChangedError,
  type ServerFingerprint,
} from '../utils/serverFingerprint';
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
import type { SharingCapability, PrincipalGetResponse, PrincipalQueryResponse } from '../types/jmap-sharing';
import type {
  PushSubscription,
  PushSubscriptionGetResponse,
  PushSubscriptionSetResponse,
} from '../types/jmap-webpush';
import type { EmailParseSmimeResponse } from '../types/jmap';

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

/**
 * Combine multiple AbortSignals into one. The resulting signal aborts when
 * ANY of the inputs aborts. Falls back to manual forwarding when the native
 * AbortSignal.any (baseline 2024) is unavailable (e.g. older jsdom).
 */
function combineSignals(...signals: Array<AbortSignal | null | undefined>): AbortSignal | null {
  const valid = signals.filter((s): s is AbortSignal => Boolean(s));
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];
  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
    return AbortSignal.any(valid);
  }
  const controller = new AbortController();
  for (const s of valid) {
    if (s.aborted) {
      controller.abort();
      break;
    }
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

type FilterLike = Record<string, unknown>;

export interface AuthenticateOptions {
  /**
   * Allow signing in even though the stored server fingerprint differs from
   * the current one (issue #1). Only set after explicit user confirmation.
   */
  confirmIdentityChange?: boolean;
}

class JMAPClient {
  private session: JMAPSession | null = null;
  private authHeader: string | null = null;
  private _queryClient: QueryClient | null = null;
  private _loggingOut = false;
  /** Active account selected by AccountProvider; null when not set. */
  private _activeAccountId: string | null = null;
  /**
   * Server-identity gate (issue #1): true once the backend fingerprint has
   * been verified for this page load. Credential-bearing requests block on
   * `ensureIdentityVerified()` until the check completes so a changed backend
   * identity can never receive credentials.
   */
  private _identityVerified = false;
  /** Shared in-flight identity check (replay-lock pattern). */
  private _identityCheckPromise: Promise<unknown> | null = null;

  registerQueryClient(qc: QueryClient): void {
    this._queryClient = qc;
  }

  /** Set the account that JMAP hooks should target (AccountProvider). */
  setActiveAccountId(accountId: string | null): void {
    this._activeAccountId = accountId;
  }

  getActiveAccountId(): string | null {
    return this._activeAccountId;
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

  async authenticate(username: string, password: string, options: AuthenticateOptions = {}): Promise<JMAPSession> {
    // ── Server identity gate (issue #1) ──────────────────────────────
    // Fetch the backend fingerprint BEFORE sending credentials so that a
    // changed backend identity never receives the Basic-auth header until
    // the user explicitly confirms the change. The fetched fingerprint is
    // reused to pin the identity on success (first-login TOFU pinning).
    const currentFingerprint = await fetchServerFingerprint();
    if (currentFingerprint) {
      if (!currentFingerprint.resolved) {
        throw new ServerUnreachableError(
          'Mail server unreachable — the configured backend host cannot be resolved.',
        );
      }

      const stored = getStoredFingerprint();
      const storedKey = fingerprintKey(stored);
      const currentKey = fingerprintKey(currentFingerprint);
      if (currentKey === null) {
        // Cannot compute a comparable identity (e.g. https backend whose TLS
        // handshake failed). Fail closed: never send credentials to a server
        // whose identity cannot be verified.
        throw new ServerUnreachableError(
          'Mail server unreachable — the server identity could not be verified.',
        );
      }
      if (!options.confirmIdentityChange && !currentFingerprint.trusted && storedKey && storedKey !== currentKey) {
        throw new ServerIdentityChangedError(stored, currentFingerprint);
      }
    } else {
      // Endpoint unavailable (old server / blocked path): degrade without
      // the pinning guarantee. fetchServerFingerprint() logged a warning.
      logger.warn('[JMAP Auth] Server-identity endpoint unavailable — proceeding WITHOUT identity pinning.');
    }

    const variants = buildAuthVariants(username);

    let lastError: Error | null = null;
    let unreachableSeen = false;
    const startTime = Date.now();

    for (const variant of variants) {
      // Encode to UTF-8 bytes first, then Base64 to handle non-ASCII passwords
      const credentials = btoa(unescape(encodeURIComponent(`${variant}:${password}`)));
      const authHeader = `Basic ${credentials}`;

      logger.debug(`[JMAP Auth Request] Trying username: ${variant}`);
      let response: Response;
      try {
        response = await fetch('/jmap/session', {
          // Prevent browser from showing native auth dialog on 401 (§3.6.1)
          // We handle authentication entirely through our own login UI
          credentials: 'omit',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
          },
        });
      } catch (err) {
        // fetch-level failure: browser offline, proxy unreachable, DNS dead.
        logger.error('[JMAP Auth Error] Network failure:', err instanceof Error ? err.message : String(err));
        lastError = new ServerUnreachableError('Server unreachable');
        unreachableSeen = true;
        continue; // try next variant (harmless — same endpoint)
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[JMAP Auth Error] HTTP ${response.status}`);
        logger.debug('[JMAP Auth Error] Response:', errorText);
        if (response.status === 401 || response.status === 403) {
          lastError = new AuthError('Authentication failed');
        } else if (response.status >= 502 && response.status <= 504) {
          lastError = new ServerUnreachableError(`Server unreachable (HTTP ${response.status})`);
          unreachableSeen = true;
        } else {
          lastError = new JMAPProtocolError(`JMAP request failed: ${response.status}`, response.status);
        }
        continue; // try next variant
      }

      const session: JMAPSession = await response.json();
      logger.debug(`[JMAP Auth Success] Session:`, JSON.stringify(session, null, 2));
      logger.debug(`[JMAP Auth] primaryAccounts keys:`, Object.keys(session.primaryAccounts || {}));
      logger.debug(`[JMAP Auth] accounts keys:`, Object.keys(session.accounts || {}));

      // Diagnostics: account/session shape is sensitive, so these must be
      // logger.debug (dev-only) and NEVER logger.error (production-visible).
      logger.debug(`[JMAP Session Debug] accounts type: ${typeof session.accounts}, isArray: ${Array.isArray(session.accounts)}`);
      logger.debug(`[JMAP Session Debug] accounts keys:`, Object.keys(session.accounts || {}));
      logger.debug(`[JMAP Session Debug] primaryAccounts keys:`, Object.keys(session.primaryAccounts || {}));

      this.session = this.rewriteSessionUrls(session);
      this.authHeader = authHeader;

      sessionStorage.setItem('jmap_auth', authHeader);
      sessionStorage.setItem('jmap_session', JSON.stringify(session));

      // Pin the verified identity to the session (issue #1).
      if (currentFingerprint) {
        storeFingerprint(currentFingerprint);
      }
      this._identityVerified = true;

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

    // A dead backend is more informative than a wrong password: surface
    // server-unreachable even when an auth failure was also seen.
    if (unreachableSeen && lastError) {
      throw lastError;
    }
    throw lastError ?? new AuthError('Authentication failed');
  }

  /**
   * Invalidate the stored session because the backend identity changed.
   * Clears auth/session/csrf state, stops push connections and cancels
   * in-flight queries. Does NOT redirect (App decides the UI) and does NOT
   * clear the stored fingerprint — the next login must confirm the change
   * before credentials are transmitted again.
   */
  clearSessionForIdentityChange(): void {
    // Stop push connections: their URLs/headers also carry credentials and
    // would be forwarded to the changed (potentially attacker-controlled)
    // endpoint on reconnect.
    webSocketManager.disconnect();
    eventSourceManager.disconnect();
    this._queryClient?.cancelQueries();
    this._queryClient?.clear();
    this.session = null;
    this.authHeader = null;
    sessionStorage.removeItem('jmap_auth');
    sessionStorage.removeItem('jmap_session');
    clearCsrfToken();
  }

  /**
   * Verify the backend identity against the stored fingerprint.
   *
   * Returns:
   *  - `'verified'`         — fingerprint matches (or no stored fingerprint /
   *                           nothing to compare, so proceed — the
   *                           fingerprint is (re)established at the next
   *                           successful login).
   *  - `'identity-changed'` — the fingerprint differs; the session was
   *                           cleared and no further requests may carry
   *                           credentials until the user confirms.
   *  - `'unreachable'`      — the backend hostname no longer resolves: the
   *                           configured mail server is genuinely gone.
   *  - `'endpoint-unavailable'` — the fingerprint endpoint itself is
   *                           unavailable or malformed (old server paired
   *                           with a new client). Fail open: there is
   *                           nothing to compare, and the endpoint ships
   *                           with every supported server configuration.
   */
  async verifyServerIdentity(): Promise<'verified' | 'identity-changed' | 'unreachable' | 'endpoint-unavailable'> {
    if (!this.session || !this.authHeader) {
      // Nothing to protect — no credentials exist.
      this._identityVerified = true;
      return 'verified';
    }

    const stored = getStoredFingerprint();
    if (!stored) {
      // No prior identity to compare against (legacy session or storage was
      // cleared): cannot detect a change, and there is nothing to protect
      // against — the pin is (re)established at the next successful login.
      this._identityVerified = true;
      return 'verified';
    }

    const current = await fetchServerFingerprint();
    if (!current) {
      // Endpoint unavailable or malformed (e.g. an older server paired with
      // this client). Degrade without the pinning guarantee: credentials are
      // only forwarded to a host the proxy can reach, and the endpoint ships
      // with every supported server configuration. Distinct from
      // 'unreachable' so the UI can fail open here (issue #6) instead of
      // blocking on a server that simply lacks the endpoint.
      this._identityVerified = true;
      return 'endpoint-unavailable';
    }

    if (!current.resolved) {
      // Backend hostname no longer resolves: cannot verify, but also cannot
      // forward credentials anywhere. Fail open; requests will fail with
      // ServerUnreachableError rather than leak credentials.
      this._identityVerified = true;
      return 'unreachable';
    }

    if (current.trusted) {
      // Operator allowlist match — always acceptable.
      this._identityVerified = true;
      return 'verified';
    }

    const storedKey = fingerprintKey(stored);
    const currentKey = fingerprintKey(current);
    if (storedKey && currentKey && storedKey !== currentKey) {
      // Identity changed: refuse to transmit credentials to the new endpoint.
      this.clearSessionForIdentityChange();
      this._identityVerified = false;
      return 'identity-changed';
    }

    this._identityVerified = true;
    return 'verified';
  }

  /**
   * Wait until the server identity has been verified (or it is safe to
   * proceed). Called by `request()` before any credential-bearing fetch so
   * a changed backend identity cannot receive credentials.
   */
  private ensureIdentityVerified(): Promise<unknown> {
    if (this._identityVerified) return Promise.resolve();
    if (!this._identityCheckPromise) {
      this._identityCheckPromise = this.verifyServerIdentity().then(() => undefined).finally(() => {
        this._identityCheckPromise = null;
      });
    }
    return this._identityCheckPromise;
  }

  getStoredSession(): JMAPSession | null {
    return this.session;
  }

  async request(methodCalls: JMAPMethodCall[], extraCapabilities?: string[], signal?: AbortSignal): Promise<JMAPResponse> {
    if (!this.session || !this.authHeader) {
      throw new Error('Not authenticated');
    }

    // Server-identity gate (issue #1): never transmit credentials until the
    // backend identity has been verified for this page load. If the check
    // cleared the session (identity changed), refuse the request.
    await this.ensureIdentityVerified();
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

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
    // Always apply the default timeout, even when the caller passed an
    // external signal: combine them so the request cannot hang forever.
    const effectiveSignal = combineSignals(signal, timeoutController.signal);

    try {
      let response: Response;
      try {
        response = await fetch(this.session.apiUrl, {
          method: 'POST',
          // Prevent browser from showing native auth dialog on 401
          credentials: 'omit',
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json',
            [getCsrfHeaderName()]: getCsrfToken(), // CSRF protection (VULN-006)
          },
          body: JSON.stringify(body),
          signal: effectiveSignal,
        });
      } catch (err) {
        // fetch-level failure: proxy unreachable, DNS dead, browser offline.
        logger.error(`[JMAP Error ${requestId}] Network failure:`, err instanceof Error ? err.message : String(err));
        markServerUnreachable();
        throw new ServerUnreachableError('Server unreachable');
      }

      if (response.status === 401) {
        logger.error(`[JMAP Error ${requestId}] 401 Unauthorized`);
        this.logout();
        throw new AuthError('Session expired');
      }

      if (response.status === 403) {
        logger.error(`[JMAP Error ${requestId}] 403 Forbidden`);
        this.logout();
        throw new AuthError('Access denied');
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[JMAP Error ${requestId}] HTTP ${response.status}`);
        logger.error(`[JMAP Error ${requestId}] Request body:`, JSON.stringify(body, null, 2));
        logger.error(`[JMAP Error ${requestId}] Response:`, errorText.substring(0, 1000));
        if (response.status >= 502 && response.status <= 504) {
          markServerUnreachable();
          throw new ServerUnreachableError(`Server unreachable (HTTP ${response.status})`);
        }
        throw new JMAPProtocolError(`JMAP request failed: ${response.status}`, response.status);
      }

      const data = await response.json();
      logger.debug(`[JMAP Response ${requestId}]`, JSON.stringify(data, null, 2));
      markServerReachable();
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
    if (!accountId) {
      // An empty {accountId} would produce an invalid download URL.
      logger.error('[getBlobUrl] No account ID available; returning empty URL.');
      return '';
    }

    return this.session.downloadUrl
      .replace('{accountId}', encodeURIComponent(accountId))
      .replace('{blobId}', encodeURIComponent(blobId))
      .replace('{name}', encodeURIComponent(name))
      .replace('{type}', encodeURIComponent(type));
  }

  async uploadBlob(file: File): Promise<{ blobId: string; id: string; type: string; size: number }> {
    if (!this.session || !this.authHeader) {
      logger.error('[uploadBlob] No session or auth header available');
      throw new Error('No session');
    }

    const accountId = this.getPrimaryAccount();
    if (!accountId) {
      logger.error('[uploadBlob] No account ID found. Session state:', {
        hasSession: !!this.session,
        primaryAccounts: this.session?.primaryAccounts,
        accounts: this.session?.accounts,
        accountKeys: this.session?.accounts ? Object.keys(this.session.accounts) : null,
      });
      throw new Error('No primary account available');
    }
    
    const url = this.session.uploadUrl.replace('{accountId}', encodeURIComponent(accountId));
    logger.debug('[uploadBlob] Uploading to:', redactUrl(url), 'file:', file.name, 'size:', file.size);

    // Note: CSRF token is NOT included here because blob upload uses raw file upload
    // with Content-Type: file.type, and the JMAP backend only expects Authorization header.
    // The Basic Auth header provides sufficient protection for this endpoint.
    const response = await fetch(url, {
      method: 'POST',
      // Prevent browser from showing native auth dialog on 401
      credentials: 'omit',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[JMAP Blob Upload Error]', {
        status: response.status,
        statusText: response.statusText,
        url: redactUrl(url),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        errorBody: errorText.substring(0, 1000),
      });
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
    logger.debug('[uploadBlob] Success:', file.name, '→ blobId:', (await response.clone().json()).blobId);
    return response.json();
  }

  logout() {
    // Guard against re-entrant calls (e.g. multiple 401s in parallel)
    if (this._loggingOut) return;
    this._loggingOut = true;

    this.clearSessionLocally();

    // 6. Redirect — use replace() to avoid caching post-logout state in browser history
    window.location.replace('/');
  }

  /**
   * Clear the authenticated session without navigating (issue #6). Used by
   * the "Mail server unreachable" full-screen state's Sign Out action, where
   * a page reload is neither needed nor safe (the backend is down; the app
   * should just drop to the login screen). Safe to call repeatedly.
   */
  clearSessionLocally() {
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
    // Cleanup is complete — reset the latch so a failed/blocked navigation
    // (embedded webview, beforeunload handler, tests) can retry logout
    // instead of silently no-oping forever (BUG-2026-058).
    this._loggingOut = false;
  }

  getPrimaryAccount(capability?: string): string | null {
    if (!this.session) return null;

    const cap = capability || 'urn:ietf:params:jmap:mail';

    // The account selected by AccountProvider wins — this makes every
    // existing jmapClient.getPrimaryAccount() call site account-aware.
    if (this._activeAccountId && this.session.accounts?.[this._activeAccountId]) {
      return this._activeAccountId;
    }

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

  // ============ draft-ietf-jmap-calendars-26 Calendars Methods ============

  /**
   * Check if the server supports draft-ietf-jmap-calendars-26 Calendars
   */
  hasCalendarCapability(): boolean {
    return this.hasCapability('urn:ietf:params:jmap:calendars');
  }

  /**
   * Get the calendar capability configuration for the primary account
   */
  getCalendarCapability(): CalendarsCapability | null {
    return this.getAccountCapability('urn:ietf:params:jmap:calendars') as CalendarsCapability | null;
  }

  // ============ RFC 9670 JMAP Sharing Methods ============

  hasSharingCapability(): boolean {
    return this.hasCapability('urn:ietf:params:jmap:sharing');
  }

  getSharingCapability(): SharingCapability | null {
    return this.getAccountCapability('urn:ietf:params:jmap:sharing') as SharingCapability | null;
  }

  async getPrincipals(ids: string[] | null, accountId?: string): Promise<PrincipalGetResponse> {
    const targetAccountId = accountId ?? this.getPrimaryAccount();
    if (!targetAccountId) throw new Error('No account specified');

    const response = await this.request(
      [['Principal/get', { accountId: targetAccountId, ids }, 'principalGet0']],
      ['urn:ietf:params:jmap:sharing']
    );

    const methodRes = response.methodResponses[0];
    if (!methodRes || methodRes[0] === 'error') {
      const error = methodRes?.[1] as { description?: string } | undefined;
      throw new Error(error?.description || 'Principal/get failed');
    }

    return methodRes[1] as PrincipalGetResponse;
  }

  async queryPrincipals(filter?: { text?: string; email?: string; type?: string }, accountId?: string): Promise<PrincipalQueryResponse> {
    const targetAccountId = accountId ?? this.getPrimaryAccount();
    if (!targetAccountId) throw new Error('No account specified');

    const response = await this.request(
      [['Principal/query', { accountId: targetAccountId, filter }, 'principalQuery0']],
      ['urn:ietf:params:jmap:sharing']
    );

    const methodRes = response.methodResponses[0];
    if (!methodRes || methodRes[0] === 'error') {
      const error = methodRes?.[1] as { description?: string } | undefined;
      throw new Error(error?.description || 'Principal/query failed');
    }

    return methodRes[1] as PrincipalQueryResponse;
  }

  // ============ RFC 9749 JMAP WebPush Methods ============

  hasWebPushCapability(): boolean {
    return this.hasCapability('urn:ietf:params:jmap:webpush');
  }

  async getPushSubscriptions(ids: string[] | null, accountId?: string): Promise<PushSubscriptionGetResponse> {
    const targetAccountId = accountId ?? this.getPrimaryAccount();
    if (!targetAccountId) throw new Error('No account specified');

    const response = await this.request(
      [['PushSubscription/get', { accountId: targetAccountId, ids }, 'pushSubGet0']],
      ['urn:ietf:params:jmap:webpush']
    );

    const methodRes = response.methodResponses[0];
    if (!methodRes || methodRes[0] === 'error') {
      const error = methodRes?.[1] as { description?: string } | undefined;
      throw new Error(error?.description || 'PushSubscription/get failed');
    }

    return methodRes[1] as PushSubscriptionGetResponse;
  }

  async createPushSubscription(
    subscription: Omit<PushSubscription, 'id'>,
    accountId?: string
  ): Promise<PushSubscriptionSetResponse> {
    const targetAccountId = accountId ?? this.getPrimaryAccount();
    if (!targetAccountId) throw new Error('No account specified');

    const response = await this.request(
      [['PushSubscription/set', { accountId: targetAccountId, create: { 'new-1': subscription } }, 'pushSubSet0']],
      ['urn:ietf:params:jmap:webpush']
    );

    const methodRes = response.methodResponses[0];
    if (!methodRes || methodRes[0] === 'error') {
      const error = methodRes?.[1] as { description?: string } | undefined;
      throw new Error(error?.description || 'PushSubscription/set failed');
    }

    return methodRes[1] as PushSubscriptionSetResponse;
  }

  async destroyPushSubscriptions(ids: string[], accountId?: string): Promise<PushSubscriptionSetResponse> {
    const targetAccountId = accountId ?? this.getPrimaryAccount();
    if (!targetAccountId) throw new Error('No account specified');

    const response = await this.request(
      [['PushSubscription/set', { accountId: targetAccountId, destroy: ids }, 'pushSubDestroy0']],
      ['urn:ietf:params:jmap:webpush']
    );

    const methodRes = response.methodResponses[0];
    if (!methodRes || methodRes[0] === 'error') {
      const error = methodRes?.[1] as { description?: string } | undefined;
      throw new Error(error?.description || 'PushSubscription/destroy failed');
    }

    return methodRes[1] as PushSubscriptionSetResponse;
  }

  // ============ RFC 9219 S/MIME Methods ============

  hasSmimeCapability(): boolean {
    return this.hasCapability('urn:ietf:params:jmap:smime');
  }

  async parseSmime(blobIds: string[], accountId?: string): Promise<EmailParseSmimeResponse> {
    const targetAccountId = accountId ?? this.getPrimaryAccount();
    if (!targetAccountId) throw new Error('No account specified');

    const response = await this.request(
      [['Email/parseSmime', { accountId: targetAccountId, blobIds }, 'parseSmime0']],
      ['urn:ietf:params:jmap:smime']
    );

    const methodRes = response.methodResponses[0];
    if (!methodRes || methodRes[0] === 'error') {
      const error = methodRes?.[1] as { description?: string } | undefined;
      throw new Error(error?.description || 'Email/parseSmime failed');
    }

    return methodRes[1] as EmailParseSmimeResponse;
  }
}

export const jmapClient = new JMAPClient();
