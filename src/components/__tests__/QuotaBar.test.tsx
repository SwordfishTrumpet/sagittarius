import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuotaBar } from '../QuotaBar';

describe('QuotaBar', () => {
  it('should render quota bar with correct percentage', () => {
    render(<QuotaBar used={500000000} total={1000000000} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('should format bytes correctly', () => {
    render(<QuotaBar used={500} total={1000} />);
    expect(screen.getByText(/500 B/)).toBeInTheDocument();
  });

  it('should format KB correctly', () => {
    render(<QuotaBar used={5120} total={10240} />);
    expect(screen.getByText(/5.0 KB/)).toBeInTheDocument();
  });

  it('should format MB correctly', () => {
    render(<QuotaBar used={5242880} total={10485760} />);
    expect(screen.getByText(/5.0 MB/)).toBeInTheDocument();
  });

  it('should format GB correctly', () => {
    render(<QuotaBar used={1073741824} total={2147483648} />);
    expect(screen.getByText(/1.00 GB/)).toBeInTheDocument();
  });

  it('should show critical state when > 90% full', () => {
    render(<QuotaBar used={950000000} total={1000000000} />);
    expect(screen.getByText(/Almost full/)).toBeInTheDocument();
  });

  it('should not show critical state when < 90% full', () => {
    render(<QuotaBar used={800000000} total={1000000000} />);
    expect(screen.queryByText(/Almost full/)).not.toBeInTheDocument();
  });

  it('should cap percentage at 100%', () => {
    render(<QuotaBar used={2000000000} total={1000000000} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');
  });

  it('should return null when total is 0', () => {
    const { container } = render(<QuotaBar used={100} total={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('should have correct accessibility attributes', () => {
    render(<QuotaBar used={500000000} total={1000000000} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-label');
  });

  it('should display usage label', () => {
    render(<QuotaBar used={500000000} total={1000000000} />);
    expect(screen.getByText(/of/)).toBeInTheDocument();
    expect(screen.getByText(/used/)).toBeInTheDocument();
  });
});
