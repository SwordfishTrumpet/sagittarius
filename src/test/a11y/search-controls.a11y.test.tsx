import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SearchBar } from '../../components/SearchBar'
import { SearchFilterPills } from '../../components/SearchFilterPills'
import { checkA11y } from './helpers'

describe('Search controls accessibility', () => {
  it('renders search bar and filter pills without axe violations', async () => {
    const search = render(<SearchBar value="project" onChange={() => {}} onAdvancedClick={() => {}} onHistoryClick={() => {}} />)
    expect((await checkA11y(search.container)).violations).toHaveLength(0)
    search.unmount()

    const pills = render(
      <SearchFilterPills
        pills={[{ id: 'from', label: 'from:alice@example.com', type: 'from', value: 'alice@example.com' }] as any}
        onRemove={() => {}}
      />,
    )
    expect((await checkA11y(pills.container)).violations).toHaveLength(0)
  })
})
