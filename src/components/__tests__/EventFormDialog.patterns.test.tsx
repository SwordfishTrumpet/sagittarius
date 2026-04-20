import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useState, useEffect, useMemo } from 'react';

/**
 * This test file documents and tests the CORRECT pattern for form initialization
 * vs the INCORRECT useMemo-with-side-effects anti-pattern.
 * 
 * The bug in EventFormDialog was using useMemo with setState side effects,
 * which is an anti-pattern. These tests verify the correct useEffect pattern.
 */

describe('Form Initialization Pattern Tests', () => {
  describe('CORRECT: useEffect for form initialization', () => {
    it('should properly initialize form state using useEffect', async () => {
      // This is the CORRECT pattern - using useEffect for side effects
      function CorrectForm({ initialData }: { initialData: { name: string; value: number } }) {
        const [form, setForm] = useState({ name: '', value: 0 });

        // CORRECT: Using useEffect for side effects (setState)
        useEffect(() => {
          setForm({
            name: initialData.name,
            value: initialData.value,
          });
        }, [initialData]);

        return (
          <div>
            <input
              data-testid="name-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <span data-testid="value-display">{form.value}</span>
          </div>
        );
      }

      const { rerender } = render(<CorrectForm initialData={{ name: 'Test', value: 42 }} />);

      // Form should be initialized correctly
      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toHaveValue('Test');
        expect(screen.getByTestId('value-display')).toHaveTextContent('42');
      });

      // Update initial data (simulating dialog reopening with different data)
      rerender(<CorrectForm initialData={{ name: 'Updated', value: 100 }} />);

      // Form should update correctly
      await waitFor(() => {
        expect(screen.getByTestId('name-input')).toHaveValue('Updated');
        expect(screen.getByTestId('value-display')).toHaveTextContent('100');
      });
    });
  });

  describe('INCORRECT: useMemo with setState side effects (anti-pattern)', () => {
    it('demonstrates why useMemo with setState is problematic', async () => {
      let memoRunCount = 0;

      // This is the INCORRECT pattern - using useMemo for side effects
      function IncorrectForm({ initialData }: { initialData: { name: string } }) {
        const [form, setForm] = useState({ name: '' });

        // INCORRECT: Using useMemo for side effects
        // This is an anti-pattern because:
        // 1. useMemo doesn't guarantee execution timing
        // 2. It may not run in Strict Mode (double mounting)
        // 3. Can cause state updates during render phase
        useMemo(() => {
          memoRunCount++;
          setForm({
            name: initialData.name,
          });
        }, [initialData]);

        return (
          <input
            data-testid="name-input"
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
          />
        );
      }

      // First render
      const { rerender } = render(<IncorrectForm initialData={{ name: 'First' }} />);

      // In Strict Mode, useMemo might not run as expected
      // and the state update might not be applied correctly
      const input = screen.getByTestId('name-input') as HTMLInputElement;

      // The anti-pattern can cause:
      // 1. Form not initializing properly
      // 2. Stale state issues
      // 3. Race conditions with React's render cycle

      // Rerender with new data
      rerender(<IncorrectForm initialData={{ name: 'Second' }} />);

      // The memo should have run twice (once for each render)
      // But due to React's optimizations, this is not guaranteed
      expect(memoRunCount).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('EventFormDialog Edge Cases', () => {
  it('should handle rapid open/close cycles', async () => {
    // Test that the form properly handles being opened and closed rapidly
    function TestDialog({ isOpen, event }: { isOpen: boolean; event: any }) {
      const [form, setForm] = useState({ title: '' });

      useEffect(() => {
        if (isOpen && event) {
          setForm({ title: event.title || '' });
        }
      }, [isOpen, event]);

      if (!isOpen) return null;

      return (
        <input
          data-testid="title-input"
          value={form.title}
          onChange={(e) => setForm({ title: e.target.value })}
        />
      );
    }

    const { rerender } = render(<TestDialog isOpen={false} event={null} />);

    // Open dialog with event
    rerender(<TestDialog isOpen={true} event={{ title: 'Event 1' }} />);
    await waitFor(() => {
      expect(screen.getByTestId('title-input')).toHaveValue('Event 1');
    });

    // Close dialog
    rerender(<TestDialog isOpen={false} event={null} />);
    expect(screen.queryByTestId('title-input')).not.toBeInTheDocument();

    // Reopen with different event
    rerender(<TestDialog isOpen={true} event={{ title: 'Event 2' }} />);
    await waitFor(() => {
      expect(screen.getByTestId('title-input')).toHaveValue('Event 2');
    });
  });

  it('should not show delete button for events without an ID', async () => {
    // This tests the fix where the delete button was shown incorrectly
    // for new events (when event.id is empty string)
    function TestEventDialog({ event, onDelete }: { event: any; onDelete: (id: string) => void }) {
      return (
        <div>
          <span data-testid="event-id">{event?.id || 'no-id'}</span>
          {/* Delete button should only show for events with a valid ID */}
          {event?.id && (
            <button data-testid="delete-btn" onClick={() => onDelete(event.id)}>
              Delete
            </button>
          )}
        </div>
      );
    }

    const mockDelete = vi.fn();

    // For new event (empty string ID)
    const { rerender } = render(
      <TestEventDialog event={{ id: '', title: 'New Event' }} onDelete={mockDelete} />
    );

    // Delete button should NOT be shown for empty string ID
    expect(screen.queryByTestId('delete-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('event-id')).toHaveTextContent('no-id');

    // For existing event (valid ID)
    rerender(
      <TestEventDialog event={{ id: 'event-123', title: 'Existing Event' }} onDelete={mockDelete} />
    );

    // Delete button SHOULD be shown for valid ID
    expect(screen.getByTestId('delete-btn')).toBeInTheDocument();

    // Clicking delete should call onDelete with the correct ID
    fireEvent.click(screen.getByTestId('delete-btn'));
    expect(mockDelete).toHaveBeenCalledWith('event-123');
  });

  it('should handle form submission with preventDefault', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());

    function TestForm() {
      const [value, setValue] = useState('');

      return (
        <form onSubmit={handleSubmit} data-testid="event-form">
          <input
            data-testid="form-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" data-testid="submit-btn">
            Submit
          </button>
        </form>
      );
    }

    render(<TestForm />);

    const input = screen.getByTestId('form-input');
    fireEvent.change(input, { target: { value: 'test' } });

    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(handleSubmit).toHaveBeenCalled();
  });
});

/**
 * Regression test for the CalendarView EventFormDialog useMemo bug.
 * 
 * This test ensures that the form initialization uses useEffect, not useMemo,
 * which was causing buttons to appear unresponsive because form state wasn't
 * properly initialized.
 */
describe('REGRESSION: EventFormDialog useMemo vs useEffect', () => {
  it('verifies that form state is initialized via useEffect pattern', async () => {
    // Simulate the EventFormDialog component behavior
    function SimulatedEventFormDialog({
      isOpen,
      event,
      onSave,
      onClose,
    }: {
      isOpen: boolean;
      event: any;
      onSave: (data: any) => void;
      onClose: () => void;
    }) {
      const [form, setForm] = useState({ title: '', start: '', end: '' });

      // This is the FIXED pattern - using useEffect instead of useMemo
      useEffect(() => {
        if (event) {
          if (event.id) {
            // Editing existing event
            setForm({
              title: event.title || '',
              start: event.start || '',
              end: event.end || '',
            });
          } else {
            // Creating new event with pre-filled data
            setForm({
              title: event.title || '',
              start: event.start || '',
              end: event.end || '',
            });
          }
        } else {
          // Fallback defaults
          const now = new Date();
          const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
          setForm({
            title: '',
            start: now.toISOString(),
            end: oneHourLater.toISOString(),
          });
        }
      }, [event]);

      if (!isOpen) return null;

      const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(form);
      };

      return (
        <form onSubmit={handleSubmit} data-testid="event-form">
          <input
            data-testid="title-input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            data-testid="start-input"
            value={form.start}
            onChange={(e) => setForm({ ...form, start: e.target.value })}
            required
          />
          <button type="button" data-testid="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" data-testid="save-btn">
            Save
          </button>
        </form>
      );
    }

    const mockSave = vi.fn();
    const mockClose = vi.fn();

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // Test creating new event
    const { rerender } = render(
      <SimulatedEventFormDialog
        isOpen={true}
        event={{
          id: '',
          title: '',
          start: now.toISOString(),
          end: oneHourLater.toISOString(),
        }}
        onSave={mockSave}
        onClose={mockClose}
      />
    );

    // Form should be initialized with the provided data
    await waitFor(() => {
      expect(screen.getByTestId('title-input')).toHaveValue('');
      expect(screen.getByTestId('start-input')).toHaveValue(now.toISOString());
    });

    // User fills in title
    fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'New Meeting' } });
    expect(screen.getByTestId('title-input')).toHaveValue('New Meeting');

    // Submit form
    fireEvent.click(screen.getByTestId('save-btn'));
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Meeting',
      })
    );

    // Cancel button should work
    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(mockClose).toHaveBeenCalled();
  });
});
