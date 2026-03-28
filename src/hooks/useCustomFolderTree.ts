import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { useMailboxReorder } from './useJMAP'
import { classifyMailboxes } from '../utils/mailboxClassifier'
import { buildMailboxTree, type MailboxNode } from '../utils/mailboxTree'

export function useCustomFolderTree(mailboxes: any[] | undefined) {
  const { reorderMailbox, reparentMailbox } = useMailboxReorder()
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Build the custom folders tree with expansion state
  const customFolderTree = useMemo(() => {
    if (!mailboxes) return []

    const { custom } = classifyMailboxes(mailboxes)
    const tree = buildMailboxTree(custom)

    const updateExpansionInTree = (nodes: MailboxNode[]): MailboxNode[] => {
      return nodes.map(node => ({
        ...node,
        isExpanded: expandedFolders.has(node.id),
        children: node.children.length > 0 ? updateExpansionInTree(node.children) : [],
      }))
    }

    return updateExpansionInTree(tree)
  }, [mailboxes, expandedFolders])

  // Handle mailbox drag reordering: place dragged before target
  const handleMailboxReorder = useCallback((draggedId: string, targetId: string) => {
    if (!mailboxes) return
    const { custom } = classifyMailboxes(mailboxes)
    const sorted = [...custom].sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
    const dragIdx = sorted.findIndex((m: any) => m.id === draggedId)
    const targetIdx = sorted.findIndex((m: any) => m.id === targetId)
    if (dragIdx === -1 || targetIdx === -1 || dragIdx === targetIdx) return

    const [dragged] = sorted.splice(dragIdx, 1)
    const newTargetIdx = sorted.findIndex((m: any) => m.id === targetId)
    sorted.splice(newTargetIdx, 0, dragged)

    const updates = sorted.map((m: any, i: number) => ({
      mailboxId: m.id,
      sortOrder: i + 1,
    }))
    reorderMailbox.mutate(updates)
    toast.success('Folders reordered')
  }, [mailboxes, reorderMailbox])

  // Handle mailbox reparenting: drop a folder INTO another folder
  const handleMailboxReparent = useCallback((draggedId: string, newParentId: string | null) => {
    reparentMailbox.mutate({ mailboxId: draggedId, newParentId })
    toast.success(newParentId ? 'Folder moved into subfolder' : 'Folder moved to top level')
  }, [reparentMailbox])

  const handleToggleFolderExpanded = (mailboxId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(mailboxId)) {
        newSet.delete(mailboxId)
      } else {
        newSet.add(mailboxId)
      }
      return newSet
    })
  }

  return {
    customFolderTree,
    handleMailboxReorder,
    handleMailboxReparent,
    handleToggleFolderExpanded,
  }
}
