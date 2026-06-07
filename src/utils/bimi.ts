const CACHE_TTL = 3600000

interface CacheEntry {
  url: string | null
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp > CACHE_TTL
}

async function queryDNS(domain: string): Promise<string | null> {
  const response = await fetch(`/api/bimi-dns?domain=${encodeURIComponent(domain)}`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) return null
  const data = await response.json()
  return data.logoUrl ?? null
}

export async function getBIMILogoUrl(domain: string): Promise<string | null> {
  const cached = cache.get(domain)
  if (cached && !isExpired(cached)) return cached.url

  try {
    const url = await queryDNS(domain)
    cache.set(domain, { url, timestamp: Date.now() })
    return url
  } catch {
    cache.set(domain, { url: null, timestamp: Date.now() })
    return null
  }
}

export function clearBIMICache(): void {
  cache.clear()
}
