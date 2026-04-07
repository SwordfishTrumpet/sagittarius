/**
 * AdvancedSearchModal Component
 * Full-featured search modal with comprehensive filter options
 * Supports both Email/query and Thread/query filters per RFC 8621
 */

import { useState } from 'react';
import { X, Users, MessageSquare } from 'lucide-react';
import { SearchFilter } from '../types/search';

interface AdvancedSearchModalProps {
  onApply: (filters: SearchFilter) => void;
  onClose: () => void;
  initialFilters?: SearchFilter;
}

export function AdvancedSearchModal({
  onApply,
  onClose,
  initialFilters,
}: AdvancedSearchModalProps) {
  const [filters, setFilters] = useState<SearchFilter>(initialFilters || {});
  const [activeTab, setActiveTab] = useState<'email' | 'thread'>('email');

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({});
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] sticky top-0 bg-white">
          <h2 className="text-[17px] font-bold text-[#1C1C1E]">Advanced Search</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#F2F2F7] rounded-full transition-colors"
            type="button"
          >
            <X className="w-5 h-5 text-[#8E8E93]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E5E5E5]">
          <button
            onClick={() => setActiveTab('email')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors ${
              activeTab === 'email'
                ? 'text-[#007AFF] border-b-2 border-[#007AFF] bg-[#007AFF]/5'
                : 'text-[#8E8E93] hover:bg-[#F2F2F7]'
            }`}
            type="button"
            aria-selected={activeTab === 'email'}
            role="tab"
          >
            <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
            Email
          </button>
          <button
            onClick={() => setActiveTab('thread')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors ${
              activeTab === 'thread'
                ? 'text-[#007AFF] border-b-2 border-[#007AFF] bg-[#007AFF]/5'
                : 'text-[#8E8E93] hover:bg-[#F2F2F7]'
            }`}
            type="button"
            aria-selected={activeTab === 'thread'}
            role="tab"
          >
            <Users className="w-4 h-4" strokeWidth={1.5} />
            Thread
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-5">
          {activeTab === 'email' ? (
            <>
              {/* From */}
              <div>
                <label className="block text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                  From
                </label>
                <input
                  type="email"
                  placeholder="sender@example.com or 'me'"
                  value={filters.from || ''}
                  onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-[#F2F2F7] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#8E8E93] transition-all"
                />
              </div>

              {/* To */}
              <div>
                <label className="block text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                  To
                </label>
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={filters.to || ''}
                  onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-[#F2F2F7] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#8E8E93] transition-all"
                />
              </div>

              {/* CC */}
              <div>
                <label className="block text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                  CC
                </label>
                <input
                  type="email"
                  placeholder="cc@example.com"
                  value={filters.cc || ''}
                  onChange={(e) => setFilters({ ...filters, cc: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-[#F2F2F7] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#8E8E93] transition-all"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="Subject keywords"
                  value={filters.subject || ''}
                  onChange={(e) => setFilters({ ...filters, subject: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-[#F2F2F7] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#8E8E93] transition-all"
                />
              </div>

              {/* Text/Body */}
              <div>
                <label className="block text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                  Message Body
                </label>
                <textarea
                  placeholder="Search in email body"
                  value={filters.text || ''}
                  onChange={(e) => setFilters({ ...filters, text: e.target.value || undefined })}
                  rows={3}
                  className="w-full px-3 py-2 bg-[#F2F2F7] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#8E8E93] transition-all resize-none"
                />
              </div>
            </>
          ) : (
            <>
              {/* Thread Search Info */}
              <div className="bg-[#007AFF]/5 rounded-lg p-3 mb-4">
                <p className="text-[12px] text-[#007AFF] leading-relaxed">
                  Thread search finds conversations containing emails matching your criteria.
                  Results show the entire thread, not just individual messages.
                </p>
              </div>

              {/* Thread From */}
              <div>
                <label className="block text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                  Thread Has Email From
                </label>
                <input
                  type="email"
                  placeholder="Any sender in the thread"
                  value={filters.threadFrom || ''}
                  onChange={(e) => setFilters({ ...filters, threadFrom: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-[#F2F2F7] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#8E8E93] transition-all"
                />
                <p className="text-[11px] text-[#8E8E93] mt-1">
                  Find threads containing messages from this sender
                </p>
              </div>

              {/* Thread To */}
              <div>
                <label className="block text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                  Thread Has Email To
                </label>
                <input
                  type="email"
                  placeholder="Any recipient in the thread"
                  value={filters.threadTo || ''}
                  onChange={(e) => setFilters({ ...filters, threadTo: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-[#F2F2F7] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#8E8E93] transition-all"
                />
                <p className="text-[11px] text-[#8E8E93] mt-1">
                  Find threads where this person received a message
                </p>
              </div>

              {/* Thread Subject */}
              <div>
                <label className="block text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
                  Thread Subject Contains
                </label>
                <input
                  type="text"
                  placeholder="Any email in thread has this subject"
                  value={filters.threadSubject || ''}
                  onChange={(e) => setFilters({ ...filters, threadSubject: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-[#F2F2F7] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#8E8E93] transition-all"
                />
              </div>

              {/* Thread Attachment Checkbox */}
              <label className="flex items-center gap-3 cursor-pointer hover:bg-[#F2F2F7]/50 p-2 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={filters.threadHasAttachment === true}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      threadHasAttachment: e.target.checked || undefined,
                    })
                  }
                  className="w-4 h-4 rounded border-[#8E8E93] text-[#007AFF] cursor-pointer"
                />
                <div>
                  <span className="text-[13px] font-medium text-[#1C1C1E] block">
                    Thread Has Attachments
                  </span>
                  <span className="text-[11px] text-[#8E8E93]">
                    Any email in the thread contains an attachment
                  </span>
                </div>
              </label>
            </>
          )}

          {/* Common Filters (Date Range) */}
          <div className="pt-4 border-t border-[#E5E5E5]">
            <label className="block text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">
              Date Range
            </label>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-[#8E8E93] font-medium">After</label>
                <input
                  type="date"
                  value={
                    filters.after ? filters.after.toISOString().split('T')[0] : ''
                  }
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      after: e.target.value ? new Date(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 bg-[#F2F2F7] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#8E8E93] font-medium">Before</label>
                <input
                  type="date"
                  value={
                    filters.before ? filters.before.toISOString().split('T')[0] : ''
                  }
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      before: e.target.value ? new Date(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 bg-[#F2F2F7] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Checkboxes (Email tab only) */}
          {activeTab === 'email' && (
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer hover:bg-[#F2F2F7]/50 p-2 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={filters.hasAttachment === true}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      hasAttachment: e.target.checked || undefined,
                    })
                  }
                  className="w-4 h-4 rounded border-[#8E8E93] text-[#007AFF] cursor-pointer"
                />
                <span className="text-[13px] font-medium text-[#1C1C1E]">
                  Has Attachments
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-[#F2F2F7]/50 p-2 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={filters.isUnread === true}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      isUnread: e.target.checked || undefined,
                    })
                  }
                  className="w-4 h-4 rounded border-[#8E8E93] text-[#007AFF] cursor-pointer"
                />
                <span className="text-[13px] font-medium text-[#1C1C1E]">
                  Unread Only
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-[#F2F2F7]/50 p-2 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={filters.isFlagged === true}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      isFlagged: e.target.checked || undefined,
                    })
                  }
                  className="w-4 h-4 rounded border-[#8E8E93] text-[#007AFF] cursor-pointer"
                />
                <span className="text-[13px] font-medium text-[#1C1C1E]">
                  Flagged Only
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-[#F2F2F7]/50 p-2 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={filters.isDraft === true}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      isDraft: e.target.checked || undefined,
                    })
                  }
                  className="w-4 h-4 rounded border-[#8E8E93] text-[#007AFF] cursor-pointer"
                />
                <span className="text-[13px] font-medium text-[#1C1C1E]">
                  Drafts Only
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer hover:bg-[#F2F2F7]/50 p-2 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={filters.isAnswered === true}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      isAnswered: e.target.checked || undefined,
                    })
                  }
                  className="w-4 h-4 rounded border-[#8E8E93] text-[#007AFF] cursor-pointer"
                />
                <span className="text-[13px] font-medium text-[#1C1C1E]">
                  Answered Only
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-[#E5E5E5] bg-[#F2F2F7]/50 sticky bottom-0">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 bg-white text-[#8E8E93] rounded-lg font-medium text-[13px] hover:bg-[#E5E5E5] transition-colors border border-[#E5E5E5]"
            type="button"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-[#F2F2F7] text-[#1C1C1E] rounded-lg font-medium text-[13px] hover:bg-[#E5E5E5] transition-colors"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-lg font-medium text-[13px] hover:bg-[#0051D5] transition-colors"
            type="button"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
