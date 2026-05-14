import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareIndicator } from '../ShareIndicator';

describe('ShareIndicator', () => {
  it('renders nothing when shareWithCount is 0 and not shared with me', () => {
    const { container } = render(<ShareIndicator shareWithCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders count when shareWithCount > 0', () => {
    render(<ShareIndicator shareWithCount={3} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders shared with you text', () => {
    render(<ShareIndicator shareWithCount={0} isSharedWithMe />);
    expect(screen.getByText('Shared with you')).toBeTruthy();
  });

  it('shows shared with you when isSharedWithMe is true and count > 0', () => {
    render(<ShareIndicator shareWithCount={5} isSharedWithMe />);
    expect(screen.getByText('Shared with you')).toBeTruthy();
  });

  it('has role status for accessibility', () => {
    render(<ShareIndicator shareWithCount={1} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
