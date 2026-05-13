import { Search, Filter, Square, ChevronRight, X, Menu } from 'lucide-react'
import { FilterBar } from './FilterBar'

export interface MessageListHeaderProps {
  title: string
  isSidebarCollapsed: boolean
  isMobile?: boolean
  emails: any[] | undefined
  selectedEmailIds: Set<string>
  searchTerm: string
  showFilterBar: boolean
  activeListFilters: Set<string>
  onShowSidebar: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  onToggleFilterBar: () => void
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  onToggleListFilter: (filter: string) => void
}

export function MessageListHeader({
  title,
  isSidebarCollapsed,
  isMobile = false,
  emails,
  selectedEmailIds,
  searchTerm,
  showFilterBar,
  activeListFilters,
  onShowSidebar,
  onSelectAll,
  onClearSelection,
  onToggleFilterBar,
  onSearchChange,
  onClearSearch,
  onToggleListFilter,
}: MessageListHeaderProps) {
  const emailCount = emails?.length || 0;
  const allSelected = emailCount > 0 && selectedEmailIds.size === emailCount;

  return (
    <header className="px-4 py-3 border-b border-icloud-border flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isMobile ? (
            <button
              onClick={onShowSidebar}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors -ml-1"
              title="Menu"
              aria-label="Show sidebar menu"
            >
              <Menu className="w-5 h-5 text-icloud-accent" strokeWidth={1.75} />
            </button>
          ) : isSidebarCollapsed ? (
            <button
              onClick={onShowSidebar}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded transition-colors"
              title="Show Sidebar"
              aria-label="Show sidebar"
            >
              <ChevronRight className="w-5 h-5 text-icloud-text-secondary" strokeWidth={1.5} />
            </button>
          ) : null}
          {!isMobile && emails && emails.length > 0 && (
            <button 
              onClick={() => allSelected ? onClearSelection() : onSelectAll()}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded transition-colors"
              title={allSelected ? 'Deselect all' : 'Select all'}
              aria-label={allSelected ? 'Deselect all messages' : 'Select all messages'}
            >
              <Square className={`w-5 h-5 ${allSelected ? 'fill-icloud-accent text-icloud-accent' : 'text-icloud-text-secondary'} stroke-[1.5]`} />
            </button>
          )}
          <h2 className={`font-bold truncate ${isMobile ? 'text-[18px]' : 'text-[17px]'}`}>
            {selectedEmailIds.size > 0 ? `${selectedEmailIds.size} selected` : title}
          </h2>
        </div>
        <div className="flex gap-4">
           <div className="relative">
              <button 
                onClick={onToggleFilterBar}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded transition-colors"
                aria-label={activeListFilters.size > 0 ? 'Toggle filters, active filters applied' : 'Toggle filters'}
              >
                <Filter className={`w-4 h-4 ${activeListFilters.size > 0 ? 'text-icloud-accent fill-icloud-accent/20' : 'text-icloud-accent'}`} strokeWidth={1.25} />
             </button>
             {activeListFilters.size > 0 && (
               <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-icloud-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                 {activeListFilters.size}
               </span>
             )}
           </div>
        </div>
      </div>
      <div role="search" className="relative">
         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-icloud-text-secondary" />
        <input 
          role="searchbox"
          type="text" 
          placeholder="Search" 
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search emails"
          className="w-full bg-icloud-text-secondary/10 border-none rounded-lg py-1.5 pl-9 pr-12 text-[14px] focus:ring-0 placeholder-icloud-text-secondary transition-colors hover:bg-icloud-text-secondary/15"
        />
        {searchTerm && (
          <button 
            onClick={onClearSearch}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-icloud-text-primary/5 rounded-full"
          >
            <X className="w-4 h-4 text-icloud-text-secondary" />
          </button>
        )}
      </div>
      {(showFilterBar || activeListFilters.size > 0) && (
        <FilterBar
          activeFilters={activeListFilters}
          onToggleFilter={onToggleListFilter}
        />
      )}
    </header>
  )
}
