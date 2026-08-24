/**
 * Smoke tests for the query client singleton (BUG-2026-060).
 *
 * queryClient used to live in main.tsx, forcing hooks/* into a circular
 * import chain through the app entrypoint. It now lives in its own module
 * that also registers itself with jmapClient — this asserts that
 * registration still happens at module load.
 */
import { describe, it, expect } from 'vitest';
import { queryClient } from '../queryClient';
import { jmapClient } from '../jmap';
import { QueryClient } from '@tanstack/react-query';

describe('api/queryClient', () => {
  it('exports a QueryClient singleton', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it('is registered with jmapClient at module load', () => {
    expect(
      (jmapClient as unknown as { _queryClient?: QueryClient })._queryClient,
    ).toBe(queryClient);
  });
});
