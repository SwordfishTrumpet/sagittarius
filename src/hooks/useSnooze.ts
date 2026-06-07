import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useEmailActions } from './jmap/useEmailMutations'

const SNOOZE_STORAGE_KEY = 'sagittarius_snoozed_emails'

interface SnoozeRecord {
  emailId: string
  snoozedUntil: string
}

function getSnoozeRecords(): SnoozeRecord[] {
  try {
    const stored = sessionStorage.getItem(SNOOZE_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveSnoozeRecords(records: SnoozeRecord[]): void {
  sessionStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(records))
}

export function useSnooze() {
  const { updateKeywords } = useEmailActions()
  const queryClient = useQueryClient()
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const snoozeEmail = useCallback((emailId: string, until: Date) => {
    const records = getSnoozeRecords().filter(r => r.emailId !== emailId)
    records.push({ emailId, snoozedUntil: until.toISOString() })
    saveSnoozeRecords(records)

    updateKeywords.mutate({ emailId, keywords: { $snoozed: true } })

    const existingTimer = timersRef.current.get(emailId)
    if (existingTimer) clearTimeout(existingTimer)

    const timeUntilUnsnooze = until.getTime() - Date.now()
    if (timeUntilUnsnooze > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(emailId)
        const currentRecords = getSnoozeRecords().filter(r => r.emailId !== emailId)
        saveSnoozeRecords(currentRecords)
        updateKeywords.mutate({ emailId, keywords: { $snoozed: false } })
        queryClient.invalidateQueries({ queryKey: ['emails'] })
      }, timeUntilUnsnooze)
      timersRef.current.set(emailId, timer)
    }
  }, [updateKeywords, queryClient])

  const unsnoozeEmail = useCallback((emailId: string) => {
    const records = getSnoozeRecords().filter(r => r.emailId !== emailId)
    saveSnoozeRecords(records)

    const existingTimer = timersRef.current.get(emailId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      timersRef.current.delete(emailId)
    }

    updateKeywords.mutate({ emailId, keywords: { $snoozed: false } })
    queryClient.invalidateQueries({ queryKey: ['emails'] })
  }, [updateKeywords, queryClient])

  const isSnoozed = useCallback((emailId: string): boolean => {
    return getSnoozeRecords().some(r => r.emailId === emailId)
  }, [])

  const getSnoozedUntil = useCallback((emailId: string): Date | null => {
    const record = getSnoozeRecords().find(r => r.emailId === emailId)
    return record ? new Date(record.snoozedUntil) : null
  }, [])

  return { snoozeEmail, unsnoozeEmail, isSnoozed, getSnoozedUntil }
}
