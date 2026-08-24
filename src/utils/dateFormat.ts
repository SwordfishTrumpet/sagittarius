import { format, isToday, isYesterday, getYear } from 'date-fns'

export const formatMessageDate = (dateStr: string) => {
  const d = new Date(dateStr)
  // Validate date before formatting
  if (isNaN(d.getTime())) {
    return ''
  }
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  // Show day name for last ~7 days, then "Jan 15" style — with the year
  // once the message is from a previous calendar year (BUG-2026-056;
  // matches iCloud Mail, which disambiguates "Jan 15" across years).
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 6)
  if (d >= weekAgo) return format(d, 'EEEE')
  return getYear(d) === new Date().getFullYear() ? format(d, 'MMM d') : format(d, 'MMM d, yyyy')
}
