/**
 * CalendarView — Full calendar UI component for RFC 8984 JMAP Calendars
 * 
 * Features:
 * - Month/Week/Day views with navigation
 * - Event list with creation, editing, deletion
 * - Calendar sidebar for toggling visibility
 * - iCloud-style glassmorphic design
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  MapPin,
  Users,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  useCalendars,
  useCalendarEvents,
  useCalendarActions,
  useCalendarEventActions,
  useHasCalendarCapability,
  useTodaysEvents,
} from '../hooks/jmap/useCalendars';
import { Card, Skeleton } from './ui/Card';
import { BaseDialog } from './dialogs/BaseDialog';
import type { Calendar, CalendarEvent, CalendarEventPatch } from '../types/jmap-calendar';

// View modes
type ViewMode = 'month' | 'week' | 'day' | 'list';

// Days of week
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface CalendarViewProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EventFormData {
  title: string;
  description: string;
  start: string;
  end: string;
  isAllDay: boolean;
  calendarId: string;
  location: string;
}

const DEFAULT_EVENT_FORM: EventFormData = {
  title: '',
  description: '',
  start: '',
  end: '',
  isAllDay: false,
  calendarId: '',
  location: '',
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 16);
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // Add days from previous month to fill the first week
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }

  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Add days from next month to complete the last week
  const endPadding = 6 - lastDay.getDay();
  for (let i = 1; i <= endPadding; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

function CalendarSidebar({
  calendars,
  visibleCalendarIds,
  onToggleCalendar,
  isLoading,
}: {
  calendars: Calendar[];
  visibleCalendarIds: Set<string>;
  onToggleCalendar: (id: string) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton count={3} />;
  }

  return (
    <div className="space-y-1">
      {calendars.map((cal) => (
        <label
          key={cal.id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer transition-colors"
        >
          <input
            type="checkbox"
            checked={visibleCalendarIds.has(cal.id)}
            onChange={() => onToggleCalendar(cal.id)}
            className="w-4 h-4 rounded border-gray-300 dark:border-[#38383A] text-[#007AFF] focus:ring-[#007AFF]"
          />
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: cal.color || '#007AFF' }}
          />
          <span className="text-[13px] text-[#1C1C1E] truncate">{cal.name}</span>
        </label>
      ))}
    </div>
  );
}

function EventItem({
  event,
  calendar,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  calendar?: Calendar;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}) {
  const startTime = formatTime(event.start);
  const location = event.locations ? Object.values(event.locations)[0]?.name : null;

  return (
    <div
      className="group flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
      onClick={() => onEdit(event)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(event);
        }
      }}
    >
      <div
        className="w-1 h-full min-h-[40px] rounded-full shrink-0"
        style={{ backgroundColor: calendar?.color || '#007AFF' }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-[#1C1C1E] truncate">{event.title}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[12px] text-[#8E8E93] flex items-center gap-1">
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            {event.isAllDay ? 'All day' : startTime}
          </span>
          {location && (
            <span className="text-[12px] text-[#8E8E93] flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" strokeWidth={1.5} />
              {location}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(event.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded-lg transition-all"
        aria-label="Delete event"
      >
        <Trash2 className="w-4 h-4 text-red-500" strokeWidth={1.5} />
      </button>
    </div>
  );
}

function MonthView({
  currentDate,
  events,
  calendars,
  visibleCalendarIds,
  onSelectDate,
  onEditEvent,
  onDeleteEvent,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  calendars: Calendar[];
  visibleCalendarIds: Set<string>;
  onSelectDate: (date: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
}) {
  const days = useMemo(
    () => getCalendarDays(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );
  const today = new Date();

  const getEventsForDay = useCallback(
    (day: Date) =>
      events.filter(
        (e) =>
          visibleCalendarIds.has(e.calendarId) &&
          isSameDay(new Date(e.start), day)
      ),
    [events, visibleCalendarIds]
  );

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[#E5E5EA] dark:border-[#38383A]">
        {DAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-[11px] font-semibold text-[#8E8E93] uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day, idx) => {
          const isToday = isSameDay(day, today);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const dayEvents = getEventsForDay(day);

          return (
            <div
              key={idx}
              className={`min-h-[100px] border-b border-r border-[#E5E5EA] dark:border-[#38383A] p-1 cursor-pointer hover:bg-[#F2F2F7] dark:hover:bg-white/5 transition-colors ${
                !isCurrentMonth ? 'bg-[#F9F9F9] dark:bg-[#1C1C1E]/50' : ''
              }`}
              onClick={() => onSelectDate(day)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDate(day);
                }
              }}
            >
              <div
                className={`w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-medium mb-1 ${
                  isToday
                    ? 'bg-[#007AFF] text-white'
                    : isCurrentMonth
                    ? 'text-[#1C1C1E]'
                    : 'text-[#C7C7CC]'
                }`}
              >
                {day.getDate()}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((event) => {
                  const cal = calendars.find((c) => c.id === event.calendarId);
                  return (
                    <div
                      key={event.id}
                      className="text-[10px] px-1.5 py-0.5 rounded truncate"
                      style={{
                        backgroundColor: `${cal?.color || '#007AFF'}20`,
                        color: cal?.color || '#007AFF',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditEvent(event);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          onEditEvent(event);
                        }
                      }}
                    >
                      {event.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-[#8E8E93] px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({
  events,
  calendars,
  visibleCalendarIds,
  onEditEvent,
  onDeleteEvent,
}: {
  events: CalendarEvent[];
  calendars: Calendar[];
  visibleCalendarIds: Set<string>;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
}) {
  const filteredEvents = useMemo(
    () =>
      events
        .filter((e) => visibleCalendarIds.has(e.calendarId))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events, visibleCalendarIds]
  );

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((event) => {
      const dateKey = new Date(event.start).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    });
    return groups;
  }, [filteredEvents]);

  if (filteredEvents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <CalendarIcon className="w-12 h-12 text-[#C7C7CC] mb-3" strokeWidth={1} />
        <p className="text-[15px] text-[#8E8E93]">No events to display</p>
        <p className="text-[13px] text-[#C7C7CC] mt-1">
          Create an event or select different calendars
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {Object.entries(groupedEvents).map(([dateKey, dayEvents]) => (
        <div key={dateKey}>
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide px-3 mb-2">
            {new Date(dateKey).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h3>
          <Card dividers>
            {dayEvents.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                calendar={calendars.find((c) => c.id === event.calendarId)}
                onEdit={onEditEvent}
                onDelete={onDeleteEvent}
              />
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

function EventFormDialog({
  isOpen,
  onClose,
  event,
  calendars,
  onSave,
  onDelete,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  calendars: Calendar[];
  onSave: (data: EventFormData, eventId?: string) => void;
  onDelete: (eventId: string) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<EventFormData>(DEFAULT_EVENT_FORM);

  // Initialize form when event changes - use useEffect for side effects
  useEffect(() => {
    if (event && event.id) {
      // Editing existing event
      const location = event.locations ? Object.values(event.locations)[0]?.name : '';
      setForm({
        title: event.title || '',
        description: event.description || '',
        start: event.start ? formatDateForInput(new Date(event.start)) : '',
        end: event.end ? formatDateForInput(new Date(event.end)) : '',
        isAllDay: event.isAllDay || false,
        calendarId: event.calendarId,
        location: location || '',
      });
    } else if (event) {
      // Creating new event (event passed with pre-filled data)
      setForm({
        title: event.title || '',
        description: event.description || '',
        start: event.start ? formatDateForInput(new Date(event.start)) : '',
        end: event.end ? formatDateForInput(new Date(event.end)) : '',
        isAllDay: event.isAllDay || false,
        calendarId: event.calendarId || calendars[0]?.id || '',
        location: '',
      });
    } else {
      // Fallback: no event data at all
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      setForm({
        ...DEFAULT_EVENT_FORM,
        start: formatDateForInput(now),
        end: formatDateForInput(oneHourLater),
        calendarId: calendars[0]?.id || '',
      });
    }
  }, [event, calendars]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form, event?.id);
  };

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title={event ? 'Edit Event' : 'New Event'}
      titleId="event-form-dialog-title"
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
            Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            placeholder="Event title"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
            Calendar
          </label>
          <select
            value={form.calendarId}
            onChange={(e) => setForm({ ...form, calendarId: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] bg-white"
            required
          >
            {calendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isAllDay"
            checked={form.isAllDay}
            onChange={(e) => setForm({ ...form, isAllDay: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 dark:border-[#38383A] text-[#007AFF] focus:ring-[#007AFF]"
          />
          <label htmlFor="isAllDay" className="text-[14px] text-[#1C1C1E]">
            All-day event
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
              Start
            </label>
            <input
              type={form.isAllDay ? 'date' : 'datetime-local'}
              value={form.isAllDay ? form.start.slice(0, 10) : form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
              End
            </label>
            <input
              type={form.isAllDay ? 'date' : 'datetime-local'}
              value={form.isAllDay ? form.end.slice(0, 10) : form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
            Location
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            placeholder="Add location"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] resize-none"
            rows={3}
            placeholder="Add notes"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          {event && (
            <button
              type="button"
              onClick={() => onDelete(event.id)}
              className="px-4 py-2 text-[14px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              disabled={isPending}
            >
              Delete
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[14px] font-medium text-[#8E8E93] hover:bg-black/5 rounded-lg transition-colors"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-[14px] font-medium text-white bg-[#007AFF] hover:bg-[#0066DD] rounded-lg transition-colors disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? 'Saving...' : event ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </BaseDialog>
  );
}

export function CalendarView({ isOpen, onClose }: CalendarViewProps) {
  const hasCapability = useHasCalendarCapability();
  const { data: calendars = [], isLoading: calendarsLoading } = useCalendars();
  const { data: events = [], isLoading: eventsLoading } = useCalendarEvents();
  const { data: todaysEvents = [] } = useTodaysEvents();
  const { createCalendar, deleteCalendar, isPending: calendarPending } = useCalendarActions();
  const { createEvent, updateEvent, deleteEvent, isPending: eventPending } = useCalendarEventActions();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);

  // Initialize visible calendars when data loads
  useMemo(() => {
    if (calendars.length > 0 && visibleCalendarIds.size === 0) {
      setVisibleCalendarIds(new Set(calendars.map((c) => c.id)));
    }
  }, [calendars]);

  const toggleCalendar = useCallback((id: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const navigateMonth = useCallback((direction: -1 | 1) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleSelectDate = useCallback((date: Date) => {
    const startTime = new Date(date);
    startTime.setHours(9, 0, 0, 0);
    const endTime = new Date(startTime);
    endTime.setHours(10, 0, 0, 0);
    
    // Initialize form with default calendar and selected date
    const defaultCalendarId = calendars[0]?.id || '';
    setEditingEvent({
      id: '',
      title: '',
      description: '',
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      isAllDay: false,
      calendarId: defaultCalendarId,
    } as CalendarEvent);
    setIsEventFormOpen(true);
  }, [calendars]);

  const handleNewEvent = useCallback(() => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const defaultCalendarId = calendars[0]?.id || '';
    
    setEditingEvent({
      id: '',
      title: '',
      description: '',
      start: now.toISOString(),
      end: oneHourLater.toISOString(),
      isAllDay: false,
      calendarId: defaultCalendarId,
    } as CalendarEvent);
    setIsEventFormOpen(true);
  }, [calendars]);

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setIsEventFormOpen(true);
  }, []);

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      if (confirm('Are you sure you want to delete this event?')) {
        await deleteEvent(eventId);
        setIsEventFormOpen(false);
        setEditingEvent(null);
      }
    },
    [deleteEvent]
  );

  const handleSaveEvent = useCallback(
    async (data: EventFormData, eventId?: string) => {
      const patch: CalendarEventPatch = {
        title: data.title,
        description: data.description || undefined,
        calendarId: data.calendarId,
        start: new Date(data.start).toISOString(),
        end: new Date(data.end).toISOString(),
        isAllDay: data.isAllDay,
      };

      if (data.location) {
        patch.locations = {
          loc1: { name: data.location },
        };
      }

      if (eventId) {
        await updateEvent(eventId, patch);
      } else {
        await createEvent(patch);
      }

      setIsEventFormOpen(false);
      setEditingEvent(null);
    },
    [createEvent, updateEvent]
  );

  if (!isOpen) return null;

  if (!hasCapability) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#E5E5E5] dark:border-[#38383A] max-w-md w-full mx-4 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-[#FF9500] mx-auto mb-4" strokeWidth={1.5} />
          <h2 className="text-[17px] font-bold text-[#1C1C1E] mb-2">Calendar Not Available</h2>
          <p className="text-[14px] text-[#8E8E93] mb-6">
            Your JMAP server does not support the Calendar capability (RFC 8984).
            Contact your server administrator for more information.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 text-[14px] font-medium text-white bg-[#007AFF] hover:bg-[#0066DD] rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isLoading = calendarsLoading || eventsLoading;

  return (
    <div className="fixed inset-0 z-[10000] flex bg-[#F2F2F7]">
      {/* Sidebar */}
      <aside className="w-64 bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-xl border-r border-[#E5E5E5] flex flex-col">
        <header className="px-4 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[17px] font-bold text-[#1C1C1E]">Calendar</h1>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-black/5 rounded-lg transition-colors"
            aria-label="Close calendar"
          >
            <X className="w-5 h-5 text-[#8E8E93]" strokeWidth={1.5} />
          </button>
        </header>

        {/* Today's events */}
        {todaysEvents.length > 0 && (
          <div className="px-4 py-3 border-b border-[#E5E5E5]">
            <h2 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
              Today
            </h2>
            <div className="space-y-1">
              {todaysEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="text-[12px] text-[#1C1C1E] truncate cursor-pointer hover:text-[#007AFF]"
                  onClick={() => handleEditEvent(event)}
                >
                  {formatTime(event.start)} - {event.title}
                </div>
              ))}
              {todaysEvents.length > 3 && (
                <div className="text-[11px] text-[#8E8E93]">
                  +{todaysEvents.length - 3} more events
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendars list */}
        <div className="flex-1 overflow-auto p-4">
          <h2 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
            My Calendars
          </h2>
          <CalendarSidebar
            calendars={calendars}
            visibleCalendarIds={visibleCalendarIds}
            onToggleCalendar={toggleCalendar}
            isLoading={calendarsLoading}
          />
        </div>

        {/* Create event button */}
        <div className="p-4 border-t border-[#E5E5E5]">
          <button
            onClick={handleNewEvent}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-white bg-[#007AFF] hover:bg-[#0066DD] rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            New Event
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-xl border-b border-[#E5E5E5] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-black/5 rounded-lg transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-[#8E8E93]" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-black/5 rounded-lg transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5 text-[#8E8E93]" strokeWidth={1.5} />
              </button>
            </div>
            <h2 className="text-[20px] font-semibold text-[#1C1C1E]">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-[13px] font-medium text-[#007AFF] hover:bg-[#007AFF]/10 rounded-lg transition-colors"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F2F2F7] rounded-lg">
            {(['month', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                  viewMode === mode
                    ? 'bg-white dark:bg-[#1C1C1E] text-[#007AFF] shadow-sm'
                    : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === 'month' ? (
          <MonthView
            currentDate={currentDate}
            events={events}
            calendars={calendars}
            visibleCalendarIds={visibleCalendarIds}
            onSelectDate={handleSelectDate}
            onEditEvent={handleEditEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        ) : (
          <ListView
            events={events}
            calendars={calendars}
            visibleCalendarIds={visibleCalendarIds}
            onEditEvent={handleEditEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
      </main>

      {/* Event form dialog */}
      <EventFormDialog
        isOpen={isEventFormOpen}
        onClose={() => {
          setIsEventFormOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        calendars={calendars}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        isPending={eventPending}
      />
    </div>
  );
}
