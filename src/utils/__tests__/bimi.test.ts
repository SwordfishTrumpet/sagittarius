import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBIMILogoUrl, clearBIMICache } from '../bimi';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  clearBIMICache();
});

function mockDNSResponse(logoUrl: string | null) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ logoUrl }),
  });
}

describe('getBIMILogoUrl', () => {
  it('returns the BIMI logo URL from server response', async () => {
    mockDNSResponse('https://github.com/mail/logos/logo.svg');
    const url = await getBIMILogoUrl('github.com');
    expect(url).toBe('https://github.com/mail/logos/logo.svg');
  });

  it('returns null when no BIMI record exists', async () => {
    mockDNSResponse(null);
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBeNull();
  });

  it('returns null when DNS query fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBeNull();
  });

  it('returns null for non-200 server response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBeNull();
  });

  it('returns null when server returns no logoUrl', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBeNull();
  });

  it('caches results and avoids duplicate requests', async () => {
    mockDNSResponse('https://example.com/logo.svg');
    await getBIMILogoUrl('example.com');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockClear();
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBe('https://example.com/logo.svg');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('clears cache when clearBIMICache is called', async () => {
    mockDNSResponse('https://example.com/logo.svg');
    await getBIMILogoUrl('example.com');
    clearBIMICache();

    mockFetch.mockClear();
    mockDNSResponse('https://other.com/logo.svg');
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBe('https://other.com/logo.svg');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('queries the server-side BIMI proxy endpoint', async () => {
    mockDNSResponse('https://example.com/logo.svg');
    await getBIMILogoUrl('example.com');

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe('/api/bimi-dns?domain=example.com');
  });
});
