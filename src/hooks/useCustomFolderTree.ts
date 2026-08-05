import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { useMailboxReorder } from './jmap/useMailboxes'
import { classifyMailboxes } from '../utils/mailboxClassifier'
import { buildMailboxTree, type MailboxNode } from '../utils/mailboxTree'
import type { Mailbox } from '../types/jmap'

export function useCustomFolderTree(mailboxes: Mailbox[] | undefined) {
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

  // True when `mailboxId` is (transitively) nested inside `ancestorId`.
  const isDescendant = useCallback((mailboxId: string, ancestorId: string): boolean => {
    if (!mailboxes) return false
    const parentOf = (id: string): string | null =>
      mailboxes.find((m: Mailbox) => m.id === id)?.parentId ?? null
    let current = parentOf(mailboxId)
    while (current) {
      if (current === ancestorId) return true
      current = parentOf(current)
    }
    return false
  }, [mailboxes])

  // Handle mailbox drag reordering: place dragged before target
  const handleMailboxReorder = useCallback((draggedId: string, targetId: string) => {
    if (!mailboxes) return
    const { system, custom } = classifyMailboxes(mailboxes)
    const sorted = [...custom].sort((a: Mailbox, b: Mailbox) => (a.sortOrder || 0) - (b.sortOrder || 0))
    const dragIdx = sorted.findIndex((m: Mailbox) => m.id === draggedId)
    const targetIdx = sorted.findIndex((m: Mailbox) => m.id === targetId)
    if (dragIdx === -1 || targetIdx === -1 || dragIdx === targetIdx) return

    const [dragged] = sorted.splice(dragIdx, 1)
    const newTargetIdx = sorted.findIndex((m: Mailbox) => m.id === targetId)
    sorted.splice(newTargetIdx, 0, dragged)

    // Number custom folders starting AFTER the highest system sortOrder so the
    // values never collide with server-assigned system folder orders.
    const maxSystemOrder = system.reduce((max: number, m: Mailbox) => Math.max(max, m.sortOrder || 0), 0)
    const baseOrder = maxSystemOrder + 1
    const updates = sorted.map((m: Mailbox, i: number) => ({
      mailboxId: m.id,
      sortOrder: baseOrder + i,
    }))
    reorderMailbox.mutate(updates)
    toast.success('Folders reordered')
  }, [mailboxes, reorderMailbox])

  // Handle mailbox reparenting: drop a folder INTO another folder
  const handleMailboxReparent = useCallback((draggedId: string, newParentId: string | null) => {
    // Reject dropping a folder into itself or one of its own descendants:
    // that would create a cyclic hierarchy the server may reject or persist.
    // isDescendant(X, Y) means "X lives inside Y", so we check whether the
    // NEW PARENT lives inside the DRAGGED folder.
    if (newParentId === draggedId || (newParentId && isDescendant(newParentId, draggedId))) {
      toast.error('Cannot move a folder into itself or its own subfolder')
      return
    }
    reparentMailbox.mutate({ mailboxId: draggedId, newParentId })
    toast.success(newParentId ? 'Folder moved into subfolder' : 'Folder moved to top level')
  }, [reparentMailbox, isDescendant])

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
