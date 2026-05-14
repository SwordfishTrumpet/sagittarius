import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareDialog } from '../dialogs/ShareDialog';

describe('ShareDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnSearch = vi.fn().mockResolvedValue([
    { id: 'p1', name: 'Alice', email: 'alice@example.com', type: 'individual' as const },
    { id: 'p2', name: 'Bob', email: 'bob@example.com', type: 'individual' as const },
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(
      <ShareDialog
        isOpen={true}
        onClose={mockOnClose}
        title="Share Calendar"
        currentShareWith={null}
        onSave={mockOnSave}
        onSearch={mockOnSearch}
      />
    );
    expect(screen.getByText('Share Calendar')).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <ShareDialog
        isOpen={false}
        onClose={mockOnClose}
        title="Share Calendar"
        currentShareWith={null}
        onSave={mockOnSave}
        onSearch={mockOnSearch}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows existing shares', () => {
    render(
      <ShareDialog
        isOpen={true}
        onClose={mockOnClose}
        title="Share"
        currentShareWith={{ 'p1': { mayRead: true, mayWrite: false, mayAdmin: false } }}
        onSave={mockOnSave}
        onSearch={mockOnSearch}
      />
    );
    expect(screen.getByText('p1')).toBeTruthy();
  });

  it('shows empty state when no one has access', () => {
    render(
      <ShareDialog
        isOpen={true}
        onClose={mockOnClose}
        title="Share"
        currentShareWith={null}
        onSave={mockOnSave}
        onSearch={mockOnSearch}
      />
    );
    expect(screen.getByText('No one has access yet')).toBeTruthy();
  });

  it('has search input with aria-autocomplete', () => {
    render(
      <ShareDialog
        isOpen={true}
        onClose={mockOnClose}
        title="Share"
        currentShareWith={null}
        onSave={mockOnSave}
        onSearch={mockOnSearch}
      />
    );
    const input = screen.getByRole('combobox');
    expect(input).toBeTruthy();
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('calls onSave and onClose on save', () => {
    render(
      <ShareDialog
        isOpen={true}
        onClose={mockOnClose}
        title="Share"
        currentShareWith={null}
        onSave={mockOnSave}
        onSearch={mockOnSearch}
      />
    );
    fireEvent.click(screen.getByText('Save'));
    expect(mockOnSave).toHaveBeenCalledWith({});
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose on cancel', () => {
    render(
      <ShareDialog
        isOpen={true}
        onClose={mockOnClose}
        title="Share"
        currentShareWith={null}
        onSave={mockOnSave}
        onSearch={mockOnSearch}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
