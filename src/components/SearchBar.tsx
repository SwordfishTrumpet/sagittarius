/**
 * SearchBar Component
 * Enhanced search input with icons, suggestions, and advanced filter button
 */

import { useState, useRef } from 'react';
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
    <div role="search" className="relative">
      {/* Search Icon */}
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-icloud-text-secondary pointer-events-none" />

      {/* Input Field */}
      <input
        ref={inputRef}
        role="searchbox"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        disabled={disabled}
        aria-label="Search emails"
        className="w-full bg-[#8E8E93]/10 border-none rounded-lg py-1.5 pl-9 pr-24 text-[14px] focus:ring-2 focus:ring-icloud-accent placeholder-icloud-text-secondary transition-all hover:bg-[#8E8E93]/15 disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* Right Icons */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {/* History Button */}
        <button
          onClick={onHistoryClick}
          disabled={disabled}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-icloud-text-primary/5 rounded-md transition-colors disabled:opacity-50"
          title="Search History"
          aria-label="Search history"
          type="button"
        >
          <History className="w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} />
        </button>

        {/* Advanced Filter Button */}
        <button
          onClick={onAdvancedClick}
          disabled={disabled}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-icloud-text-primary/5 rounded-md transition-colors disabled:opacity-50"
          title="Advanced Search"
          aria-label="Advanced search"
          type="button"
        >
          <Filter className="w-4 h-4 text-icloud-accent" strokeWidth={1.5} />
        </button>

        {/* Clear Button (only show when input has value) */}
        {value && (
          <button
            onClick={() => onChange('')}
            disabled={disabled}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-icloud-text-primary/5 rounded-full transition-colors disabled:opacity-50"
            title="Clear search"
            aria-label="Clear search"
            type="button"
          >
            <X className="w-4 h-4 text-icloud-text-secondary" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Hint for keyboard shortcut (optional) */}
      {!value && !isFocused && (
        <span className="absolute right-24 top-1/2 -translate-y-1/2 text-[11px] /70 pointer-events-none hidden sm:inline">
          Cmd K
        </span>
      )}
    </div>
  );
}
