import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SmimeBadge } from '../SmimeBadge';

describe('SmimeBadge', () => {
  it('renders nothing when status is none', () => {
    const { container } = render(<SmimeBadge status="none" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is undefined', () => {
    const { container } = render(<SmimeBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('renders signed status', () => {
    render(<SmimeBadge status="signed" />);
    expect(screen.getByText('Signed')).toBeTruthy();
  });

  it('renders verified status with certificate subject', () => {
    render(<SmimeBadge status="verified" certificate={{ subject: 'CN=Alice', issuer: 'CN=CA' }} />);
    expect(screen.getByText(/Verified: CN=Alice/)).toBeTruthy();
  });

  it('renders verified status without certificate', () => {
    render(<SmimeBadge status="verified" />);
    expect(screen.getByText(/Verified: Unknown/)).toBeTruthy();
  });

  it('renders failed status', () => {
    render(<SmimeBadge status="failed" />);
    expect(screen.getByText('Signature verification failed')).toBeTruthy();
  });

  it('renders invalid status', () => {
    render(<SmimeBadge status="invalid" />);
    expect(screen.getByText('Invalid signature')).toBeTruthy();
  });

  it('has role="status" for accessibility', () => {
    render(<SmimeBadge status="signed" />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('applies custom class name', () => {
    const { container } = render(<SmimeBadge status="signed" />);
    expect(container.firstChild).toHaveClass('text-icloud-accent');
  });
});
