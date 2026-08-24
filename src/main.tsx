import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ThemeProvider } from './context/ThemeProvider.tsx'
import { AccountProvider } from './hooks/useAccountManager.tsx'
import { logger } from './utils/logger'
import './index.css'

export { queryClient } from './api/queryClient'
import { queryClient } from './api/queryClient'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        logger.info('Service worker registered', registration.scope)
      },
      (error) => {
        logger.warn('Service worker registration failed', error)
      },
    )
  })
}

if (import.meta.env.DEV) {
  void import('@axe-core/react').then(({ default: axe }) => {
    axe(React, ReactDOM, 1000);
  }).catch((err) => {
    logger.warn('[a11y] Failed to load @axe-core/react:', err);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AccountProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ThemeProvider>
      </AccountProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
