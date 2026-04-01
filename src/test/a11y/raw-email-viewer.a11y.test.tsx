import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RawEmailViewer } from '../../components/RawEmailViewer'
import { checkA11y } from './helpers'

vi.mock('../../hooks/useEmailParse', () => ({
  useEmailParse: () => ({
    data: {
      headers: [{ name: 'Subject', value: 'Hello' }],
      textBody: [{ partId: 'text-1' }],
      htmlBody: [{ partId: 'html-1' }],
      bodyValues: {
        'text-1': { value: 'Body text' },
        'html-1': { value: '<p>Body html</p>' },
      },
      bodyStructure: { type: 'text/plain', subParts: [] },
    },
    isLoading: false,
    error: null,
  }),
}))

describe('RawEmailViewer accessibility', () => {
  it('passes axe checks', async () => {
    const { container } = render(<RawEmailViewer blobId="blob-1" onClose={() => {}} />)
    expect((await checkA11y(container)).violations).toHaveLength(0)
  })
})
