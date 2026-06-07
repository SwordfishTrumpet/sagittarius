import { useState, useRef, useEffect } from 'react'
import { Clock, Calendar } from 'lucide-react'
import { useSnooze } from '../hooks/useSnooze'

interface SnoozePickerProps {
  emailId: string
  onClose: () => void
}

const SNOOZE_OPTIONS = [
  { label: 'Later today', getTime: () => {
    const now = new Date()
    now.setHours(now.getHours() + 2)
    return now
  }},
  { label: 'Tomorrow', getTime: () => {
    const now = new Date()
    now.setDate(now.getDate() + 1)
    now.setHours(9, 0, 0, 0)
    return now
  }},
  { label: 'This weekend', getTime: () => {
    const now = new Date()
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7
    now.setDate(now.getDate() + daysUntilSaturday)
    now.setHours(9, 0, 0, 0)
    return now
  }},
  { label: 'Next week', getTime: () => {
    const now = new Date()
    const daysUntilMonday = (8 - now.getDay() + 7) % 7 || 7
    now.setDate(now.getDate() + daysUntilMonday)
    now.setHours(9, 0, 0, 0)
    return now
  }},
] as const

export function SnoozePicker({ emailId, onClose }: SnoozePickerProps) {
  const { snoozeEmail, unsnoozeEmail, getSnoozedUntil } = useSnooze()
  const [showCustom, setShowCustom] = useState(false)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)
  const snoozedUntil = getSnoozedUntil(emailId)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleSnooze = (getTime: () => Date) => {
    snoozeEmail(emailId, getTime())
    onClose()
  }

  const handleCustomSnooze = () => {
    if (!customDate || !customTime) return
    const date = new Date(`${customDate}T${customTime}`)
    if (isNaN(date.getTime())) return
    snoozeEmail(emailId, date)
    onClose()
  }

  const handleUnsnooze = () => {
    unsnoozeEmail(emailId)
    onClose()
  }

  return (
    <div
      ref={pickerRef}
      role="dialog"
      aria-label="Snooze email"
      className="absolute right-0 top-full mt-1 w-56 bg-icloud-card border border-icloud-border rounded-xl shadow-xl z-50 py-2"
    >
      {snoozedUntil && (
        <>
          <div className="px-4 py-2 text-[11px] text-icloud-text-secondary border-b border-icloud-border">
            Snoozed until {snoozedUntil.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
          <button
            onClick={handleUnsnooze}
            className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-icloud-text-primary hover:bg-icloud-bg-layer1 transition-colors text-left"
          >
            <Clock className="w-4 h-4 text-icloud-text-secondary shrink-0" strokeWidth={1.5} />
            Unsnooze
          </button>
          <div className="border-t border-icloud-border my-1" />
        </>
      )}
      {SNOOZE_OPTIONS.map((option) => (
        <button
          key={option.label}
          onClick={() => handleSnooze(option.getTime)}
          className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-icloud-text-primary hover:bg-icloud-bg-layer1 transition-colors text-left"
        >
          <Clock className="w-4 h-4 text-icloud-text-secondary shrink-0" strokeWidth={1.5} />
          {option.label}
        </button>
      ))}
      {showCustom ? (
        <div className="px-4 py-2 border-t border-icloud-border">
          <div className="flex gap-2 mb-2">
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="flex-1 text-[12px] px-2 py-1 rounded-lg border border-icloud-border bg-icloud-bg-primary text-icloud-text-primary"
              aria-label="Custom date"
            />
            <input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="flex-1 text-[12px] px-2 py-1 rounded-lg border border-icloud-border bg-icloud-bg-primary text-icloud-text-primary"
              aria-label="Custom time"
            />
          </div>
          <button
            onClick={handleCustomSnooze}
            disabled={!customDate || !customTime}
            className="w-full text-[12px] font-medium text-icloud-accent py-1 hover:opacity-70 transition-opacity disabled:opacity-30"
          >
            Set custom time
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCustom(true)}
          className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-icloud-text-primary hover:bg-icloud-bg-layer1 transition-colors text-left"
        >
          <Calendar className="w-4 h-4 text-icloud-text-secondary shrink-0" strokeWidth={1.5} />
          Custom
        </button>
      )}
    </div>
  )
}
