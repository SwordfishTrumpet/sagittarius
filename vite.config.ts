/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const jmapServer = env.VITE_JMAP_SERVER || 'http://localhost:8080';

  return {
    plugins: [react()],
    build: {
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
              console.log(`[Proxy Request] ${req.method} ${req.url}`);

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

            // Strip WWW-Authenticate from 401 responses so the browser does
            // NOT pop its native Basic Auth dialog.  The app handles auth
            // entirely through its own login screen.
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log(`[Proxy Response] ${proxyRes.statusCode} ${req.url}`);

              if (proxyRes.statusCode === 401) {
                delete proxyRes.headers['www-authenticate'];
              }
            });

            proxy.on('error', (err, _req, _res) => {
              console.error(`[Proxy Error] ${err.message}`);
            });
          }
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      setupFiles: ['src/test/setup.ts'],
    },
  };
})
