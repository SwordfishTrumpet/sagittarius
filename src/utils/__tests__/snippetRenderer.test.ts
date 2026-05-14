import { describe, expect, it } from 'vitest'
import { sanitizeSnippet } from '../snippetRenderer'

describe('sanitizeSnippet', () => {
  it('allows mark tags for search highlights', () => {
    const html = 'Hello <mark>world</mark> test'
    expect(sanitizeSnippet(html)).toBe('Hello <mark>world</mark> test')
  })

  it('strips all other HTML tags', () => {
    const html = '<p>Paragraph</p><div>Div</div><span>Span</span>'
    expect(sanitizeSnippet(html)).toBe('ParagraphDivSpan')
  })

  it('strips all attributes including on mark tags', () => {
    const html = '<mark class="highlight" style="color:red">text</mark>'
    expect(sanitizeSnippet(html)).toBe('<mark>text</mark>')
  })

  it('handles empty string', () => {
    expect(sanitizeSnippet('')).toBe('')
  })

  it('handles plain text without HTML', () => {
    expect(sanitizeSnippet('Just plain text')).toBe('Just plain text')
  })

  it('strips script tags (XSS prevention)', () => {
    const html = 'Hello <script>alert("xss")</script> world'
    expect(sanitizeSnippet(html)).toBe('Hello  world')
  })

  it('strips event handlers (XSS prevention)', () => {
    const html = '<mark onclick="alert(1)">text</mark>'
    expect(sanitizeSnippet(html)).toBe('<mark>text</mark>')
  })

  it('strips nested disallowed tags inside mark', () => {
    const html = '<mark><b>bold</b> text</mark>'
    expect(sanitizeSnippet(html)).toBe('<mark>bold text</mark>')
  })

  it('preserves multiple mark tags', () => {
    const html = '<mark>first</mark> and <mark>second</mark>'
    expect(sanitizeSnippet(html)).toBe('<mark>first</mark> and <mark>second</mark>')
  })

  it('strips img tags', () => {
    const html = 'Start <img src="x" onerror="alert(1)"> End'
    expect(sanitizeSnippet(html)).toBe('Start  End')
  })

  it('strips anchor tags and hrefs', () => {
    const html = 'Click <a href="javascript:alert(1)">here</a>'
    expect(sanitizeSnippet(html)).toBe('Click here')
  })
})
