/**
 * AdvancedSearchDropdown Component
 * Quick filter dropdown menu with common search options
 */

import { Mail, AlertCircle, Paperclip, Calendar, Search } from 'lucide-react';
import { SearchFilter } from '../types/search';

interface AdvancedSearchDropdownProps {
  onFilterApply: (filter: SearchFilter) => void;
  onOpenModal?: () => void;
}

export function AdvancedSearchDropdown({
  onFilterApply,
  onOpenModal,
}: AdvancedSearchDropdownProps) {
  return (
    <div className="absolute top-full right-0 mt-2 w-56 bg-icloud-bg-layer2 border border-icloud-border rounded-xl shadow-lg p-2 z-50 animate-in fade-in duration-150">
      {/* Header */}
      <div className="px-3 py-2 text-[11px] font-bold text-icloud-text-secondary uppercase tracking-wider opacity-60">
        Quick Filters
      </div>

      {/* Unread */}
      <button
        onClick={() => onFilterApply({ isUnread: true })}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-icloud-bg-layer1 dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-icloud-text-primary transition-colors"
      >
        <Mail className="w-4 h-4 text-icloud-accent" strokeWidth={1.5} />
        <span>Unread</span>
      </button>

      {/* Starred */}
      <button
        onClick={() => onFilterApply({ isFlagged: true })}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-icloud-bg-layer1 dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-icloud-text-primary transition-colors"
      >
        <AlertCircle className="w-4 h-4 text-icloud-orange" strokeWidth={1.5} />
        <span>Starred</span>
      </button>

      {/* Has Attachments */}
      <button
        onClick={() => onFilterApply({ hasAttachment: true })}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-icloud-bg-layer1 dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-icloud-text-primary transition-colors"
      >
        <Paperclip className="w-4 h-4 text-icloud-green" strokeWidth={1.5} />
        <span>Has Attachments</span>
      </button>

      <hr className="my-2 border-icloud-border" />

      {/* Date Filters Header */}
      <div className="px-3 py-2 text-[11px] font-bold text-icloud-text-secondary uppercase tracking-wider opacity-60">
        Date Range
      </div>

      {/* Today */}
      <button
        onClick={() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          onFilterApply({ after: today });
        }}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-icloud-bg-layer1 dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-icloud-text-primary transition-colors"
      >
        <Calendar className="w-4 h-4 text-icloud-accent" strokeWidth={1.5} />
        <span>Today</span>
      </button>

      {/* This Week */}
      <button
        onClick={() => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          weekAgo.setHours(0, 0, 0, 0);
          onFilterApply({ after: weekAgo });
        }}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-icloud-bg-layer1 dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-icloud-text-primary transition-colors"
      >
        <Calendar className="w-4 h-4 text-icloud-accent" strokeWidth={1.5} />
        <span>This Week</span>
      </button>

      {/* This Month */}
      <button
        onClick={() => {
          const monthAgo = new Date();
          monthAgo.setDate(1);
          monthAgo.setHours(0, 0, 0, 0);
          onFilterApply({ after: monthAgo });
        }}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-icloud-bg-layer1 dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-icloud-text-primary transition-colors"
      >
        <Calendar className="w-4 h-4 text-icloud-accent" strokeWidth={1.5} />
        <span>This Month</span>
      </button>

      <hr className="my-2 border-icloud-border" />

      {/* Advanced Search */}
      <button
        onClick={onOpenModal}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-icloud-bg-layer1 dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-icloud-accent transition-colors"
      >
        <Search className="w-4 h-4" strokeWidth={1.5} />
        <span>Advanced Search...</span>
      </button>
    </div>
  );
}
