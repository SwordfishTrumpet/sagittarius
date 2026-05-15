import { toast } from 'sonner'
import { useEmailActions } from './jmap/useEmailMutations'
import type { Email, Mailbox } from '../types/jmap'

interface UseEmailBulkActionsParams {
  emails: Email[] | undefined
  mailboxes: Mailbox[] | undefined
  selectedEmailId: string | null
  selectedEmailIds: Set<string>
  selectedMailboxId: string | null
  resetSelection: () => void
}

export function useEmailBulkActions({
  emails,
  mailboxes,
  selectedEmailId,
  selectedEmailIds,
  selectedMailboxId,
  resetSelection,
}: UseEmailBulkActionsParams) {
  const { moveEmail, moveEmailBulk, destroyEmail, destroyEmailBulk } = useEmailActions()

  // Helper to find the trash mailbox
  const findTrashMailbox = () => {
    return mailboxes?.find((m: Mailbox) => 
      m.role === 'trash' || 
      m.name.toLowerCase() === 'trash' || 
      m.name.toLowerCase() === 'deleted items'
    )
  }

  // Check if currently viewing the trash mailbox
  const isInTrashMailbox = () => {
    const trashBox = findTrashMailbox()
    return trashBox && selectedMailboxId === trashBox.id
  }

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

    const archiveBox = mailboxes.find((m: Mailbox) => m.role === 'archive' || m.name.toLowerCase() === 'archive')
    if (archiveBox) {
      const originalMailboxIds = new Map<string, Record<string, boolean>>()
      idsToArchive.forEach(id => {
        const email = emails?.find((e: Email) => e.id === id)
        if (email?.mailboxIds) {
          originalMailboxIds.set(id, email.mailboxIds)
        }
      })

      const mutationPromise = idsToArchive.length === 1
        ? moveEmail.mutateAsync({ emailId: idsToArchive[0], mailboxIds: { [archiveBox.id]: true } })
        : moveEmailBulk.mutateAsync({ emailIds: idsToArchive, mailboxIds: { [archiveBox.id]: true } })

      resetSelection()

      mutationPromise.then(() => {
        toast.success(`${idsToArchive.length} message${idsToArchive.length > 1 ? 's' : ''} archived`, {
          action: {
            label: 'Undo',
            onClick: () => restoreMailboxSelection(idsToArchive, originalMailboxIds)
          }
        })
      }).catch(() => {})
    }
  }

  const handleDelete = () => {
    const idsToDelete = selectedEmailIds.size > 0 ? Array.from(selectedEmailIds) : (selectedEmailId ? [selectedEmailId] : [])
    if (!idsToDelete.length || !mailboxes) return

    // If already in trash, permanently delete
    if (isInTrashMailbox()) {
      const destroyPromise = idsToDelete.length === 1
        ? destroyEmail.mutateAsync({ emailId: idsToDelete[0] })
        : destroyEmailBulk.mutateAsync({ emailIds: idsToDelete })

      resetSelection()

      destroyPromise.then(() => {
        toast.success(`${idsToDelete.length} message${idsToDelete.length > 1 ? 's' : ''} permanently deleted`, {
          action: {
            label: 'Undo',
            onClick: () => {
              toast.info('Cannot undo permanent deletion')
            }
          }
        })
      }).catch(() => {})
      return
    }

    // Otherwise, move to trash
    const trashBox = findTrashMailbox()
    if (trashBox) {
      const originalMailboxIds = new Map<string, Record<string, boolean>>()
      idsToDelete.forEach(id => {
        const email = emails?.find((e: Email) => e.id === id)
        if (email?.mailboxIds) {
          originalMailboxIds.set(id, email.mailboxIds)
        }
      })

      const mutationPromise = idsToDelete.length === 1
        ? moveEmail.mutateAsync({ emailId: idsToDelete[0], mailboxIds: { [trashBox.id]: true } })
        : moveEmailBulk.mutateAsync({ emailIds: idsToDelete, mailboxIds: { [trashBox.id]: true } })

      resetSelection()

      mutationPromise.then(() => {
        toast.success(`${idsToDelete.length} message${idsToDelete.length > 1 ? 's' : ''} moved to Trash`, {
          action: {
            label: 'Undo',
            onClick: () => restoreMailboxSelection(idsToDelete, originalMailboxIds)
          }
        })
      }).catch(() => {})
    }
  }

  return { handleArchive, handleDelete, moveEmail, moveEmailBulk, destroyEmail, destroyEmailBulk }
}
