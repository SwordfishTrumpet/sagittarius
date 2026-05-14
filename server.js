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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8081', 10);
const JMAP_SERVER = process.env.JMAP_SERVER || 'http://localhost:8080';
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
  } catch {
    /* ignore parse errors */
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
      "style-src 'self' 'unsafe-inline'",           // Tailwind CSS uses inline styles
      "img-src 'self' data: blob: https: http:",    // inline images, blob previews, remote images
      "font-src 'self'",
      "connect-src 'self'",                         // Same-origin only (JMAP API + WebSocket proxied)
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

      // Debug: Log upload requests
      if (req.url?.includes('/upload')) {
        logInfo('[proxy] Upload request:', req.url, 'Auth header present:', !!proxyReq.getHeader('authorization'));
      }

      if (req.url?.includes('/eventsource')) {
        logInfo('[proxy] EventSource request:', req.url);
      }
    },

    proxyReqWs: (proxyReq, req) => {
      // Change target to WebSocket URL for WebSocket connections
      proxyReq.setHeader('Host', new URL(JMAP_WS_SERVER).host);
      logInfo('[proxy] WebSocket upgrade:', req.url, '→', JMAP_WS_SERVER);
      attachBasicAuthFromAccessToken(proxyReq, req.url);
    },

    proxyRes: (proxyRes, req) => {
      // Strip WWW-Authenticate so the browser doesn't pop its native
      // Basic Auth dialog — the app handles auth via its own login UI.
      if (proxyRes.statusCode === 401) {
        delete proxyRes.headers['www-authenticate'];
      }
      if (req.url?.includes('/ws')) {
        logInfo('[proxy] WebSocket response:', proxyRes.statusCode, req.url);
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
    logInfo('[sse-direct] EventSource request:', req.url);

    // Extract access_token from query and add Authorization header
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('access_token');
      if (token && AUTH_TOKEN_RE.test(token) && token.length <= 512) {
        req.headers['authorization'] = `Basic ${token}`;
      }
    } catch (e) {
      // ignore parse errors
    }

    sseProxy.web(req, res);
    return;
  }

  // Everything else goes through Express
  app(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  logInfo(`listening on 0.0.0.0:${PORT}`);
  logInfo(`JMAP backend: ${JMAP_SERVER}`);
  logInfo(`serving: ${distDir}`);
});

// Handle WebSocket upgrade for JMAP proxy
server.on('upgrade', (req, socket, head) => {
  logInfo('[ws-upgrade] Port', PORT, '- URL:', req.url, '- Headers:', JSON.stringify({
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
    logInfo('[sse-direct] EventSource request (proxy port):', req.url);

    // Extract access_token from query and add Authorization header
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('access_token');
      if (token && AUTH_TOKEN_RE.test(token) && token.length <= 512) {
        req.headers['authorization'] = `Basic ${token}`;
      }
    } catch (e) {
      // ignore parse errors
    }

    sseProxy.web(req, res);
    return;
  }

  // Everything else goes through Express
  app(req, res);
});

proxyServer.listen(PROXY_PORT, '0.0.0.0', () => {
  logInfo(`listening on 0.0.0.0:${PROXY_PORT} (reverse proxy upstream)`);
});

// Also handle WebSocket on proxy port
proxyServer.on('upgrade', (req, socket, head) => {
  logInfo('[ws-upgrade] Port', PROXY_PORT, '- URL:', req.url, '- Headers:', JSON.stringify({
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
