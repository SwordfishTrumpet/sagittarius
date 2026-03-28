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
    <div className="flex gap-2 px-4 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
      {FILTERS.map(({ key, label, icon: Icon }) => {
        const isActive = activeFilters.has(key);
        return (
          <button
            key={key}
            onClick={() => onToggleFilter(key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition-all duration-150 ${
              isActive
                ? 'bg-[#007AFF] text-white shadow-sm'
                : 'bg-[#F2F2F7] text-[#8E8E93] hover:bg-[#E5E5EA]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
