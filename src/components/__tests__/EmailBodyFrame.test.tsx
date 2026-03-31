import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildSrcDoc, isTrustedJmapDownloadUrl } from '../EmailBodyFrame'

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}))

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getSession,
  },
}))

describe('EmailBodyFrame helpers', () => {
  beforeEach(() => {
    getSession.mockReset()
    getSession.mockReturnValue({
      downloadUrl: 'https://mail.test/download/{accountId}/{blobId}/{name}?type={type}',
    })
  })

  it('builds a full iframe document', () => {
    const srcDoc = buildSrcDoc('<p>Hello</p>')
    expect(srcDoc).toContain('<!doctype html>')
    expect(srcDoc).toContain('<base target="_blank" />')
    expect(srcDoc).toContain('<body><p>Hello</p></body>')
  })

  it('accepts trusted JMAP download URLs', () => {
    expect(isTrustedJmapDownloadUrl('https://mail.test/download/account-1/blob-1/image.png?type=image%2Fpng')).toBe(true)
  })

  it('rejects non-JMAP hosts for CID auth fetches', () => {
    expect(isTrustedJmapDownloadUrl('https://evil.test/download/account-1/blob-1/image.png?type=image%2Fpng')).toBe(false)
  })

  it('rejects unrelated same-origin paths for CID auth fetches', () => {
    expect(isTrustedJmapDownloadUrl('https://mail.test/other/blob-1/image.png')).toBe(false)
  })
})
