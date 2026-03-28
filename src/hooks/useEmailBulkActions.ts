import { toast } from 'sonner'
import { useEmailActions } from './useJMAP'

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
          onClick: () => {
            idsToArchive.forEach(id => {
              const original = originalMailboxIds.get(id)
              if (original) {
                moveEmail.mutate({ emailId: id, mailboxIds: original })
              }
            })
          }
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
          onClick: () => {
            idsToDelete.forEach(id => {
              const original = originalMailboxIds.get(id)
              if (original) {
                moveEmail.mutate({ emailId: id, mailboxIds: original })
              }
            })
          }
        }
      })
    }
  }

  return { handleArchive, handleDelete, moveEmail, moveEmailBulk }
}
