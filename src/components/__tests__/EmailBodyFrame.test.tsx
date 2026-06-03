import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildSrcDoc, isTrustedJmapDownloadUrl, normalizeDisplayHtml, stripDisplayArtifacts } from '../EmailBodyFrame'

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

  it('builds dark mode iframe document with forced light colors', () => {
    const srcDoc = buildSrcDoc('<p style="color: black">Hello</p>', true)
    expect(srcDoc).toContain('<!doctype html>')
    expect(srcDoc).toContain('<html class="dark">')
    expect(srcDoc).toContain('color-scheme: dark')
    expect(srcDoc).toContain('color: rgba(255, 255, 255, 0.98)')
    // Check that dark mode CSS sets :root variables
    expect(srcDoc).toContain('--icloud-text-primary: rgba(255, 255, 255, 0.98)')
    expect(srcDoc).toContain('--icloud-accent: #009aff;')
    // Verify link colors use :not([style*="color"]) to preserve custom link colors
    expect(srcDoc).toContain('a:not([style*="color"])')
    expect(srcDoc).toContain('color: #009aff;')
  })

  it('builds light mode iframe document with dark text', () => {
    const srcDoc = buildSrcDoc('<p>Hello</p>', false)
    expect(srcDoc).toContain('color: rgba(0, 0, 0, 0.88)')
    expect(srcDoc).not.toContain('color-scheme: dark')
    expect(srcDoc).not.toContain('<html class="dark">')
  })

  it('normalizes spacer-heavy html before building srcdoc', () => {
    const html = normalizeDisplayHtml('<br><br><div><br><p style="margin:0">Hi</p><br><p style="margin:0"><br></p><br><p style="margin:0">Thanks</p><br></div><br><table><tr><td>Footer</td></tr></table>')

    expect(html).not.toMatch(/^<br\s*\/?/i)
    expect(html).not.toContain('<div><br><p')
    expect(html).not.toContain('</p><br><p')
    expect(html).not.toContain('</div><br><table')
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

  it('strips display-only spacer artifacts from rendered email DOM', () => {
    const doc = new DOMParser().parseFromString(
      '<body><br><br><title>Factuur 2026-007</title><br><br><div style="display:none">Bekijk de factuur</div><br><br><table><tr><td><br><br><div>Goedendag,<br><br>Bedankt!</div><br><br></td></tr></table><br><br></body>',
      'text/html',
    )

    stripDisplayArtifacts(doc.body)

    expect(doc.body.innerHTML).not.toContain('<title>')
    expect(doc.body.innerHTML).not.toMatch(/^<br\s*\/?/i)
    expect(doc.body.innerHTML).not.toContain('</div><br><table')
    expect(doc.body.innerHTML).toContain('Goedendag,<br><br>Bedankt!')
  })

  it('preserves standalone breaks in empty elements (Apple Mail blank line pattern)', () => {
    const doc = new DOMParser().parseFromString(
      '<body><div>Hi Arjan,</div><div><br></div><div>Deze bijlage is bij het verzenden van de vorige factuur niet meegekomen.</div><div><br></div><div>Bij dezen.</div><div><br></div><div>Groet,<br>Remco</div></body>',
      'text/html',
    )

    stripDisplayArtifacts(doc.body)

    // Blank line divs should retain their <br>
    expect(doc.body.innerHTML).toContain('<div><br></div>')
    // Inline <br> inside content div should be preserved
    expect(doc.body.innerHTML).toContain('Groet,<br>Remco')
  })

  it('preserves standalone breaks with multiple BR children', () => {
    const doc = new DOMParser().parseFromString(
      '<body><p style="margin:0">Hello</p><p style="margin:0"><br></p><p style="margin:0"><br><br></p><p style="margin:0">World</p></body>',
      'text/html',
    )

    stripDisplayArtifacts(doc.body)

    // Single <br> in empty <p> preserved
    expect(doc.body.innerHTML).toContain('<p style="margin:0"><br></p>')
    // Multiple <br> in empty <p> collapsed to just one
    expect(doc.body.innerHTML).toContain('<p style="margin:0"><br></p>')  
  })

  it('still removes BR between sibling structural elements', () => {
    const doc = new DOMParser().parseFromString(
      '<body><div><br><p>Hello</p><br><p>World</p><br></div></body>',
      'text/html',
    )

    stripDisplayArtifacts(doc.body)

    expect(doc.body.innerHTML).not.toContain('<div><br><p')
    expect(doc.body.innerHTML).not.toContain('</p><br><p')
  })

  it('collapses spacer-heavy intercom-style html', () => {
    const doc = new DOMParser().parseFromString(
      `<body><br><br><br><br><br><br><div style="color:transparent;visibility:hidden;opacity:0;font-size:0px;border:0;max-height:1px;width:1px;margin:0;padding:0;display:none!important;line-height:0px!important;"><img src="x"></div><br><br><table><tbody><tr><td><br><br><br><table id="reply_email"><tbody><tr><td><div><br><p style="margin:0">Hi,</p><br><p style="margin:0"><br></p><br><p style="margin:0">Thank you for reaching out!</p><br><p style="margin:0"><br></p><br><p style="margin:0">We'll take a look.</p><br></div><br></td></tr></tbody></table><br><br><table><tbody><tr><td><div dir="ltr"><div><br><span>On Thu wrote:</span><br><blockquote><br><div><br><p>Hi Support,</p><br><br><p>Why are ads not blocked for me?</p><br></div><br></blockquote><br></div></div><br></td></tr></tbody></table></td></tr></tbody></table></body>`,
      'text/html',
    )

    stripDisplayArtifacts(doc.body)

    expect(doc.body.innerHTML).not.toMatch(/^<br\s*\/?/i)
    expect(doc.body.innerHTML).not.toContain('<div><br><p')
    expect(doc.body.innerHTML).not.toContain('</p><br><p')
    expect(doc.body.innerHTML).toContain('<p style="margin:0">Hi,</p>')
    expect(doc.body.innerHTML).toContain('<span>On Thu wrote:</span><blockquote>')
  })
})
