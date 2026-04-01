import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CreateFolderDialog } from '../../components/dialogs/CreateFolderDialog'
import { RenameFolderDialog } from '../../components/dialogs/RenameFolderDialog'
import { DeleteFolderDialog } from '../../components/dialogs/DeleteFolderDialog'
import { checkA11y } from './helpers'

describe('Dialog accessibility', () => {
  it('passes axe for folder dialogs', async () => {
    const create = render(<CreateFolderDialog isOpen onClose={() => {}} onConfirm={() => {}} />)
    expect((await checkA11y(create.container)).violations).toHaveLength(0)
    create.unmount()

    const rename = render(<RenameFolderDialog isOpen folderName="Projects" onClose={() => {}} onConfirm={() => {}} />)
    expect((await checkA11y(rename.container)).violations).toHaveLength(0)
    rename.unmount()

    const destroy = render(<DeleteFolderDialog isOpen folderName="Projects" onClose={() => {}} onConfirm={() => {}} />)
    expect((await checkA11y(destroy.container)).violations).toHaveLength(0)
    destroy.unmount()
  })
})
