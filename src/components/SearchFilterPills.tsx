/**
 * SearchFilterPills Component
 * Displays active search filters as removable pill/token elements
 */

import { X } from 'lucide-react';
import { SearchPill } from '../types/search';

interface SearchFilterPillsProps {
  pills: SearchPill[];
  onRemove: (pillId: string) => void;
}

export function SearchFilterPills({ pills, onRemove }: SearchFilterPillsProps) {
  if (pills.length === 0) return null;

  return (
    <div aria-label="Active search filters" className="flex flex-wrap gap-2 px-4 py-2 bg-icloud-bg-layer1/50 bg-icloud-bg-primary/50 border-b border-icloud-border animate-in fade-in duration-200">
      {pills.map((pill) => (
        <div
          key={pill.id}
          className="inline-flex items-center gap-2 bg-icloud-accent/10 text-icloud-accent px-3 py-1 rounded-full text-[12px] font-medium border border-icloud-accent/20 hover:bg-icloud-accent/15 transition-colors"
        >
          <span className="truncate max-w-[150px]">{pill.label}</span>
          <button
            onClick={() => onRemove(pill.id)}
            className="hover:opacity-70 transition-opacity ml-1 -mr-1"
            title={`Remove ${pill.label}`}
            aria-label={`Remove filter ${pill.label}`}
            type="button"
          >
            <X className="w-3 h-3" strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
