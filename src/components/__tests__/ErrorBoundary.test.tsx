import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { logger } from '../../utils/logger';

// Mock logger to avoid console noise
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div data-testid="child">Normal child content</div>;
};

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('catches errors and displays fallback UI', () => {
    // Suppress console.error for the expected React error boundary log
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('shows Try Again button that resets error state', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // First rerender with a non-throwing child while boundary is still in error state
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    // Boundary still shows fallback until we click Try Again
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    // Now the boundary resets and shows the new non-throwing child
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('logs error to logger when an error is caught', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'ErrorBoundary caught:',
      expect.objectContaining({ message: 'Test error message' }),
      expect.anything()
    );

    consoleSpy.mockRestore();
  });
});
