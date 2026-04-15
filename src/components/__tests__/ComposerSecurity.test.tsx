import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Composer } from '../Composer';

// Mock the JMAP client
vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getBlobUrl: vi.fn((blobId: string) => `https://example.com/blob/${blobId}`),
    getPrimaryAccount: () => 'account-1',
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

describe('Composer Security - XSS Prevention (VULN-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject javascript: URLs in link insertion', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    // Mock window.prompt to return a javascript: URL
    const originalPrompt = window.prompt;
    window.prompt = vi.fn().mockReturnValue('javascript:alert("XSS")');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Composer onClose={onClose} />
      </QueryClientProvider>
    );

    // Click the link button to trigger setLink
    const linkButton = screen.getByRole('button', { name: /insert link/i });
    await user.click(linkButton);

    // Verify toast.error was called with the security message
    expect(toast.error).toHaveBeenCalledWith(
      'Invalid URL protocol. Only http, https, mailto, and tel are allowed.'
    );

    // Restore original prompt
    window.prompt = originalPrompt;
  });

  it('should allow valid http URLs in link insertion', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    // Mock window.prompt to return a valid URL
    const originalPrompt = window.prompt;
    window.prompt = vi.fn().mockReturnValue('https://example.com');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Composer onClose={onClose} />
      </QueryClientProvider>
    );

    // Click the link button
    const linkButton = screen.getByRole('button', { name: /insert link/i });
    await user.click(linkButton);

    // Verify no error toast was shown
    expect(toast.error).not.toHaveBeenCalled();

    // Restore original prompt
    window.prompt = originalPrompt;
  });

  it('should allow mailto: URLs in link insertion', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    // Mock window.prompt to return a mailto: URL
    const originalPrompt = window.prompt;
    window.prompt = vi.fn().mockReturnValue('mailto:test@example.com');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Composer onClose={onClose} />
      </QueryClientProvider>
    );

    // Click the link button
    const linkButton = screen.getByRole('button', { name: /insert link/i });
    await user.click(linkButton);

    // Verify no error toast was shown
    expect(toast.error).not.toHaveBeenCalled();

    // Restore original prompt
    window.prompt = originalPrompt;
  });

  it('should reject data: URLs in link insertion', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    // Mock window.prompt to return a data: URL
    const originalPrompt = window.prompt;
    window.prompt = vi.fn().mockReturnValue('data:text/html,<script>alert("XSS")</script>');

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Composer onClose={onClose} />
      </QueryClientProvider>
    );

    // Click the link button
    const linkButton = screen.getByRole('button', { name: /insert link/i });
    await user.click(linkButton);

    // Verify toast.error was called
    expect(toast.error).toHaveBeenCalledWith(
      'Invalid URL protocol. Only http, https, mailto, and tel are allowed.'
    );

    // Restore original prompt
    window.prompt = originalPrompt;
  });
});
