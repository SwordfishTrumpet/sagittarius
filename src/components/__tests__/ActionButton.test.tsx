import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionButton } from '../ActionButton';

describe('ActionButton', () => {
  it('renders icon and label', () => {
    render(<ActionButton icon={<span data-testid="icon" />} label="Send" />);

    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ActionButton icon={<span />} label="Send" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sets aria-pressed when pressed is true', () => {
    render(<ActionButton icon={<span />} label="Bold" pressed />);

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sets aria-pressed when pressed is false', () => {
    render(<ActionButton icon={<span />} label="Bold" pressed={false} />);

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables the button when disabled', () => {
    render(<ActionButton icon={<span />} label="Send" disabled />);

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('applies focus ring styles', () => {
    render(<ActionButton icon={<span />} label="Reply" />);

    const button = screen.getByRole('button', { name: 'Reply' });
    expect(button.className).toContain('focus:ring-2');
    expect(button.className).toContain('focus:ring-icloud-accent');
  });

  it('has minimum touch target size', () => {
    render(<ActionButton icon={<span />} label="Reply" />);

    const button = screen.getByRole('button', { name: 'Reply' });
    expect(button.className).toContain('min-w-[44px]');
    expect(button.className).toContain('min-h-[44px]');
  });
});
