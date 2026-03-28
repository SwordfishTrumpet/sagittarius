import { Search, Filter, Square, ChevronRight, X } from 'lucide-react'
import { FilterBar } from './FilterBar'

export interface MessageListHeaderProps {
  title: string
  isSidebarCollapsed: boolean
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
    <header className="px-4 py-3 border-b border-[#E5E5E5] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSidebarCollapsed && (
            <button
              onClick={onShowSidebar}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Show Sidebar"
            >
              <ChevronRight className="w-5 h-5 text-[#8E8E93]" strokeWidth={1.5} />
            </button>
          )}
          {emails && emails.length > 0 && (
            <button 
              onClick={() => allSelected ? onClearSelection() : onSelectAll()}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={allSelected ? 'Deselect all' : 'Select all'}
            >
              <Square className={`w-5 h-5 ${allSelected ? 'fill-[#007AFF] text-[#007AFF]' : 'text-[#8E8E93]'} stroke-[1.5]`} />
            </button>
          )}
          <h2 className="text-[17px] font-bold truncate">
            {selectedEmailIds.size > 0 ? `${selectedEmailIds.size} selected` : title}
          </h2>
        </div>
        <div className="flex gap-4">
           <div className="relative">
             <button 
               onClick={onToggleFilterBar}
               className="p-1 hover:bg-gray-100 rounded transition-colors"
             >
               <Filter className={`w-4 h-4 ${activeListFilters.size > 0 ? 'text-[#007AFF] fill-[#007AFF]/20' : 'text-[#007AFF]'}`} strokeWidth={1.25} />
             </button>
             {activeListFilters.size > 0 && (
               <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#007AFF] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                 {activeListFilters.size}
               </span>
             )}
           </div>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E8E93]" />
        <input 
          type="text" 
          placeholder="Search" 
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#8E8E93]/10 border-none rounded-lg py-1.5 pl-9 pr-4 text-[14px] focus:ring-0 placeholder-[#8E8E93] transition-colors hover:bg-[#8E8E93]/15"
        />
        {searchTerm && (
          <button 
            onClick={onClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-black/5 rounded-full"
          >
            <X className="w-3 h-3 text-[#8E8E93]" />
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
