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
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8081', 10);
const JMAP_SERVER = process.env.JMAP_SERVER || 'http://localhost:8080';

const app = express();

// ── Hardening ───────────────────────────────────────────────────────
app.disable('x-powered-by');

// ── Compression (gzip/brotli) ───────────────────────────────────────
app.use(compression());

// ── Security headers ────────────────────────────────────────────────
app.use((_req, res, next) => {
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
  // CSP — allow self + inline for Vite, connect to JMAP backend
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",          // Tailwind injects inline styles
      "img-src 'self' data: blob:",                 // inline images, blob previews
      "font-src 'self'",
      "connect-src 'self' wss:",                 // JMAP API + WebSocket push (encrypted only)
      "media-src 'self' blob:",                     // audio notifications
      "frame-ancestors 'none'",                     // no embedding
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  next();
});

// ── Health check (useful for monitoring / load balancers) ────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── JMAP reverse proxy ──────────────────────────────────────────────
app.use(
  createProxyMiddleware({
    target: JMAP_SERVER,
    changeOrigin: true,
    ws: true,
    pathFilter: '/jmap',

    on: {
      proxyReq: (proxyReq, req) => {
        // EventSource (SSE) can't send custom headers, so the client
        // passes Base64 credentials as ?access_token=<b64>.  Convert
        // that into a proper Authorization header for the JMAP backend.
        if (req.url && !proxyReq.getHeader('authorization')) {
          try {
            const url = new URL(req.url, 'http://localhost');
            const token = url.searchParams.get('access_token');
            if (token && /^[A-Za-z0-9+/=]+$/.test(token) && token.length <= 512) {
              proxyReq.setHeader('Authorization', `Basic ${token}`);
            }
          } catch { /* ignore parse errors */ }
        }
      },

      proxyRes: (proxyRes) => {
        // Strip WWW-Authenticate so the browser doesn't pop its native
        // Basic Auth dialog — the app handles auth via its own login UI.
        if (proxyRes.statusCode === 401) {
          delete proxyRes.headers['www-authenticate'];
        }
      },

      error: (err, _req, res) => {
        console.error(`[proxy] ${err.message}`);
        if (res.writeHead) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'JMAP backend unavailable' }));
        }
      },
    },
  }),
);

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

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[sagittarius] listening on 0.0.0.0:${PORT}`);
  console.log(`[sagittarius] JMAP backend: ${JMAP_SERVER}`);
  console.log(`[sagittarius] serving: ${distDir}`);
});

const proxyServer = app.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[sagittarius] listening on 0.0.0.0:${PROXY_PORT} (reverse proxy upstream)`);
});

// Graceful shutdown
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`[sagittarius] received ${sig}, shutting down...`);
    let closed = 0;
    const done = () => { if (++closed >= 2) process.exit(0); };
    server.close(done);
    proxyServer.close(done);
    setTimeout(() => process.exit(1), 5000);   // force after 5s
  });
}
