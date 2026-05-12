import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseDialog } from '../BaseDialog';

describe('BaseDialog', () => {
  it('does not render when isOpen is false', () => {
    render(
      <BaseDialog isOpen={false} onClose={vi.fn()} title="Test Dialog" titleId="test-title">
        <div data-testid="dialog-content">Content</div>
      </BaseDialog>
    );

    expect(screen.queryByTestId('dialog-content')).not.toBeInTheDocument();
  });

  it('renders children and title when isOpen is true', () => {
    render(
      <BaseDialog isOpen={true} onClose={vi.fn()} title="Test Dialog" titleId="test-title">
        <div data-testid="dialog-content">Content</div>
      </BaseDialog>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <BaseDialog isOpen={true} onClose={onClose} title="Test Dialog" titleId="test-title">
        <div>Content</div>
      </BaseDialog>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has correct ARIA attributes', () => {
    render(
      <BaseDialog isOpen={true} onClose={vi.fn()} title="Test Dialog" titleId="test-title">
        <div>Content</div>
      </BaseDialog>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'test-title');
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });

  it('renders title with correct id for aria-labelledby', () => {
    render(
      <BaseDialog isOpen={true} onClose={vi.fn()} title="Accessible Title" titleId="accessible-title">
        <div>Content</div>
      </BaseDialog>
    );

    const title = screen.getByText('Accessible Title');
    expect(title).toHaveAttribute('id', 'accessible-title');
  });
});
