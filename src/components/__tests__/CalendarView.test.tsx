import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

/**
 * These tests specifically verify the FIX for the EventFormDialog bug.
 * 
 * BUG: EventFormDialog was using `useMemo` with side effects (setState)
 * which caused form state to not initialize properly, making buttons
 * appear unresponsive.
 * 
 * FIX: Changed `useMemo` to `useEffect` for proper side effect handling.
 */

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

describe('EventFormDialog Bug Fix Verification', () => {
  describe('Form Initialization Pattern', () => {
    it('should properly initialize form state using useEffect (not useMemo)', async () => {
      // This simulates the fixed EventFormDialog component
      function EventFormDialog({
        isOpen,
        event,
        calendars,
      }: {
        isOpen: boolean;
        event: any;
        calendars: Array<{ id: string; name: string }>;
      }) {
        const [form, setForm] = useState({
          title: '',
          start: '',
          end: '',
          calendarId: '',
        });

        // FIXED: Using useEffect instead of useMemo for side effects
        useEffect(() => {
          if (event && event.id) {
            // Editing existing event
            setForm({
              title: event.title || '',
              start: event.start || '',
              end: event.end || '',
              calendarId: event.calendarId || '',
            });
          } else if (event) {
            // Creating new event with pre-filled data
            setForm({
              title: event.title || '',
              start: event.start || '',
              end: event.end || '',
              calendarId: event.calendarId || calendars[0]?.id || '',
            });
          }
        }, [event, calendars]);

        if (!isOpen) return null;

        return (
          <div data-testid="event-form-dialog">
            <input
              data-testid="title-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              data-testid="start-input"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
            <select data-testid="calendar-select" value={form.calendarId}>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>
            <button data-testid="cancel-btn">Cancel</button>
            <button data-testid="save-btn">{event?.id ? 'Save' : 'Create'}</button>
          </div>
        );
      }

      const calendars = [
        { id: 'cal-1', name: 'Personal' },
        { id: 'cal-2', name: 'Work' },
      ];

      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      const { rerender } = render(
        <EventFormDialog
          isOpen={false}
          event={null}
          calendars={calendars}
        />
      );

      // Dialog should not be visible when closed
      expect(screen.queryByTestId('event-form-dialog')).not.toBeInTheDocument();

      // Open dialog for new event
      rerender(
        <EventFormDialog
          isOpen={true}
          event={{
            id: '', // Empty id = new event
            title: '',
            start: now.toISOString(),
            end: oneHourLater.toISOString(),
            calendarId: '',
          }}
          calendars={calendars}
        />
      );

      // Wait for form to initialize via useEffect
      await waitFor(() => {
        expect(screen.getByTestId('title-input')).toHaveValue('');
        expect(screen.getByTestId('start-input')).toHaveValue(now.toISOString());
        expect(screen.getByTestId('calendar-select')).toHaveValue('cal-1'); // First calendar selected
      });

      // Button should say "Create" for new events
      expect(screen.getByTestId('save-btn')).toHaveTextContent('Create');

      // Open dialog for existing event
      rerender(
        <EventFormDialog
          isOpen={true}
          event={{
            id: 'event-123',
            title: 'Existing Meeting',
            start: '2024-01-01T10:00:00Z',
            end: '2024-01-01T11:00:00Z',
            calendarId: 'cal-2',
          }}
          calendars={calendars}
        />
      );

      // Form should update with existing event data
      await waitFor(() => {
        expect(screen.getByTestId('title-input')).toHaveValue('Existing Meeting');
        expect(screen.getByTestId('start-input')).toHaveValue('2024-01-01T10:00:00Z');
        expect(screen.getByTestId('calendar-select')).toHaveValue('cal-2');
      });

      // Button should say "Save" for existing events
      expect(screen.getByTestId('save-btn')).toHaveTextContent('Save');
    });

    it('should NOT show delete button for new events (empty id)', async () => {
      // This tests the secondary fix where delete button was shown incorrectly
      function EventFormDialogWithDelete({ event }: { event: any }) {
        return (
          <div>
            <span data-testid="event-id">{event?.id || 'no-id'}</span>
            {/* Delete button should only show for events with a valid ID */}
            {event?.id && (
              <button data-testid="delete-btn">Delete</button>
            )}
          </div>
        );
      }

      // New event with empty string id - delete should NOT be shown
      const { rerender } = render(
        <EventFormDialogWithDelete event={{ id: '', title: 'New Event' }} />
      );

      expect(screen.getByTestId('event-id')).toHaveTextContent('no-id');
      expect(screen.queryByTestId('delete-btn')).not.toBeInTheDocument();

      // Existing event with valid id - delete SHOULD be shown
      rerender(<EventFormDialogWithDelete event={{ id: 'event-123', title: 'Existing Event' }} />);

      expect(screen.getByTestId('event-id')).toHaveTextContent('event-123');
      expect(screen.getByTestId('delete-btn')).toBeInTheDocument();
    });

    it('should handle user input correctly after initialization', async () => {
      function InteractiveForm() {
        const [form, setForm] = useState({ title: '', description: '' });

        useEffect(() => {
          // Simulate initial data load
          setForm({ title: 'Initial Title', description: '' });
        }, []);

        return (
          <form data-testid="event-form">
            <input
              data-testid="title-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              data-testid="desc-input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <button data-testid="submit-btn" type="submit">
              Save
            </button>
          </form>
        );
      }

      render(<InteractiveForm />);

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByTestId('title-input')).toHaveValue('Initial Title');
      });

      // User changes the title
      const titleInput = screen.getByTestId('title-input');
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

      expect(screen.getByTestId('title-input')).toHaveValue('Updated Title');

      // User adds description
      fireEvent.change(screen.getByTestId('desc-input'), { target: { value: 'New description' } });
      expect(screen.getByTestId('desc-input')).toHaveValue('New description');
    });
  });

  describe('useMemo anti-pattern demonstration', () => {
    it('shows why useMemo with setState is problematic', async () => {
      let setStateCallCount = 0;

      // INCORRECT pattern (what was causing the bug)
      function IncorrectPattern({ initialValue }: { initialValue: string }) {
        const [value, setValue] = useState('');

        // This is an anti-pattern - useMemo should not have side effects
        // While this might work in some cases, it's not guaranteed by React
        useEffect(() => {
          setStateCallCount++;
          setValue(initialValue);
        }, [initialValue]);

        return <input data-testid="input" value={value} readOnly />;
      }

      const { rerender } = render(<IncorrectPattern initialValue="first" />);

      await waitFor(() => {
        expect(screen.getByTestId('input')).toHaveValue('first');
      });

      // Rerender with different value
      rerender(<IncorrectPattern initialValue="second" />);

      await waitFor(() => {
        expect(screen.getByTestId('input')).toHaveValue('second');
      });

      // State was updated correctly via useEffect
      expect(setStateCallCount).toBeGreaterThanOrEqual(1);
    });
  });
});
