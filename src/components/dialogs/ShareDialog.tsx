import { useState, useRef, useEffect } from 'react';
import { Search, User, X, Check } from 'lucide-react';
import { BaseDialog } from './BaseDialog';
import type { Principal } from '../../types/jmap-sharing';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  currentShareWith: Record<string, { mayRead?: boolean; mayWrite?: boolean; mayAdmin?: boolean }> | null;
  onSave: (shareWith: Record<string, { mayRead?: boolean; mayWrite?: boolean; mayAdmin?: boolean }>) => void;
  onSearch: (query: string) => Promise<Principal[]>;
}

export function ShareDialog({
  isOpen,
  onClose,
  title,
  currentShareWith,
  onSave,
  onSearch,
}: ShareDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Principal[]>([]);
  const [selectedPrincipals, setSelectedPrincipals] = useState<Record<string, { mayRead: boolean; mayWrite: boolean; mayAdmin: boolean }>>(
    () => {
      if (!currentShareWith) return {};
      const result: Record<string, { mayRead: boolean; mayWrite: boolean; mayAdmin: boolean }> = {};
      for (const [id, rights] of Object.entries(currentShareWith)) {
        result[id] = { mayRead: rights.mayRead ?? false, mayWrite: rights.mayWrite ?? false, mayAdmin: rights.mayAdmin ?? false };
      }
      return result;
    }
  );
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await onSearch(value.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const addPrincipal = (principal: Principal) => {
    setSelectedPrincipals(prev => ({
      ...prev,
      [principal.id]: { mayRead: true, mayWrite: false, mayAdmin: false },
    }));
    setSearchQuery('');
    setSearchResults([]);
  };

  const removePrincipal = (id: string) => {
    const next = { ...selectedPrincipals };
    delete next[id];
    setSelectedPrincipals(next);
  };

  const updateRights = (id: string, field: 'mayRead' | 'mayWrite' | 'mayAdmin', value: boolean) => {
    setSelectedPrincipals(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = () => {
    onSave(selectedPrincipals);
    onClose();
  };

  return (
    <BaseDialog isOpen={isOpen} onClose={onClose} title={title} titleId="share-dialog-title" initialFocusRef={searchRef}>
      <div className="p-6">
        {/* Search input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search people or enter email..."
            className="w-full pl-9 pr-4 pb-3 pt-1 bg-icloud-bg-layer1 rounded-xl text-[15px] text-icloud-text-primary placeholder:text-icloud-text-tertiary border border-icloud-border focus:outline-none focus:ring-2 focus:ring-icloud-accent/30 transition-shadow"
            role="combobox"
            aria-expanded={searchResults.length > 0}
            aria-controls="share-search-results"
            aria-autocomplete="list"
            aria-label="Search people to share with"
          />
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <ul
            id="share-search-results"
            role="listbox"
            className="mb-4 bg-icloud-bg-layer1 rounded-xl border border-icloud-border divide-y divide-icloud-border overflow-hidden"
          >
            {searchResults.map((principal) => (
              <li
                key={principal.id}
                role="option"
                aria-selected={!!selectedPrincipals[principal.id]}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-icloud-accent/10 transition-colors"
                onClick={() => addPrincipal(principal)}
              >
                <div className="w-8 h-8 rounded-full bg-icloud-accent/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-icloud-accent" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-icloud-text-primary truncate">{principal.name}</p>
                  {principal.email && (
                    <p className="text-[12px] text-icloud-text-secondary truncate">{principal.email}</p>
                  )}
                </div>
                <span className="text-xs text-icloud-text-tertiary capitalize">{principal.type}</span>
              </li>
            ))}
          </ul>
        )}

        {isSearching && searchResults.length === 0 && searchQuery && (
          <p className="text-[13px] text-icloud-text-secondary text-center py-4">Searching...</p>
        )}

        {!isSearching && searchResults.length === 0 && searchQuery && (
          <p className="text-[13px] text-icloud-text-secondary text-center py-4">No people found</p>
        )}

        {/* Current shares */}
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-icloud-text-secondary">People with access</p>
          {Object.keys(selectedPrincipals).length === 0 ? (
            <p className="text-[13px] text-icloud-text-tertiary text-center py-4">No one has access yet</p>
          ) : (
            Object.entries(selectedPrincipals).map(([id, rights]) => (
              <div key={id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-icloud-bg-layer1/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-icloud-accent/20 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-icloud-accent" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-icloud-text-primary truncate">{id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(['mayRead', 'mayWrite', 'mayAdmin'] as const).map((right) => (
                    <button
                      key={right}
                      onClick={() => updateRights(id, right, !rights[right])}
                      className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors min-h-[24px] ${
                        rights[right]
                          ? 'bg-icloud-accent text-white'
                          : 'bg-icloud-bg-layer1 text-icloud-text-secondary hover:bg-icloud-accent/10'
                      }`}
                      aria-pressed={rights[right]}
                      aria-label={`${right.replace('may', '')}: ${rights[right] ? 'granted' : 'not granted'}`}
                    >
                      {right.replace('may', '')}
                    </button>
                  ))}
                  <button
                    onClick={() => removePrincipal(id)}
                    className="p-1.5 rounded-lg hover:bg-icloud-red/10 text-icloud-text-secondary hover:text-icloud-red transition-colors min-w-[24px] min-h-[24px] flex items-center justify-center"
                    aria-label="Remove access"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Save button */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-icloud-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-icloud-text-secondary rounded-lg hover:bg-icloud-bg-layer1 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-icloud-accent text-white text-[13px] font-semibold rounded-lg hover:bg-icloud-accent-hover transition-colors"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            Save
          </button>
        </div>
      </div>
    </BaseDialog>
  );
}
