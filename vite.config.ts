/// <reference types="vitest" />
import { createLogger, defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
  } catch {
    // ignore parse errors
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const jmapServer = env.VITE_JMAP_SERVER || 'http://localhost:8080';

  return {
    plugins: [react()],
    build: {
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React runtime — very stable, cached long-term
            'vendor-react': ['react', 'react-dom'],
            // Rich text editor — only needed when composing
            'vendor-editor': [
              '@tiptap/react',
              '@tiptap/starter-kit',
              '@tiptap/extension-placeholder',
              '@tiptap/extension-underline',
              '@tiptap/extension-link',
            ],
            // UI framework libs — animations, icons, drag-and-drop, virtual scroll
            'vendor-ui': [
              'framer-motion',
              'lucide-react',
              'react-dnd',
              'react-dnd-html5-backend',
              'react-virtuoso',
              'sonner',
            ],
            // Data & utility libs
            'vendor-util': [
              '@tanstack/react-query',
              'date-fns',
              'dompurify',
            ],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 8081,
      proxy: {
        '/jmap': {
          target: jmapServer,
          changeOrigin: true,
          ws: true,
          configure: (proxy, _options) => {
            // Inject Authorization header from access_token query param.
            // EventSource (SSE) cannot send custom headers, so the client
            // passes Base64 credentials as ?access_token=<b64>.  The proxy
            // converts that into a proper Authorization header before
            // forwarding to the JMAP backend.
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              logDebug(`${req.method} ${redactProxyUrl(req.url)}`)
              attachBasicAuthFromAccessToken(proxyReq, req.url)
            })

            proxy.on('proxyReqWs', (proxyReq, req, _socket, _options, _head) => {
              attachBasicAuthFromAccessToken(proxyReq, req.url)
            })

            // Strip WWW-Authenticate from 401 responses so the browser does
            // NOT pop its native Basic Auth dialog.  The app handles auth
            // entirely through its own login screen.
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              logDebug(`HTTP ${proxyRes.statusCode} ${redactProxyUrl(req.url)}`)

              if (proxyRes.statusCode === 401) {
                delete proxyRes.headers['www-authenticate'];
              }
            })

            proxy.on('error', (err, _req, _res) => {
              logError(err.message)
            })
          }
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      setupFiles: ['src/test/setup.ts', 'src/test/a11y/setup.ts'],
    },
  };
})
