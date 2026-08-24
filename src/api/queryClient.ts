/**
 * Application-wide TanStack Query client singleton.
 *
 * Lives in its own module (not main.tsx) so hooks can import it without
 * dragging the whole app entrypoint — and its circular import chain
 * App → hooks/jmap/* → usePushConnection → main.tsx (BUG-2026-060) — into
 * the module graph. main.tsx imports this and registers it with jmapClient.
 */
import { QueryClient } from '@tanstack/react-query'
import { jmapClient } from './jmap'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

jmapClient.registerQueryClient(queryClient)
