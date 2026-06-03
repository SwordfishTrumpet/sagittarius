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
