import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IOSToggle } from '../IOSToggle';

describe('IOSToggle', () => {
  it('renders with correct accessibility attributes when unchecked', () => {
    render(<IOSToggle checked={false} onChange={vi.fn()} label="Enable feature" />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Enable feature');
  });

  it('renders with correct accessibility attributes when checked', () => {
    render(<IOSToggle checked={true} onChange={vi.fn()} label="Enable feature" />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with true when clicked while unchecked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<IOSToggle checked={false} onChange={onChange} />);

    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when clicked while checked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<IOSToggle checked={true} onChange={onChange} />);

    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('toggles on Enter key press', () => {
    const onChange = vi.fn();

    render(<IOSToggle checked={false} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('switch'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles on Space key press', () => {
    const onChange = vi.fn();

    render(<IOSToggle checked={false} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle on other key presses', () => {
    const onChange = vi.fn();

    render(<IOSToggle checked={false} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('switch'), { key: 'Tab' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies checked styling', () => {
    const { container } = render(<IOSToggle checked={true} onChange={vi.fn()} />);

    const switchButton = container.firstChild as HTMLElement;
    expect(switchButton.className).toContain('bg-[#34C759]');
  });

  it('applies unchecked styling', () => {
    const { container } = render(<IOSToggle checked={false} onChange={vi.fn()} />);

    const switchButton = container.firstChild as HTMLElement;
    expect(switchButton.className).toContain('bg-[#E5E5EA]');
  });

  it('applies custom className', () => {
    const { container } = render(<IOSToggle checked={false} onChange={vi.fn()} className="my-class" />);

    const switchButton = container.firstChild as HTMLElement;
    expect(switchButton.className).toContain('my-class');
  });
});
