import { describe, expect, it } from 'vitest'
import { buildIdentitySignatureMarkup, upsertIdentitySignature } from '../signatureBuilder'

describe('signatureBuilder', () => {
  it('renders text signatures with escaped line breaks', () => {
    expect(buildIdentitySignatureMarkup({ textSignature: '—\nUser <Admin>' })).toBe('—<br/>User &lt;Admin&gt;')
  })

  it('prefers html signatures when available', () => {
    expect(buildIdentitySignatureMarkup({ htmlSignature: '<p><strong>Team</strong></p>', textSignature: 'Fallback' }))
      .toContain('<strong>Team</strong>')
  })

  it('inserts signatures above quoted content', () => {
    const next = upsertIdentitySignature(
      '<div id="quoted-content" data-sagittarius-quote="1"><p>Quoted text</p></div>',
      { id: 'identity-1', textSignature: '—\nUser Example' },
    )

    expect(next).toContain('data-sagittarius-signature="1"')
    expect(next).toContain('data-identity-id="identity-1"')
    expect(next.indexOf('data-sagittarius-signature="1"')).toBeLessThan(next.indexOf('data-sagittarius-quote="1"'))
  })

  it('replaces an existing signature when identity changes', () => {
    const next = upsertIdentitySignature(
      '<p>Hello there</p><div data-sagittarius-signature="1" data-identity-id="identity-1">Old</div>',
      { id: 'identity-2', textSignature: 'New Alias' },
    )

    expect(next).toContain('data-identity-id="identity-2"')
    expect(next).toContain('New Alias')
    expect(next).not.toContain('Old')
  })

  it('removes prior signature markup when next identity has no signature', () => {
    const next = upsertIdentitySignature(
      '<p data-sagittarius-signature-spacer="1"><br></p><div data-sagittarius-signature="1">Old</div><div id="quoted-content" data-sagittarius-quote="1"></div>',
      { id: 'identity-2', textSignature: '' },
    )

    expect(next).not.toContain('data-sagittarius-signature="1"')
    expect(next).not.toContain('data-sagittarius-signature-spacer="1"')
  })
})
