const CACHE_TTL = 3600000
const DOH_URL = 'https://cloudflare-dns.com/dns-query'

interface CacheEntry {
  url: string | null
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp > CACHE_TTL
}

function parseBIMIRecord(txtData: string): string | null {
  const match = txtData.match(/;\s*l\s*=\s*([^;\s]+)/i)
  return match ? match[1] : null
}

async function queryDNS(domain: string): Promise<string | null> {
  const bimiDomain = `default._bimi.${domain}`
  const url = `${DOH_URL}?name=${encodeURIComponent(bimiDomain)}&type=TXT`

  const response = await fetch(url, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) return null

  const data = await response.json()
  if (!data.Answer) return null

  for (const answer of data.Answer) {
    if (answer.type === 16 && typeof answer.data === 'string') {
      const logoUrl = parseBIMIRecord(answer.data)
      if (logoUrl) return logoUrl
    }
  }

  return null
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
