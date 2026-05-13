import { Mail, Star, User, Paperclip } from 'lucide-react';

interface FilterBarProps {
  activeFilters: Set<string>;
  onToggleFilter: (filter: string) => void;
}

const FILTERS = [
  { key: 'unread', label: 'Unread', icon: Mail },
  { key: 'flagged', label: 'Flagged', icon: Star },
  { key: 'toMe', label: 'To Me', icon: User },
  { key: 'attachments', label: 'Attachments', icon: Paperclip },
] as const;

export function FilterBar({ activeFilters, onToggleFilter }: FilterBarProps) {
  return (
    <div className="flex gap-2 px-4 py-2 animate-in fade-in slide-in-from-top-1 duration-200 overflow-x-auto scrollbar-none">
      {FILTERS.map(({ key, label, icon: Icon }) => {
        const isActive = activeFilters.has(key);
        return (
          <button
            key={key}
            onClick={() => onToggleFilter(key)}
            aria-pressed={isActive}
            aria-label={`Filter ${label}`}
            className={`flex items-center justify-center gap-1.5 min-h-[44px] rounded-full px-4 text-[12px] font-semibold transition-all duration-150 shrink-0 ${
              isActive
                ? 'bg-icloud-accent text-white shadow-sm'
                : 'bg-icloud-bg-layer1 text-icloud-text-secondary  hover:bg-icloud-border '
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={1.5} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
