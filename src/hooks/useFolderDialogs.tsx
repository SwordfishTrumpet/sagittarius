import { useState } from 'react'
import { Edit2, Trash, FolderInput } from 'lucide-react'
import { toast } from 'sonner'
import { useMailboxActions } from './jmap/useMailboxes'
import { ContextMenu, type ContextMenuItemConfig } from '../components/ContextMenu'
import { CreateFolderDialog } from '../components/dialogs/CreateFolderDialog'
import { RenameFolderDialog } from '../components/dialogs/RenameFolderDialog'
import { DeleteFolderDialog } from '../components/dialogs/DeleteFolderDialog'
import type { Mailbox } from '../types/jmap'

interface UseFolderDialogsParams {
  selectedMailboxId: string | null
  setSelectedMailboxId: (id: string | null) => void
  mailboxes?: Mailbox[]
  onReparentMailbox?: (draggedId: string, newParentId: string | null) => void
}

export function useFolderDialogs({ selectedMailboxId, setSelectedMailboxId, mailboxes, onReparentMailbox }: UseFolderDialogsParams) {
  const { createMailbox, renameMailbox, deleteMailbox } = useMailboxActions()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [contextMenuTarget, setContextMenuTarget] = useState<{ type: 'mailbox' | 'email'; id: string } | null>(null)

  // Folder dialog state
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [renameFolderOpen, setRenameFolderOpen] = useState(false)
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedFolderName, setSelectedFolderName] = useState<string>('')

  const handleMailboxContextMenu = (mailboxId: string, mailboxName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedFolderId(mailboxId)
    setSelectedFolderName(mailboxName)
    setContextMenuTarget({ type: 'mailbox', id: mailboxId })
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleCreateFolder = async (folderName: string) => {
    try {
      await createMailbox.mutateAsync({ name: folderName })
      setCreateFolderOpen(false)
      toast.success(`Folder "${folderName}" created`)
    } catch (error) {
      toast.error(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleRenameFolder = async (newName: string) => {
    if (selectedFolderId) {
      try {
        await renameMailbox.mutateAsync({ mailboxId: selectedFolderId, newName })
        setRenameFolderOpen(false)
        toast.success(`Folder renamed to "${newName}"`)
      } catch (error) {
        toast.error(`Failed to rename folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  const handleDeleteFolder = async () => {
    if (selectedFolderId) {
      try {
        await deleteMailbox.mutateAsync({ mailboxId: selectedFolderId })
        setDeleteFolderOpen(false)
        if (selectedMailboxId === selectedFolderId) {
          setSelectedMailboxId(null)
        }
        toast.success(`Folder deleted`)
      } catch (error) {
        toast.error(`Failed to delete folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  const handleMoveToFolder = () => {
    if (!selectedFolderId) return
    const customMailboxes = (mailboxes || []).filter((m: Mailbox) => !m.role)
    const folderNames = customMailboxes.map((m: Mailbox) => m.name).join(', ')
    const parentName = window.prompt(
      `Enter the name of the parent folder to move "${selectedFolderName}" into.\nAvailable folders: ${folderNames || '(none)'}\nLeave empty to move to top level.`
    )
    if (parentName === null) return
    const newParentId = parentName.trim()
      ? (customMailboxes.find((m: Mailbox) => m.name.toLowerCase() === parentName.toLowerCase())?.id ?? null)
      : null
    if (parentName.trim() && !newParentId) {
      toast.error(`Folder "${parentName}" not found`)
      return
    }
    onReparentMailbox?.(selectedFolderId, newParentId)
    toast.success(newParentId ? `Moved "${selectedFolderName}" into subfolder` : `Moved "${selectedFolderName}" to top level`)
    setContextMenu(null)
  }

  const getMailboxContextMenu = (): ContextMenuItemConfig[] => {
    return [
      {
        id: 'rename',
        label: 'Rename',
        icon: <Edit2 className="w-4 h-4" strokeWidth={1.5} />,
        onSelect: () => {
          setRenameFolderOpen(true)
          setContextMenu(null)
        },
      },
      {
        id: 'move',
        label: 'Move to…',
        icon: <FolderInput className="w-4 h-4" strokeWidth={1.5} />,
        onSelect: handleMoveToFolder,
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <Trash className="w-4 h-4" strokeWidth={1.5} />,
        variant: 'destructive',
        onSelect: () => {
          setDeleteFolderOpen(true)
          setContextMenu(null)
        },
      },
    ]
  }

  const FolderDialogsUI = () => (
    <>
      {contextMenu && contextMenuTarget && (
        <ContextMenu
          items={getMailboxContextMenu()}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
      <CreateFolderDialog
        isOpen={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onConfirm={handleCreateFolder}
        isLoading={createMailbox.isPending}
      />
      <RenameFolderDialog
        isOpen={renameFolderOpen}
        folderName={selectedFolderName}
        onClose={() => setRenameFolderOpen(false)}
        onConfirm={handleRenameFolder}
        isLoading={renameMailbox.isPending}
      />
      <DeleteFolderDialog
        isOpen={deleteFolderOpen}
        folderName={selectedFolderName}
        onClose={() => setDeleteFolderOpen(false)}
        onConfirm={handleDeleteFolder}
        isLoading={deleteMailbox.isPending}
      />
    </>
  )

  return {
    handleMailboxContextMenu,
    openCreateFolder: () => setCreateFolderOpen(true),
    selectedFolderId,
    setSelectedFolderId,
    selectedFolderName,
    setSelectedFolderName,
    renameMailbox,
    deleteMailbox,
    FolderDialogsUI,
  }
}
