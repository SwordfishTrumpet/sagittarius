import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBIMILogoUrl, clearBIMICache } from '../bimi';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  clearBIMICache();
});

function mockDNSResponse(data: string | null) {
  if (data === null) {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  } else {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          Answer: [{ type: 16, data }],
        }),
    });
  }
}

describe('getBIMILogoUrl', () => {
  it('returns the BIMI logo URL from a valid TXT record', async () => {
    mockDNSResponse('v=BIMI1; l=https://github.com/mail/logos/logo.svg; a=https://github.com/vmc.pem');
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

  it('returns null for non-200 DNS response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBeNull();
  });

  it('returns null when TXT record has no l= parameter', async () => {
    mockDNSResponse('v=BIMI1; a=https://example.com/cert.pem');
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBeNull();
  });

  it('returns null when Answer array is present but empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Answer: [] }),
    });
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBeNull();
  });

  it('returns null when response has no Answer field', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Status: 0, TC: false }),
    });
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBeNull();
  });

  it('parses l= URL even when parameters are in different order', async () => {
    mockDNSResponse('a=https://example.com/vmc.pem; l=https://cdn.example.com/logo.svg; v=BIMI1');
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBe('https://cdn.example.com/logo.svg');
  });

  it('caches results and avoids duplicate DNS queries', async () => {
    mockDNSResponse('v=BIMI1; l=https://example.com/logo.svg');
    await getBIMILogoUrl('example.com');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockClear();
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBe('https://example.com/logo.svg');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('clears cache when clearBIMICache is called', async () => {
    mockDNSResponse('v=BIMI1; l=https://example.com/logo.svg');
    await getBIMILogoUrl('example.com');
    clearBIMICache();

    mockFetch.mockClear();
    mockDNSResponse('v=BIMI1; l=https://other.com/logo.svg');
    const url = await getBIMILogoUrl('example.com');
    expect(url).toBe('https://other.com/logo.svg');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('queries default._bimi.<domain> via DNS-over-HTTPS', async () => {
    mockDNSResponse('v=BIMI1; l=https://example.com/logo.svg');
    await getBIMILogoUrl('example.com');

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('default._bimi.example.com');
    expect(calledUrl).toContain('type=TXT');
  });
});
