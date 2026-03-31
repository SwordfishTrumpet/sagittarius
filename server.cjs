/**
 * Sagittarius Production Server
 *
 * Serves the built static files from dist/ and reverse-proxies /jmap
 * requests to the Stalwart JMAP backend.
 *
 * Uses raw http.createServer instead of Express to avoid Express 5
 * middleware mangling the Host header and stripping URL prefixes.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');

const PORT = process.env.PORT || 3000;
const JMAP_SERVER = process.env.JMAP_SERVER || 'http://localhost:8080';
const JMAP_HOST = process.env.JMAP_HOST || 'mail.wellintime.com';
const DIST_DIR = path.join(__dirname, 'dist');

// ── MIME types ──────────────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.wasm': 'application/wasm',
  '.map':  'application/json',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ── Proxy Instance ──────────────────────────────────────────────────
const proxy = httpProxy.createProxyServer({
  target: JMAP_SERVER,
  ws: true,
  changeOrigin: false,   // we set Host manually
  headers: { Host: JMAP_HOST },
});

proxy.on('proxyReq', (proxyReq, req) => {
  // Force Host header so Stalwart serves JMAP (not admin UI)
  proxyReq.setHeader('Host', JMAP_HOST);

  // EventSource cannot send custom headers.  The client passes
  // Base64 credentials via ?access_token=<b64>.  Convert that
  // into a proper Authorization header for the backend.
  if (req.url && !proxyReq.getHeader('authorization')) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('access_token');
      if (token) {
        proxyReq.setHeader('Authorization', `Basic ${token}`);
      }
    } catch { /* ignore parse errors */ }
  }
});

proxy.on('proxyRes', (proxyRes) => {
  // Strip WWW-Authenticate from 401 responses so the browser
  // does NOT pop its native Basic Auth dialog.
  if (proxyRes.statusCode === 401) {
    delete proxyRes.headers['www-authenticate'];
  }
});

proxy.on('error', (err, _req, res) => {
  console.error(`[Proxy Error] ${err.message}`);
  if (res && typeof res.writeHead === 'function') {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway');
  }
});

// ── Static file serving ─────────────────────────────────────────────
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

function serveStatic(req, res) {
  // Only GET/HEAD for static files
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  // Parse URL, strip query string
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    urlPath = '/';
  }

  // Prevent directory traversal
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      // Serve the file
      const mime = getMime(filePath);
      const headers = { 'Content-Type': mime };

      // Cache hashed assets aggressively
      if (urlPath.startsWith('/assets/')) {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      }

      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
      } else {
        fs.createReadStream(filePath).pipe(res);
      }
    } else {
      // SPA fallback: serve index.html
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        fs.createReadStream(INDEX_HTML).pipe(res);
      }
    }
  });
}

// ── HTTP Server ─────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/jmap')) {
    proxy.web(req, res);
  } else {
    serveStatic(req, res);
  }
});

// WebSocket upgrade handling
server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/jmap')) {
    proxy.ws(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sagittarius running on http://0.0.0.0:${PORT}`);
  console.log(`JMAP backend: ${JMAP_SERVER} (Host: ${JMAP_HOST})`);
});
