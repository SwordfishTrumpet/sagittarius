import { logger } from '../utils/logger';
import { eventSourceManager } from './eventSource';
import { webSocketManager } from './websocket';
import { stateManager } from './stateManager';
import type { QueryClient } from '@tanstack/react-query';

export interface JMAPSession {
  username: string;
  apiUrl: string;
  downloadUrl: string;
  uploadUrl: string;
  eventSourceUrl: string;
  webSocketUrl?: string;
  accounts: {
    [accountId: string]: {
      name: string;
      isPersonal: boolean;
      isReadOnly: boolean;
      accountCapabilities: any;
    };
  };
  primaryAccounts: {
    [capability: string]: string;
  };
  capabilities: any;
  state: string;
}

export interface JMAPResponse {
  methodResponses: [string, any, string][];
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
      eventSourceUrl: toRelative(session.eventSourceUrl),
      ...(session.webSocketUrl ? { webSocketUrl: toRelative(session.webSocketUrl) } : {}),
    };
  }

  async authenticate(username: string, password: string): Promise<JMAPSession> {
    const variants = buildAuthVariants(username);

    let lastError: Error | null = null;

    for (const variant of variants) {
      const credentials = btoa(`${variant}:${password}`);
      const authHeader = `Basic ${credentials}`;

      logger.debug(`[JMAP Auth Request] Trying username: ${variant}`);
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
      this.session = this.rewriteSessionUrls(session);
      this.authHeader = authHeader;

      sessionStorage.setItem('jmap_auth', authHeader);
      sessionStorage.setItem('jmap_session', JSON.stringify(session));

      return session;
    }

    throw lastError ?? new Error('Authentication failed');
  }

  getStoredSession(): JMAPSession | null {
    return this.session;
  }

  async request(methodCalls: any[], extraCapabilities?: string[]): Promise<JMAPResponse> {
    if (!this.session || !this.authHeader) {
      throw new Error('Not authenticated');
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

    const response = await fetch(this.session.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      logger.error(`[JMAP Error ${requestId}] 401 Unauthorized`);
      this.logout();
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[JMAP Error ${requestId}] HTTP ${response.status}`);
      logger.debug(`[JMAP Error ${requestId}] Response:`, errorText);
      throw new Error(`JMAP request failed: ${response.status}`);
    }

    const data = await response.json();
    logger.debug(`[JMAP Response ${requestId}]`, JSON.stringify(data, null, 2));
    return data;
  }

  hasCapability(urn: string): boolean {
    return !!this.session?.capabilities?.[urn];
  }

  getCapabilityConfig(urn: string): any {
    return this.session?.capabilities?.[urn] || null;
  }

  getAccountCapability(urn: string): any {
    const accountId = this.getPrimaryAccount();
    if (!accountId || !this.session?.accounts?.[accountId]) return null;
    return this.session.accounts[accountId].accountCapabilities?.[urn] || null;
  }

  getEventSourceUrl(): string | null {
    return this.session?.eventSourceUrl || null;
  }

  getWebSocketUrl(): string | null {
    const rawUrl = this.session?.webSocketUrl;
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
    
    return this.session.downloadUrl
      .replace('{accountId}', this.getPrimaryAccount() || '')
      .replace('{blobId}', blobId)
      .replace('{name}', encodeURIComponent(name))
      .replace('{type}', encodeURIComponent(type));
  }

  async uploadBlob(file: File): Promise<any> {
    if (!this.session || !this.authHeader) throw new Error('No session');

    const accountId = this.getPrimaryAccount();
    const url = this.session.uploadUrl.replace('{accountId}', accountId || '');

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
    // 5. Redirect — use replace() to avoid caching post-logout state in browser history
    window.location.replace('/');
  }

  getPrimaryAccount(capability?: string): string | null {
    if (!this.session?.primaryAccounts) return null;

    // Try exact capability match first
    const cap = capability || 'urn:ietf:params:jmap:mail';
    if (this.session.primaryAccounts[cap]) {
      return this.session.primaryAccounts[cap];
    }

    // Fallback: try any mail-related capability
    for (const key of Object.keys(this.session.primaryAccounts)) {
      if (key.includes('mail')) {
        return this.session.primaryAccounts[key];
      }
    }

    // Last resort: return the first available account
    const keys = Object.keys(this.session.primaryAccounts);
    if (keys.length > 0) {
      return this.session.primaryAccounts[keys[0]];
    }

    return null;
  }
}

export const jmapClient = new JMAPClient();
