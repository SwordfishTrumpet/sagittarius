import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSToggle } from '../ui/IOSToggle';
import { useVacation, useVacationUpdate, type VacationUpdatePayload } from '../../hooks/useVacation';
import { toastOperationError } from '../../utils/toastHelpers';

function isoToLocal(iso?: string | null): string {
  if (!iso) return '';
  // datetime-local input expects "YYYY-MM-DDTHH:MM"
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function localToIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

function isVacationActive(fromDate?: string | null, toDate?: string | null): boolean {
  const now = Date.now();
  const from = fromDate ? new Date(fromDate).getTime() : -Infinity;
  const to = toDate ? new Date(toDate).getTime() : Infinity;
  return now >= from && now <= to;
}

export function VacationSettings() {
  const { data: vacation, isLoading } = useVacation();
  const { mutateAsync: saveVacation, isPending } = useVacationUpdate();

  const [isEnabled, setIsEnabled] = useState(false);
  const [subject, setSubject] = useState('');
  const [textBody, setTextBody] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Sync local state when server data arrives
  useEffect(() => {
    if (!vacation) return;
    setIsEnabled(vacation.isEnabled);
    setSubject(vacation.subject ?? '');
    setTextBody(vacation.textBody ?? '');
    setFromDate(isoToLocal(vacation.fromDate));
    setToDate(isoToLocal(vacation.toDate));
  }, [vacation]);

  const active = isEnabled && isVacationActive(
    fromDate ? localToIso(fromDate) : vacation?.fromDate,
    toDate ? localToIso(toDate) : vacation?.toDate,
  );

  const handleSave = async () => {
    const payload: VacationUpdatePayload = {
      isEnabled,
      subject: subject || null,
      textBody: textBody || null,
      fromDate: localToIso(fromDate),
      toDate: localToIso(toDate),
    };

    try {
      await saveVacation(payload);
      toast.success('Vacation response saved');
    } catch {
      toastOperationError('vacation.save');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-5 w-40 bg-[#E5E5EA] dark:bg-[#2C2C2E] rounded-lg" />
        <div className="h-16 bg-[#E5E5EA] dark:bg-[#2C2C2E] rounded-2xl" />
        <div className="h-28 bg-[#E5E5EA] dark:bg-[#2C2C2E] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-[#1C1C1E]">Vacation Response</h2>
        {active && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#34C759]/10 text-[#34C759] text-[12px] font-medium">
            <CheckCircle2 size={12} strokeWidth={2} />
            Active
          </span>
        )}
      </div>

      {/* Enable toggle card */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[15px] font-medium text-[#1C1C1E]">Enable Vacation Response</p>
          <p className="text-[13px] text-[#8E8E93] mt-0.5">Auto-reply to incoming messages</p>
        </div>
        <IOSToggle
          checked={isEnabled}
          onChange={(checked) => setIsEnabled(checked)}
          ariaLabel="Enable Vacation Response"
        />
      </div>

      {/* Detail fields — only when enabled */}
      {isEnabled && (
        <div className="space-y-3">
          {/* Subject */}
          <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
            <label className="block px-4 pt-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Out of Office"
              className="w-full px-4 pb-3 pt-1 text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] bg-transparent focus:outline-none"
            />
          </div>

          {/* Body */}
          <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
            <label className="block px-4 pt-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">
              Message
            </label>
            <textarea
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              rows={5}
              placeholder="I'm currently out of office and will reply when I return."
              className="w-full px-4 pb-3 pt-1 text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] bg-transparent focus:outline-none resize-none"
            />
          </div>

          {/* Date range */}
          <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#E5E5EA] dark:divide-[#38383A]">
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <label className="text-[15px] text-[#1C1C1E] shrink-0">Start Date</label>
              <input
                type="datetime-local"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-[14px] text-[#007AFF] bg-transparent focus:outline-none"
              />
            </div>
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <label className="text-[15px] text-[#1C1C1E] shrink-0">End Date</label>
              <input
                type="datetime-local"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-[14px] text-[#007AFF] bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#007AFF] hover:bg-[#0066CC] disabled:opacity-50 text-white text-[15px] font-medium rounded-xl transition-colors"
      >
        <Save size={15} strokeWidth={1.5} />
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
