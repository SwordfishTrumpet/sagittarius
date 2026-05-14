import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { EmailBodyFrame } from '../EmailBodyFrame'

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}))

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getSession,
    getAuthHeader: vi.fn(() => 'Basic test'),
  },
}))

describe('EmailBodyFrame remote images', () => {
  beforeEach(() => {
    getSession.mockReset()
    getSession.mockReturnValue({
      downloadUrl: 'https://mail.test/download/{accountId}/{blobId}/{name}?type={type}',
    })
  })

  it('remounts iframe when html changes to unblock images', () => {
    const blockedHtml = '<p>Hello</p><img src="data:image/svg+xml,blocked" data-blocked-src="https://example.com/track.png" alt="t">'
    const unblockedHtml = '<p>Hello</p><img src="https://example.com/track.png" alt="t">'

    const { rerender, container } = render(
      <EmailBodyFrame html={blockedHtml} darkMode={false} />
    )

    const iframe1 = container.querySelector('iframe')
    expect(iframe1).toBeTruthy()
    expect(iframe1?.getAttribute('srcdoc')).toContain('data:image/svg+xml,blocked')
    // blocked-src attribute contains the original URL, but src is the placeholder
    expect(iframe1?.getAttribute('srcdoc')).toContain('data-blocked-src="https://example.com/track.png"')

    rerender(<EmailBodyFrame html={unblockedHtml} darkMode={false} />)

    const iframe2 = container.querySelector('iframe')
    expect(iframe2).toBeTruthy()
    // The iframe should have been remounted (different element reference)
    expect(iframe2).not.toBe(iframe1)
    expect(iframe2?.getAttribute('srcdoc')).toContain('https://example.com/track.png')
    expect(iframe2?.getAttribute('srcdoc')).not.toContain('data:image/svg+xml,blocked')
  })
})
