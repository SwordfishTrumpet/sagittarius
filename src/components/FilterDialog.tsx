import { useState, useEffect, useCallback } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { BaseDialog } from './dialogs/BaseDialog'
import type { FilterState, HeaderFilterEntry } from '../hooks/useListFilters'

interface FilterDialogProps {
  isOpen: boolean
  onClose: () => void
  currentFilters: FilterState
  onApply: (filters: FilterState) => void
  onClear: () => void
}

let _headerIdCounter = 0
function generateHeaderId(): string {
  return `hf_${++_headerIdCounter}`
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer min-h-[44px] rounded-lg px-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onChange}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
          checked ? 'bg-icloud-accent border-icloud-accent' : 'border-icloud-text-tertiary'
        }`}
      >
        {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />}
      </button>
      <span className="text-[14px] text-icloud-text-primary font-medium select-none">{label}</span>
    </label>
  )
}

export function FilterDialog({ isOpen, onClose, currentFilters, onApply, onClear }: FilterDialogProps) {
  const [unread, setUnread] = useState(false)
  const [flagged, setFlagged] = useState(false)
  const [toMe, setToMe] = useState(false)
  const [attachments, setAttachments] = useState(false)
  const [headerFilters, setHeaderFilters] = useState<HeaderFilterEntry[]>([])

  useEffect(() => {
    if (isOpen) {
      setUnread(currentFilters.unread)
      setFlagged(currentFilters.flagged)
      setToMe(currentFilters.toMe)
      setAttachments(currentFilters.attachments)
      setHeaderFilters(
        currentFilters.headerFilters.length > 0
          ? currentFilters.headerFilters.map(hf => ({ ...hf }))
          : []
      )
    }
  }, [isOpen, currentFilters])

  const addHeaderFilter = useCallback(() => {
    setHeaderFilters(prev => [...prev, { id: generateHeaderId(), headerName: '', value: '' }])
  }, [])

  const removeHeaderFilter = useCallback((id: string) => {
    setHeaderFilters(prev => prev.filter(hf => hf.id !== id))
  }, [])

  const updateHeaderName = useCallback((id: string, headerName: string) => {
    setHeaderFilters(prev => prev.map(hf => (hf.id === id ? { ...hf, headerName } : hf)))
  }, [])

  const updateHeaderValue = useCallback((id: string, value: string) => {
    setHeaderFilters(prev => prev.map(hf => (hf.id === id ? { ...hf, value } : hf)))
  }, [])

  const handleApply = useCallback(() => {
    onApply({ unread, flagged, toMe, attachments, headerFilters })
  }, [unread, flagged, toMe, attachments, headerFilters, onApply])

  const handleClear = useCallback(() => {
    onClear()
  }, [onClear])

  return (
    <BaseDialog isOpen={isOpen} onClose={onClose} title="Filter Messages" titleId="filter-dialog-title">
      <div className="p-6 space-y-5">
        <div className="space-y-1">
          <Checkbox checked={unread} onChange={() => setUnread(prev => !prev)} label="Unread" />
          <Checkbox checked={flagged} onChange={() => setFlagged(prev => !prev)} label="Flagged" />
          <Checkbox checked={toMe} onChange={() => setToMe(prev => !prev)} label="To Me" />
          <Checkbox checked={attachments} onChange={() => setAttachments(prev => !prev)} label="Attachments" />
        </div>

        <div className="border-t border-icloud-border" />

        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-icloud-text-secondary uppercase tracking-wide">Headers</h3>

          {headerFilters.map(hf => (
            <div key={hf.id} className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={hf.headerName}
                  onChange={e => updateHeaderName(hf.id, e.target.value)}
                  placeholder="Header name (e.g. List-Id)"
                  className="w-full bg-icloud-bg-layer1 border border-icloud-border rounded-lg px-3 py-2 text-[13px] text-icloud-text-primary focus:outline-none focus:ring-2 focus:ring-icloud-accent placeholder-icloud-text-tertiary"
                />
                <input
                  type="text"
                  value={hf.value}
                  onChange={e => updateHeaderValue(hf.id, e.target.value)}
                  placeholder="Value contains... (leave empty for exists)"
                  className="w-full bg-icloud-bg-layer1 border border-icloud-border rounded-lg px-3 py-2 text-[13px] text-icloud-text-primary focus:outline-none focus:ring-2 focus:ring-icloud-accent placeholder-icloud-text-tertiary"
                />
              </div>
              <button
                type="button"
                onClick={() => removeHeaderFilter(hf.id)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-icloud-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors mt-1"
                aria-label="Remove header filter"
              >
                <X className="w-4 h-4" strokeWidth={1.25} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addHeaderFilter}
            className="flex items-center gap-1.5 text-[13px] text-icloud-accent font-medium hover:bg-icloud-accent/5 rounded-lg px-3 py-2 transition-colors min-h-[36px]"
          >
            <Plus className="w-4 h-4" strokeWidth={1.25} />
            Add Header Filter
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-icloud-border">
        <button
          type="button"
          onClick={handleClear}
          className="text-[13px] text-icloud-text-secondary font-medium hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 min-h-[36px]"
        >
          Clear All
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-icloud-text-secondary font-medium hover:bg-icloud-text-primary/5 px-4 py-2 rounded-lg transition-colors min-h-[36px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="text-[13px] text-white font-semibold bg-icloud-accent hover:bg-icloud-accent/90 px-5 py-2 rounded-lg transition-colors min-h-[36px]"
          >
            Apply
          </button>
        </div>
      </div>
    </BaseDialog>
  )
}
