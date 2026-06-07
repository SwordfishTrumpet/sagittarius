import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useRef } from 'react';
import { useResizablePane } from '../useResizablePane';

// Mock setPointerCapture and releasePointerCapture
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn((_pointerId: number) => {});
  Element.prototype.releasePointerCapture = vi.fn((_pointerId: number) => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Test harness component
function ResizablePaneHarness() {
  const handleRef = useRef<HTMLDivElement>(null);
  const { width, isDragging, minWidth, maxWidth, setWidth, adjustWidth, handlePointerDown } = useResizablePane({
    storageKey: 'test_resizable_pane',
    defaultWidth: 300,
    minWidth: 200,
    maxWidth: 500,
  });

  return (
    <div data-testid="container">
      <div
        data-testid="pane"
        style={{ width: `${width}px` }}
      >
        Pane Content
      </div>
      <div
        ref={handleRef}
        data-testid="resize-handle"
        onPointerDown={handlePointerDown}
        style={{ cursor: 'col-resize' }}
      >
        Handle
      </div>
      <div data-testid="state">
        <span data-testid="width">{width}</span>
        <span data-testid="isDragging">{isDragging ? 'true' : 'false'}</span>
        <span data-testid="minWidth">{minWidth}</span>
        <span data-testid="maxWidth">{maxWidth}</span>
      </div>
      <button data-testid="setWidth" onClick={() => setWidth(350)}>Set Width 350</button>
      <button data-testid="adjustWidth" onClick={() => adjustWidth(20)}>Adjust +20</button>
      <button data-testid="adjustWidthNegative" onClick={() => adjustWidth(-50)}>Adjust -50</button>
    </div>
  );
}

describe('useResizablePane', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with default width', () => {
    render(<ResizablePaneHarness />);
    expect(screen.getByTestId('width').textContent).toBe('300');
  });

  it('respects min and max width constraints', () => {
    render(<ResizablePaneHarness />);
    expect(screen.getByTestId('minWidth').textContent).toBe('200');
    expect(screen.getByTestId('maxWidth').textContent).toBe('500');
  });

  it('sets width via setWidth', async () => {
    render(<ResizablePaneHarness />);
    fireEvent.click(screen.getByTestId('setWidth'));
    await waitFor(() => {
      expect(screen.getByTestId('width').textContent).toBe('350');
    });
  });

  it('adjusts width via adjustWidth', async () => {
    render(<ResizablePaneHarness />);
    // Start at 300, add 20 = 320
    fireEvent.click(screen.getByTestId('adjustWidth'));
    await waitFor(() => {
      expect(screen.getByTestId('width').textContent).toBe('320');
    });
  });

  it('clamps width to min when adjusting below minimum', async () => {
    render(<ResizablePaneHarness />);
    // Start at 300, subtract 50 = 250 (above min of 200)
    fireEvent.click(screen.getByTestId('adjustWidthNegative'));
    await waitFor(() => {
      expect(screen.getByTestId('width').textContent).toBe('250');
    });

    // Subtract another 100 would go to 150, but min is 200
    fireEvent.click(screen.getByTestId('adjustWidthNegative'));
    fireEvent.click(screen.getByTestId('adjustWidthNegative'));
    await waitFor(() => {
      expect(screen.getByTestId('width').textContent).toBe('200');
    });
  });

  it('clamps width to max when setting above maximum', async () => {
    render(<ResizablePaneHarness />);
    // Try to set to 600, but max is 500
    const setWidthButton = screen.getByTestId('setWidth');
    // Override the onClick to set a value above max
    fireEvent.click(setWidthButton);
    await waitFor(() => {
      expect(screen.getByTestId('width').textContent).toBe('350');
    });

    // Now let's test the clamp by using setWidth directly with a high value
    // We'll simulate this by rendering a new component with a button that sets width to 600
    function HighWidthSetter() {
      const { width, setWidth } = useResizablePane({
        storageKey: 'test_resizable_pane_high',
        defaultWidth: 300,
        minWidth: 200,
        maxWidth: 500,
      });
      return (
        <div>
          <span data-testid="highWidth">{width}</span>
          <button data-testid="setHigh" onClick={() => setWidth(600)}>Set 600</button>
        </div>
      );
    }
    const { unmount } = render(<HighWidthSetter />);
    fireEvent.click(screen.getByTestId('setHigh'));
    await waitFor(() => {
      expect(screen.getByTestId('highWidth').textContent).toBe('500');
    });
    unmount();
  });

  it('persists width to localStorage', async () => {
    render(<ResizablePaneHarness />);
    fireEvent.click(screen.getByTestId('setWidth'));
    await waitFor(() => {
      expect(localStorage.getItem('test_resizable_pane')).toBe('350');
    });
  });

  it('restores width from localStorage on mount', () => {
    localStorage.setItem('test_resizable_pane', '400');
    render(<ResizablePaneHarness />);
    expect(screen.getByTestId('width').textContent).toBe('400');
  });

  it('ignores invalid localStorage values', () => {
    localStorage.setItem('test_resizable_pane', 'invalid');
    render(<ResizablePaneHarness />);
    expect(screen.getByTestId('width').textContent).toBe('300');
  });

  it('ignores localStorage values outside min/max bounds', () => {
    localStorage.setItem('test_resizable_pane', '100');
    render(<ResizablePaneHarness />);
    expect(screen.getByTestId('width').textContent).toBe('300');
  });

  it('starts dragging on pointer down', async () => {
    render(<ResizablePaneHarness />);
    const handle = screen.getByTestId('resize-handle');
    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    await waitFor(() => {
      expect(screen.getByTestId('isDragging').textContent).toBe('true');
    });
  });

  it('stops dragging on pointer up', async () => {
    render(<ResizablePaneHarness />);
    const handle = screen.getByTestId('resize-handle');
    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    await waitFor(() => {
      expect(screen.getByTestId('isDragging').textContent).toBe('true');
    });

    fireEvent.pointerUp(handle, { pointerId: 1 });
    await waitFor(() => {
      expect(screen.getByTestId('isDragging').textContent).toBe('false');
    });
  });
});
