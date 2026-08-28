/// <reference types="vitest" />
import { createLogger, defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import serverUtils from './scripts/serverUtils.cjs'

const AUTH_TOKEN_RE = /^[A-Za-z0-9+/=]+$/
const proxyLogger = createLogger()

const formatProxyLog = (...args: unknown[]) => args.map((arg) => {
  if (typeof arg === 'string') return arg
  if (arg instanceof Error) return arg.message

  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}).join(' ')

const logDebug = (...args: unknown[]) => {
  proxyLogger.info(`[Sagittarius Proxy] ${formatProxyLog(...args)}`)
}

const logError = (...args: unknown[]) => {
  proxyLogger.error(`[Sagittarius Proxy] ${formatProxyLog(...args)}`)
}

function redactProxyUrl(url?: string) {
  if (!url) return url
  return url.replace(/access_token=[^&]+/g, 'access_token=[REDACTED]')
}

function attachBasicAuthFromAccessToken(proxyReq: { getHeader: (name: string) => unknown; setHeader: (name: string, value: string) => void }, url?: string) {
  if (!url || proxyReq.getHeader('authorization')) return

  try {
    const parsedUrl = new URL(url, 'http://localhost')
    const token = parsedUrl.searchParams.get('access_token')
    if (token && AUTH_TOKEN_RE.test(token) && token.length <= 512) {
      proxyReq.setHeader('Authorization', `Basic ${token}`)
    }
  } catch (e) {
    // Surface the parse failure so malformed access_token URLs are diagnosed
    // server-side instead of failing silently with a downstream 401.
    logError(`[auth] Failed to parse access_token from URL: ${e instanceof Error ? e.message : String(e)}`);
    logDebug(`[auth] Raw URL path (sanitized): ${url.split('?')[0]}`);
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const jmapServer = env.VITE_JMAP_SERVER || 'http://localhost:8080';

  return {
    plugins: [react()],
    build: {
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
              return 'vendor-react'
            }
            if (id.includes('node_modules/@tiptap/') || id.includes('node_modules/tiptap')) {
              return 'vendor-editor'
            }
            if (id.includes('node_modules/framer-motion') || id.includes('node_modules/lucide-react') || id.includes('node_modules/react-dnd') || id.includes('node_modules/react-virtuoso') || id.includes('node_modules/sonner')) {
              return 'vendor-ui'
            }
            if (id.includes('node_modules/@tanstack/react-query') || id.includes('node_modules/date-fns') || id.includes('node_modules/dompurify')) {
              return 'vendor-util'
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    server: {
      host: '0.0.0.0',
      port: 8081,
      configureServer(server) {
        // Server identity fingerprint (issue #1) — mirrors the production
        // /api/server-fingerprint endpoint so dev and prod behave identically.
        server.middlewares.use('/api/server-fingerprint', async (_req, res) => {
          try {
            const fingerprint = await serverUtils.computeServerFingerprint(jmapServer, {
              trustedFingerprints: serverUtils.parseTrustedFingerprints(process.env.JMAP_TRUSTED_FINGERPRINTS),
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(fingerprint))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              host: null,
              scheme: null,
              resolved: false,
              addresses: [],
              certFingerprint: null,
              trusted: false,
              error: err instanceof Error ? err.message : 'Fingerprint computation failed',
            }))
          }
        })
      },
      proxy: {
        '/jmap': {
          target: jmapServer,
          changeOrigin: true,
          ws: true,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              logDebug(`${req.method} ${redactProxyUrl(req.url)}`)
              attachBasicAuthFromAccessToken(proxyReq, req.url)
            })

            proxy.on('proxyReqWs', (proxyReq, req, _socket, _options, _head) => {
              attachBasicAuthFromAccessToken(proxyReq, req.url)
            })

            proxy.on('proxyRes', (proxyRes, req, _res) => {
              logDebug(`HTTP ${proxyRes.statusCode} ${redactProxyUrl(req.url)}`)

              if (proxyRes.statusCode === 401) {
                delete proxyRes.headers['www-authenticate'];
              }
            })

            proxy.on('error', (err, _req, res) => {
              // Issue #8: a dead backend must answer with a 502-shaped JSON
              // response (same shape as server.js / server.cjs) instead of
              // leaving the client hanging until the request timeout.
              logError(err.message)
              serverUtils.writeBadGatewayResponse(res)
            })
          }
        }
      }
    },
  };
})
