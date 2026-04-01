import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useRef, useState } from 'react';
import { useFocusTrap } from '../useFocusTrap';

function FocusTrapHarness() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(dialogRef, { isActive: open, initialFocusRef });

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Before</button>
      {open ? (
        <div ref={dialogRef} tabIndex={-1}>
          <button ref={initialFocusRef} type="button">First</button>
          <button type="button">Second</button>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>
      ) : null}
      <button type="button">After</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus on mount, wraps tab order, and restores focus on unmount', async () => {
    const user = userEvent.setup();
    render(<FocusTrapHarness />);

    await user.click(screen.getByRole('button', { name: 'Before' }));

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
  });
});
