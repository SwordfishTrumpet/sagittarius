import { toast } from 'sonner'
import { useEmailActions } from './jmap/useEmailMutations'

interface UseEmailBulkActionsParams {
  emails: any[] | undefined
  mailboxes: any[] | undefined
  selectedEmailId: string | null
  selectedEmailIds: Set<string>
  resetSelection: () => void
}

export function useEmailBulkActions({
  emails,
  mailboxes,
  selectedEmailId,
  selectedEmailIds,
  resetSelection,
}: UseEmailBulkActionsParams) {
  const { moveEmail, moveEmailBulk } = useEmailActions()

  const restoreMailboxSelection = (
    emailIds: string[],
    originalMailboxIds: Map<string, Record<string, boolean>>,
  ) => {
    const groupedRestores = new Map<string, { emailIds: string[]; mailboxIds: Record<string, boolean> }>()

    emailIds.forEach((id) => {
      const mailboxIds = originalMailboxIds.get(id)
      if (!mailboxIds) return

      const signature = JSON.stringify(Object.entries(mailboxIds).sort(([left], [right]) => left.localeCompare(right)))
      const existingGroup = groupedRestores.get(signature)

      if (existingGroup) {
        existingGroup.emailIds.push(id)
        return
      }

      groupedRestores.set(signature, { emailIds: [id], mailboxIds })
    })

    groupedRestores.forEach(({ emailIds: groupedEmailIds, mailboxIds }) => {
      if (groupedEmailIds.length === 1) {
        moveEmail.mutate({ emailId: groupedEmailIds[0], mailboxIds })
        return
      }

      moveEmailBulk.mutate({ emailIds: groupedEmailIds, mailboxIds })
    })
  }

  const handleArchive = () => {
    const idsToArchive = selectedEmailIds.size > 0 ? Array.from(selectedEmailIds) : (selectedEmailId ? [selectedEmailId] : [])
    if (!idsToArchive.length || !mailboxes) return

    const archiveBox = mailboxes.find((m: any) => m.role === 'archive' || m.name.toLowerCase() === 'archive')
    if (archiveBox) {
      const originalMailboxIds = new Map<string, Record<string, boolean>>()
      idsToArchive.forEach(id => {
        const email = emails?.find((e: any) => e.id === id)
        if (email?.mailboxIds) {
          originalMailboxIds.set(id, email.mailboxIds)
        }
      })

      if (idsToArchive.length === 1) {
        moveEmail.mutate({ emailId: idsToArchive[0], mailboxIds: { [archiveBox.id]: true } })
      } else {
        moveEmailBulk.mutate({ emailIds: idsToArchive, mailboxIds: { [archiveBox.id]: true } })
      }

      resetSelection()

      toast.success(`${idsToArchive.length} message${idsToArchive.length > 1 ? 's' : ''} archived`, {
        action: {
          label: 'Undo',
          onClick: () => restoreMailboxSelection(idsToArchive, originalMailboxIds)
        }
      })
    }
  }

  const handleDelete = () => {
    const idsToDelete = selectedEmailIds.size > 0 ? Array.from(selectedEmailIds) : (selectedEmailId ? [selectedEmailId] : [])
    if (!idsToDelete.length || !mailboxes) return

    const trashBox = mailboxes.find((m: any) => m.role === 'trash' || m.name.toLowerCase() === 'trash' || m.name.toLowerCase() === 'deleted items')
    if (trashBox) {
      const originalMailboxIds = new Map<string, Record<string, boolean>>()
      idsToDelete.forEach(id => {
        const email = emails?.find((e: any) => e.id === id)
        if (email?.mailboxIds) {
          originalMailboxIds.set(id, email.mailboxIds)
        }
      })

      if (idsToDelete.length === 1) {
        moveEmail.mutate({ emailId: idsToDelete[0], mailboxIds: { [trashBox.id]: true } })
      } else {
        moveEmailBulk.mutate({ emailIds: idsToDelete, mailboxIds: { [trashBox.id]: true } })
      }

      resetSelection()

      toast.success(`${idsToDelete.length} message${idsToDelete.length > 1 ? 's' : ''} moved to Trash`, {
        action: {
          label: 'Undo',
          onClick: () => restoreMailboxSelection(idsToDelete, originalMailboxIds)
        }
      })
    }
  }

  return { handleArchive, handleDelete, moveEmail, moveEmailBulk }
}
