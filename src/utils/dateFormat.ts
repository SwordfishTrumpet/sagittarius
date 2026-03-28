import { format, isToday, isYesterday } from 'date-fns'

export const formatMessageDate = (dateStr: string) => {
  const d = new Date(dateStr)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  // Show day name for last ~7 days, then "Jan 15" style
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 6)
  if (d >= weekAgo) return format(d, 'EEEE')
  return format(d, 'MMM d')
}
