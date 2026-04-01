import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { ResizeHandle } from '../ResizeHandle'

function ResizeHandleHarness() {
  const [width, setWidth] = useState(260)

  return (
    <ResizeHandle
      onPointerDown={() => {}}
      isDragging={false}
      ariaLabel="Resize sidebar"
      valueNow={width}
      valueMin={180}
      valueMax={400}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') setWidth((value) => value + 10)
        if (event.key === 'ArrowLeft') setWidth((value) => value - 10)
        if (event.key === 'Home') setWidth(180)
        if (event.key === 'End') setWidth(400)
      }}
    />
  )
}

describe('ResizeHandle', () => {
  it('exposes separator semantics and keyboard resizing', async () => {
    const user = userEvent.setup()
    render(<ResizeHandleHarness />)

    const handle = screen.getByRole('separator', { name: 'Resize sidebar' })
    handle.focus()

    expect(handle).toHaveAttribute('aria-valuenow', '260')

    await user.keyboard('[ArrowRight]')
    expect(handle).toHaveAttribute('aria-valuenow', '270')

    await user.keyboard('[Home]')
    expect(handle).toHaveAttribute('aria-valuenow', '180')

    await user.keyboard('[End]')
    expect(handle).toHaveAttribute('aria-valuenow', '400')
  })
})
