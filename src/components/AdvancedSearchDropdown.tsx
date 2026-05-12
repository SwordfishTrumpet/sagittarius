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
    <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-[#E5E5E5] rounded-xl shadow-lg p-2 z-50 animate-in fade-in duration-150">
      {/* Header */}
      <div className="px-3 py-2 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider opacity-60">
        Quick Filters
      </div>

      {/* Unread */}
      <button
        onClick={() => onFilterApply({ isUnread: true })}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F2F2F7] dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-[#1C1C1E] transition-colors"
      >
        <Mail className="w-4 h-4 text-[#007AFF]" strokeWidth={1.5} />
        <span>Unread</span>
      </button>

      {/* Flagged */}
      <button
        onClick={() => onFilterApply({ isFlagged: true })}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F2F2F7] dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-[#1C1C1E] transition-colors"
      >
        <AlertCircle className="w-4 h-4 text-[#FF9500]" strokeWidth={1.5} />
        <span>Flagged</span>
      </button>

      {/* Has Attachments */}
      <button
        onClick={() => onFilterApply({ hasAttachment: true })}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F2F2F7] dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-[#1C1C1E] transition-colors"
      >
        <Paperclip className="w-4 h-4 text-[#34C759]" strokeWidth={1.5} />
        <span>Has Attachments</span>
      </button>

      <hr className="my-2 border-[#E5E5E5]" />

      {/* Date Filters Header */}
      <div className="px-3 py-2 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider opacity-60">
        Date Range
      </div>

      {/* Today */}
      <button
        onClick={() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          onFilterApply({ after: today });
        }}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F2F2F7] dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-[#1C1C1E] transition-colors"
      >
        <Calendar className="w-4 h-4 text-[#5AC8FA]" strokeWidth={1.5} />
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
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F2F2F7] dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-[#1C1C1E] transition-colors"
      >
        <Calendar className="w-4 h-4 text-[#5AC8FA]" strokeWidth={1.5} />
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
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F2F2F7] dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-[#1C1C1E] transition-colors"
      >
        <Calendar className="w-4 h-4 text-[#5AC8FA]" strokeWidth={1.5} />
        <span>This Month</span>
      </button>

      <hr className="my-2 border-[#E5E5E5]" />

      {/* Advanced Search */}
      <button
        onClick={onOpenModal}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F2F2F7] dark:hover:bg-white/5 rounded-lg text-[13px] font-medium text-[#007AFF] transition-colors"
      >
        <Search className="w-4 h-4" strokeWidth={1.5} />
        <span>Advanced Search...</span>
      </button>
    </div>
  );
}
