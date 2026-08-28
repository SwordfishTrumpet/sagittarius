/**
 * Sagittarius Production Server
 *
 * Serves the Vite-built static files and proxies /jmap requests
 * to the JMAP backend with the same auth-injection logic as the
 * Vite dev proxy.
 *
 * Usage:  node server.js
 * Env:    JMAP_SERVER  — backend URL (default http://localhost:8080)
 *         PORT         — listen port  (default 8081)
 */

import express from 'express';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';
import httpProxy from 'http-proxy';
import { fileURLToPath } from 'url';
import path from 'path';
import { computeServerFingerprint, parseTrustedFingerprints, redactUrl } from './scripts/serverUtils.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8081', 10);
const JMAP_SERVER = process.env.JMAP_SERVER || 'http://localhost:8080';
// Operator allowlist: comma-separated sha256 cert fingerprints (with or
// without the `sha256:` prefix) that are always accepted for this deployment.
const TRUSTED_FINGERPRINTS = parseTrustedFingerprints(process.env.JMAP_TRUSTED_FINGERPRINTS);
const AUTH_TOKEN_RE = /^[A-Za-z0-9+/=]+$/;

// Compute WebSocket target from JMAP_SERVER
let JMAP_WS_SERVER = JMAP_SERVER;
if (JMAP_SERVER.startsWith('http://')) {
  JMAP_WS_SERVER = 'ws://' + JMAP_SERVER.slice(7);
} else if (JMAP_SERVER.startsWith('https://')) {
  JMAP_WS_SERVER = 'wss://' + JMAP_SERVER.slice(8);
}

// Create a raw http-proxy instance for SSE (bypasses Express buffering)
// selfHandleResponse: true means we manually handle the response (to flush headers immediately)
const sseProxy = httpProxy.createProxyServer({
  target: JMAP_SERVER,
  changeOrigin: true,
  selfHandleResponse: true, // We handle piping ourselves to flush headers immediately
});

const app = express();

const logInfo = (...args) => {
  console.log('[sagittarius]', ...args);
};

const logError = (...args) => {
  console.error('[sagittarius]', ...args);
};

function attachBasicAuthFromAccessToken(proxyReq, url) {
  if (!url || proxyReq.getHeader('authorization')) return;

  try {
    const parsedUrl = new URL(url, 'http://localhost');
    const token = parsedUrl.searchParams.get('access_token');
    if (token && AUTH_TOKEN_RE.test(token) && token.length <= 512) {
      proxyReq.setHeader('Authorization', `Basic ${token}`);
    }
  } catch (e) {
    logError('[auth] Failed to parse access_token from URL:', e.message);
    logInfo('[auth] Raw URL path (sanitized):', url.split('?')[0]);
  }
}

// ── Hardening ───────────────────────────────────────────────────────
app.disable('x-powered-by');

// ── Compression (gzip/brotli) ───────────────────────────────────────
// Skip compression for all JMAP endpoints - the proxy handles streaming
// responses and compression can interfere with SSE/WebSocket
app.use(compression({
  filter: (req, res) => {
    const url = req.originalUrl || req.url || '';
    // Don't compress any JMAP endpoints (session, queries, SSE, etc.)
    if (url.startsWith('/jmap')) {
      return false;
    }
    // Use default filter for everything else (static assets)
    return compression.filter(req, res);
  },
}));

// ── Security headers ────────────────────────────────────────────────
app.use((req, res, next) => {
  // Apply minimal security headers even for EventSource (VULN-007 fix)
  // These headers are safe for SSE and provide baseline protection
  if (req.url?.startsWith('/jmap/eventsource')) {
    // Prevent clickjacking even for EventSource
    res.setHeader('X-Frame-Options', 'DENY');
    // CSP frame-ancestors for modern browsers
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    // Block MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return next();
  }

  // HSTS — force HTTPS, prevent SSL-stripping (critical with Basic Auth)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Block MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS filter (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer — send origin only on cross-origin
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions — disable unneeded APIs
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // CSP — production-ready, inline styles allowed for Tailwind
  // WebSocket connects to same origin (proxied to JMAP backend)
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",                          // No inline scripts in production
      "style-src 'self' 'unsafe-inline'",           // Tailwind CSS + @fontsource fonts (self-hosted)
      "img-src 'self' data: blob: https:",          // inline images, blob previews, remote images (HTTPS only — no mixed content)
      "font-src 'self' data:",                      // @fontsource fonts (some inlined as data: URIs via Vite)
      "connect-src 'self'",                         // BIMI DNS proxied server-side
      "media-src 'self' blob:",                     // audio notifications
      "frame-ancestors 'none'",                     // no embedding
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",                          // no plugins
    ].join('; '),
  );
  next();
});

// ── Memory tracking ─────────────────────────────────────────────────
const memoryHistory = [];
const MAX_HISTORY = 100; // Keep last 100 readings
const MB = 1024 * 1024;

function recordMemory() {
  const usage = process.memoryUsage();
  const snapshot = {
    timestamp: Date.now(),
    rss: Math.round(usage.rss / MB),
    heapTotal: Math.round(usage.heapTotal / MB),
    heapUsed: Math.round(usage.heapUsed / MB),
    external: Math.round(usage.external / MB),
    arrayBuffers: Math.round((usage.arrayBuffers || 0) / MB),
  };
  
  memoryHistory.push(snapshot);
  if (memoryHistory.length > MAX_HISTORY) {
    memoryHistory.shift();
  }
  
  return snapshot;
}

// Record memory every 30 seconds
setInterval(recordMemory, 30000);

// ── Health check (useful for monitoring / load balancers) ────────────
app.get('/health', (_req, res) => {
  const current = recordMemory();
  const uptime = process.uptime();
  
  // Calculate trend if we have enough history
  let trend = 'stable';
  if (memoryHistory.length >= 2) {
    const oldest = memoryHistory[0];
    const diff = current.rss - oldest.rss;
    if (diff > 50) trend = 'increasing';
    else if (diff < -50) trend = 'decreasing';
  }
  
  res.json({
    status: 'ok',
    uptime: Math.floor(uptime),
    uptimeHuman: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    memory: current,
    memoryTrend: trend,
    memoryHistoryLength: memoryHistory.length,
    nodeVersion: process.version,
    pid: process.pid,
  });
});

// ── Server identity fingerprint (issue #1) ───────────────────────────
// The client pins the JMAP backend identity (DNS + TLS cert) so a
// lapsed-and-re-registered domain cannot harvest Basic-auth credentials.
app.get('/api/server-fingerprint', async (_req, res) => {
  try {
    const fingerprint = await computeServerFingerprint(JMAP_SERVER, {
      trustedFingerprints: TRUSTED_FINGERPRINTS,
    });
    res.json(fingerprint);
  } catch (err) {
    res.status(500).json({
      host: null,
      scheme: null,
      resolved: false,
      addresses: [],
      certFingerprint: null,
      trusted: false,
      error: err instanceof Error ? err.message : 'Fingerprint computation failed',
    });
  }
});

// ── EventSource (SSE) proxy ─────────────────────────────────────────
// Handled at HTTP server level before Express to avoid middleware buffering
// See server creation below

// Handle SSE proxy errors
sseProxy.on('error', (err, req, res) => {
  logError('[sse-proxy] Proxy error:', err.message);
  if (res.writeHead && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'SSE backend unavailable' }));
  }
});

// Force headers to be sent immediately when proxy response starts
// This is critical for SSE - browsers time out if headers aren't sent promptly
sseProxy.on('proxyRes', (proxyRes, req, res) => {
  logInfo('[sse-proxy] Response:', proxyRes.statusCode, 'content-type:', proxyRes.headers['content-type']);

  // Write status and headers immediately to the client
  if (!res.headersSent) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    // Force flush headers by writing an empty string
    res.flushHeaders();
    logInfo('[sse-proxy] Headers flushed');
  }

  // Pipe the rest of the response
  proxyRes.pipe(res);
});

// ── BIMI DNS proxy (server-side DNS lookup avoids third-party DoH) ──
import dns from 'dns';

// Strict domain validation: alphanumeric + hyphens, dot-separated labels,
// max 253 chars, 1-10 labels, no leading/trailing dots (RFC 1035 subset).
const DOMAIN_RE = /^(?=.{1,253}\.?$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.){1,9}[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

// Per-IP rate limiting: burst of 10 lookups, refill 5 per minute.
const BIMI_LIMIT_BURST = 10;
const BIMI_REFILL_MS = 12_000; // ~5 lookups/min sustained
const bimiHits = new Map(); // ip -> { count, refillAt }

function isBimiRateLimited(ip) {
  const now = Date.now();
  const entry = bimiHits.get(ip);
  if (!entry || now >= entry.refillAt) {
    bimiHits.set(ip, { count: 1, refillAt: now + BIMI_REFILL_MS });
    return false;
  }
  entry.count += 1;
  if (entry.count > BIMI_LIMIT_BURST) {
    return true;
  }
  bimiHits.set(ip, entry);
  return false;
}

// Cap the map size to avoid unbounded memory growth from spoofed IPs.
function pruneBimiRateLimits() {
  if (bimiHits.size <= 1000) return;
  const now = Date.now();
  for (const [ip, entry] of bimiHits) {
    if (now >= entry.refillAt) bimiHits.delete(ip);
  }
}

app.get('/api/bimi-dns', (req, res) => {
  const domain = req.query.domain;
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Missing domain' });
  }

  // Reject malformed domains before touching DNS (anti-amplification).
  const normalized = domain.toLowerCase();
  if (normalized.length > 253 || !DOMAIN_RE.test(normalized)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  pruneBimiRateLimits();
  if (isBimiRateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const bimiDomain = `default._bimi.${normalized}`;
  dns.resolveTxt(bimiDomain, (err, records) => {
    if (err || !records || records.length === 0) {
      return res.json({ logoUrl: null });
    }
    for (const txt of records) {
      const data = txt.join('');
      const match = data.match(/;\s*l\s*=\s*([^;\s]+)/i);
      if (match) return res.json({ logoUrl: match[1] });
    }
    res.json({ logoUrl: null });
  });
});

// ── JMAP reverse proxy ──────────────────────────────────────────────
const jmapProxy = createProxyMiddleware({
  target: JMAP_SERVER,
  changeOrigin: true,
  ws: true,
  pathFilter: '/jmap',

  on: {
    proxyReq: (proxyReq, req) => {
      // EventSource (SSE) can't send custom headers, so the client
      // passes Base64 credentials as ?access_token=<b64>.  Convert
      // that into a proper Authorization header for the JMAP backend.
      attachBasicAuthFromAccessToken(proxyReq, req.url);

      // Debug: Log upload requests (URL redacted — issue #2)
      if (req.url?.includes('/upload')) {
        logInfo('[proxy] Upload request:', redactUrl(req.url), 'Auth header present:', !!proxyReq.getHeader('authorization'));
      }

      if (req.url?.includes('/eventsource')) {
        logInfo('[proxy] EventSource request:', redactUrl(req.url));
      }
    },

    proxyReqWs: (proxyReq, req) => {
      // Change target to WebSocket URL for WebSocket connections
      proxyReq.setHeader('Host', new URL(JMAP_WS_SERVER).host);
      logInfo('[proxy] WebSocket upgrade:', redactUrl(req.url), '→', JMAP_WS_SERVER);
      attachBasicAuthFromAccessToken(proxyReq, req.url);
    },

    proxyRes: (proxyRes, req) => {
      // Strip WWW-Authenticate so the browser doesn't pop its native
      // Basic Auth dialog — the app handles auth via its own login UI.
      if (proxyRes.statusCode === 401) {
        delete proxyRes.headers['www-authenticate'];
      }
      if (req.url?.includes('/ws')) {
        logInfo('[proxy] WebSocket response:', proxyRes.statusCode, redactUrl(req.url));
      }
      if (req.url?.includes('/eventsource')) {
        logInfo('[proxy] EventSource connected:', proxyRes.statusCode, 'content-type:', proxyRes.headers['content-type']);
      }
    },

    error: (err, _req, res) => {
      logError(`[proxy] ${err.message}`);
      if (res.writeHead) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JMAP backend unavailable' }));
      }
    },
  },
});

app.use(jmapProxy);

// ── Static files (Vite production build) ────────────────────────────
const distDir = path.join(__dirname, 'dist');

// Hashed assets (assets/*) → immutable, cache forever
app.use(
  '/assets',
  express.static(path.join(distDir, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }),
);

// Everything else (index.html, favicon, sounds) → short cache + revalidate
app.use(
  express.static(distDir, {
    maxAge: '0',
    etag: true,
    lastModified: true,
    index: false,
  }),
);

// SPA fallback — serve index.html for any non-file route so client-side
// routing works.  Must come after static & proxy middleware.
app.get('/{*splat}', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(distDir, 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────
// Listen on the primary port (8081) and also on port 3000, which the
// upstream nginx reverse proxy on 192.168.68.251 forwards to.
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '3000', 10);

// Create HTTP servers manually so we can intercept EventSource before Express
import { createServer } from 'http';

const server = createServer((req, res) => {
  // Handle EventSource directly, bypassing Express entirely
  if (req.url?.startsWith('/jmap/eventsource')) {
    logInfo('[sse-direct] EventSource request:', redactUrl(req.url));

    // Extract access_token from query and add Authorization header
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('access_token');
      if (token && AUTH_TOKEN_RE.test(token) && token.length <= 512) {
        req.headers['authorization'] = `Basic ${token}`;
      }
    } catch (e) {
      logError('[sse-direct] Failed to parse EventSource URL:', e.message);
      logInfo('[sse-direct] Raw URL path (sanitized):', req.url.split('?')[0]);
    }

    sseProxy.web(req, res);
    return;
  }

  // Everything else goes through Express
  app(req, res);
});

function handleServerError(err, port) {
  // Never rethrow inside an 'error' event handler: an uncaught exception
  // there would crash the process with a cryptic Node internals traceback.
  // Log a descriptive message and exit with code 1 instead.
  if (err.code === 'EADDRINUSE') {
    logError(`Port ${port} already in use. Is another instance running?`);
    process.exit(1);
  }
  logError(`Server error on port ${port}:`, err.message);
  process.exit(1);
}

server.on('error', (err) => handleServerError(err, PORT));
server.listen(PORT, '0.0.0.0', () => {
  logInfo(`listening on 0.0.0.0:${server.address().port}`);
  logInfo(`JMAP backend: ${JMAP_SERVER}`);
  logInfo(`serving: ${distDir}`);
});

// Handle WebSocket upgrade for JMAP proxy
server.on('upgrade', (req, socket, head) => {
  logInfo('[ws-upgrade] Port', PORT, '- URL:', redactUrl(req.url), '- Headers:', JSON.stringify({
    upgrade: req.headers.upgrade,
    connection: req.headers.connection,
    host: req.headers.host,
  }));
  if (req.url?.startsWith('/jmap')) {
    jmapProxy.upgrade(req, socket, head);
  } else {
    logInfo('[ws-upgrade] Rejected - not /jmap path');
    socket.destroy();
  }
});

const proxyServer = createServer((req, res) => {
  // Handle EventSource directly, bypassing Express entirely
  if (req.url?.startsWith('/jmap/eventsource')) {
    logInfo('[sse-direct] EventSource request (proxy port):', redactUrl(req.url));

    // Extract access_token from query and add Authorization header
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('access_token');
      if (token && AUTH_TOKEN_RE.test(token) && token.length <= 512) {
        req.headers['authorization'] = `Basic ${token}`;
      }
    } catch (e) {
      logError('[sse-direct] Failed to parse EventSource URL on proxy port:', e.message);
      logInfo('[sse-direct] Raw URL path (sanitized):', req.url.split('?')[0]);
    }

    sseProxy.web(req, res);
    return;
  }

  // Everything else goes through Express
  app(req, res);
});

proxyServer.on('error', (err) => handleServerError(err, PROXY_PORT));

// Register the WebSocket upgrade handler BEFORE listen() so no upgrade
// request arriving right after the port binds is rejected or dropped.
proxyServer.on('upgrade', (req, socket, head) => {
  logInfo('[ws-upgrade] Port', PROXY_PORT, '- URL:', redactUrl(req.url), '- Headers:', JSON.stringify({
    upgrade: req.headers.upgrade,
    connection: req.headers.connection,
    host: req.headers.host,
  }));
  if (req.url?.startsWith('/jmap')) {
    jmapProxy.upgrade(req, socket, head);
  } else {
    logInfo('[ws-upgrade] Rejected - not /jmap path');
    socket.destroy();
  }
});

proxyServer.listen(PROXY_PORT, '0.0.0.0', () => {
  logInfo(`listening on 0.0.0.0:${proxyServer.address().port} (reverse proxy upstream)`);
});

// Graceful shutdown
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    logInfo(`received ${sig}, shutting down...`);
    let closed = 0;
    const done = () => { if (++closed >= 2) process.exit(0); };
    server.close(done);
    proxyServer.close(done);
    setTimeout(() => process.exit(1), 5000);   // force after 5s
  });
}
