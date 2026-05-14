import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, ChevronRight, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ScheduleSendPickerProps {
  onSchedule: (date: Date) => void;
  onCancel: () => void;
  maxDelaySeconds: number;
}

interface QuickOption {
  label: string;
  sublabel: string | (() => string);
  date: () => Date;
}

function getNextWeekday(targetDay: number, hour: number): Date {
  const now = new Date();
  const result = new Date(now);
  const currentDay = now.getDay(); // 0 Sun, 1 Mon…6 Sat
  let daysUntil = (targetDay - currentDay + 7) % 7;
  if (daysUntil === 0) daysUntil = 7; // always next occurrence
  result.setDate(now.getDate() + daysUntil);
  result.setHours(hour, 0, 0, 0);
  return result;
}

function tomorrow(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toLocalDatetimeValue(d: Date): string {
  // datetime-local requires "YYYY-MM-DDTHH:MM"
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const QUICK_OPTIONS: QuickOption[] = [
  {
    label: 'Tomorrow 9 AM',
    sublabel: () => formatDateLabel(tomorrow(9)),
    date: () => tomorrow(9),
  },
  {
    label: 'Tomorrow 1 PM',
    sublabel: () => formatDateLabel(tomorrow(13)),
    date: () => tomorrow(13),
  },
  {
    label: 'Monday 9 AM',
    sublabel: () => formatDateLabel(getNextWeekday(1, 9)),
    date: () => getNextWeekday(1, 9),
  },
];

export function ScheduleSendPicker({ onSchedule, onCancel, maxDelaySeconds }: ScheduleSendPickerProps) {
  const [customValue, setCustomValue] = useState('');
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(containerRef, { initialFocusRef: customInputRef });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const maxDate = new Date(Date.now() + maxDelaySeconds * 1000);
  const minDate = new Date(Date.now() + 60 * 1000); // at least 1 min in the future

  const validate = (date: Date): string => {
    if (date <= minDate) return 'Please choose a time at least 1 minute from now.';
    if (date > maxDate) {
      const hrs = Math.floor(maxDelaySeconds / 3600);
      return `Maximum scheduling delay is ${hrs} hours.`;
    }
    return '';
  };

  const handleQuick = (optDate: Date) => {
    const err = validate(optDate);
    if (err) { setError(err); return; }
    setError('');
    onSchedule(optDate);
  };

  const handleCustom = () => {
    if (!customValue) { setError('Please pick a date and time.'); return; }
    const date = new Date(customValue);
    const err = validate(date);
    if (err) { setError(err); return; }
    setError('');
    onSchedule(date);
  };

  return (
    <div
      ref={containerRef}
      className="bg-icloud-bg-layer2 rounded-xl shadow-2xl border border-icloud-border w-[300px] overflow-hidden"
      role="dialog"
      aria-label="Schedule send"
      aria-modal="true"
      tabIndex={-1}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-icloud-border">
        <div className="flex items-center gap-2 text-icloud-text-primary">
          <Clock size={14} strokeWidth={1.5} className="text-icloud-text-secondary " />
          <span className="text-[14px] font-semibold">Schedule Send</span>
        </div>
        <button
          onClick={onCancel}
          className="w-6 h-6 rounded-full bg-icloud-border bg-icloud-card hover:bg-icloud-divider   flex items-center justify-center transition-colors"
          aria-label="Close schedule picker"
        >
          <X size={11} strokeWidth={2} className="text-icloud-text-secondary" />
        </button>
      </div>

      {/* Quick options */}
      <div className="py-1">
        {QUICK_OPTIONS.map((opt) => {
          const date = opt.date();
          const isDisabled = date > maxDate || date <= minDate;
          return (
            <button
              key={opt.label}
              disabled={isDisabled}
              onClick={() => handleQuick(date)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-icloud-bg-layer1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <div className="text-left">
                <p className="text-[14px] font-medium text-icloud-text-primary">{opt.label}</p>
                <p className="text-[12px] text-icloud-text-secondary ">
                  {typeof opt.sublabel === 'function' ? opt.sublabel() : opt.sublabel}
                </p>
              </div>
              <ChevronRight size={14} strokeWidth={1.5} className="text-icloud-text-tertiary" />
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-px bg-icloud-bg-layer1  mx-4" />

      {/* Custom picker */}
      <div className="px-4 py-3 space-y-2">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-icloud-text-secondary  uppercase tracking-wide">
          <Calendar size={11} strokeWidth={1.5} />
          Custom Date &amp; Time
        </label>
        <input
          ref={customInputRef}
          type="datetime-local"
          value={customValue}
          min={toLocalDatetimeValue(minDate)}
          max={toLocalDatetimeValue(maxDate)}
          onChange={(e) => { setCustomValue(e.target.value); setError(''); }}
          className="w-full px-3 py-2 text-[14px] text-icloud-text-primary bg-icloud-bg-layer1 rounded-xl border border-transparent focus:border-icloud-accent dark:focus:border-icloud-accent focus:bg-white dark:focus:bg-icloud-bg-primary focus:outline-none transition-colors"
        />

        {error && (
          <p role="alert" className="text-[12px] text-icloud-red">{error}</p>
        )}

        <button
          onClick={handleCustom}
          disabled={!customValue}
          className="w-full py-2 rounded-xl bg-icloud-accent hover:bg-icloud-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-[14px] font-medium transition-colors"
        >
          Schedule
        </button>
      </div>
    </div>
  );
}
