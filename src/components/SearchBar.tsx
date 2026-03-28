/**
 * SearchBar Component
 * Enhanced search input with icons, suggestions, and advanced filter button
 */

import { useState, useRef, useEffect } from 'react';
import { Search, Filter, History, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onAdvancedClick?: () => void;
  onHistoryClick?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onAdvancedClick,
  onHistoryClick,
  placeholder = 'Search',
  disabled = false,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      {/* Search Icon */}
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E8E93] pointer-events-none" />

      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        disabled={disabled}
        className="w-full bg-[#8E8E93]/10 border-none rounded-lg py-1.5 pl-9 pr-24 text-[14px] focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#8E8E93] transition-all hover:bg-[#8E8E93]/15 disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* Right Icons */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {/* History Button */}
        <button
          onClick={onHistoryClick}
          disabled={disabled}
          className="p-1 hover:bg-black/5 rounded-md transition-colors disabled:opacity-50"
          title="Search History"
          type="button"
        >
          <History className="w-3.5 h-3.5 text-[#8E8E93]" strokeWidth={1.5} />
        </button>

        {/* Advanced Filter Button */}
        <button
          onClick={onAdvancedClick}
          disabled={disabled}
          className="p-1 hover:bg-black/5 rounded-md transition-colors disabled:opacity-50"
          title="Advanced Search"
          type="button"
        >
          <Filter className="w-3.5 h-3.5 text-[#007AFF]" strokeWidth={1.5} />
        </button>

        {/* Clear Button (only show when input has value) */}
        {value && (
          <button
            onClick={() => onChange('')}
            disabled={disabled}
            className="p-0.5 hover:bg-black/5 rounded-full transition-colors disabled:opacity-50"
            title="Clear search"
            type="button"
          >
            <X className="w-3 h-3 text-[#8E8E93]" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Hint for keyboard shortcut (optional) */}
      {!value && !isFocused && (
        <span className="absolute right-24 top-1/2 -translate-y-1/2 text-[11px] text-[#8E8E93]/50 pointer-events-none hidden sm:inline">
          Cmd K
        </span>
      )}
    </div>
  );
}
