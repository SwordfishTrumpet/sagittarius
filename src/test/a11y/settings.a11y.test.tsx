import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Settings } from '../../components/Settings'
import { checkA11y } from './helpers'

vi.mock('../../components/settings/VacationSettings', () => ({ VacationSettings: () => <div>Vacation settings</div> }))
vi.mock('../../components/settings/IdentitySettings', () => ({ IdentitySettings: () => <div>Identity settings</div> }))
vi.mock('../../components/settings/SieveSettings', () => ({ SieveSettings: () => <div>Filter settings</div> }))

describe('Settings accessibility', () => {
  it('renders without axe violations and supports keyboard tab switching', async () => {
    const user = userEvent.setup()
    const { container } = render(<Settings isOpen onClose={() => {}} />)

    expect((await checkA11y(container)).violations).toHaveLength(0)

    const generalTab = screen.getByRole('tab', { name: 'General' })
    generalTab.focus()

    await user.keyboard('[ArrowRight]')
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Vacation' })).toHaveFocus())
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Vacation settings')
  })
})
