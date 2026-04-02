/**
 * Hook for managing mailbox tree expansion state
 * Persists expanded/collapsed folder states and provides utility functions
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { MailboxNode, toggleMailboxExpanded, expandMailboxPath } from '../utils/mailboxTree';

const EXPANSION_STATE_KEY = 'sagittarius_mailbox_expansion';

export function useMailboxExpansion(mailboxTree: MailboxNode[]) {
  const [treeState, setTreeState] = useState<MailboxNode[]>(mailboxTree);
  const persistenceAppliedRef = useRef(false);

  // Load persisted expansion state on mount, and update when mailboxTree changes
  useEffect(() => {
    // If persistence hasn't been applied yet, try to load from localStorage
    if (!persistenceAppliedRef.current) {
      try {
        const saved = localStorage.getItem(EXPANSION_STATE_KEY);
        if (saved) {
          const expandedIds = new Set<string>(JSON.parse(saved));
          const updatedTree = applyExpansionState(mailboxTree, expandedIds);
          setTreeState(updatedTree);
          persistenceAppliedRef.current = true;
          return;
        }
      } catch {
        // Silently fail if localStorage is unavailable or corrupt
      }
      persistenceAppliedRef.current = true;
    }
    
    // Apply expansion state from current treeState to new mailboxTree structure
    // This preserves user's expansion choices while updating the underlying tree
    const currentExpandedIds = collectExpandedIds(treeState);
    const mergedTree = applyExpansionState(mailboxTree, currentExpandedIds);
    setTreeState(mergedTree);
  }, [mailboxTree]);

  const toggleExpanded = useCallback(
    (mailboxId: string) => {
      const updated = toggleMailboxExpanded(treeState, mailboxId);
      setTreeState(updated);
      persistExpansionState(updated);
    },
    [treeState]
  );

  const expandPath = useCallback(
    (mailboxId: string) => {
      const updated = expandMailboxPath(treeState, mailboxId);
      setTreeState(updated);
      persistExpansionState(updated);
    },
    [treeState]
  );

  const expandAll = useCallback(() => {
    const updated = recursivelyExpand(treeState, true);
    setTreeState(updated);
    persistExpansionState(updated);
  }, [treeState]);

  const collapseAll = useCallback(() => {
    const updated = recursivelyExpand(treeState, false);
    setTreeState(updated);
    persistExpansionState(updated);
  }, [treeState]);

  return {
    mailboxTree: treeState,
    toggleExpanded,
    expandPath,
    expandAll,
    collapseAll,
  };
}

/**
 * Collect all expanded mailbox IDs from tree
 */
function collectExpandedIds(nodes: MailboxNode[]): Set<string> {
  const ids = new Set<string>();

  const traverse = (nodeList: MailboxNode[]) => {
    nodeList.forEach((node) => {
      if (node.isExpanded) {
        ids.add(node.id);
      }
      if (node.children.length > 0) {
        traverse(node.children);
      }
    });
  };

  traverse(nodes);
  return ids;
}

/**
 * Persist expansion state to localStorage
 */
function persistExpansionState(nodes: MailboxNode[]) {
  try {
    const expandedIds = collectExpandedIds(nodes);
    localStorage.setItem(EXPANSION_STATE_KEY, JSON.stringify(Array.from(expandedIds)));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Apply a set of expanded IDs to the tree structure
 */
function applyExpansionState(
  nodes: MailboxNode[],
  expandedIds: Set<string>
): MailboxNode[] {
  return nodes.map((node) => ({
    ...node,
    isExpanded: expandedIds.has(node.id) || node.role === 'inbox',
    children:
      node.children.length > 0
        ? applyExpansionState(node.children, expandedIds)
        : [],
  }));
}

/**
 * Recursively set expansion state for entire tree
 */
function recursivelyExpand(nodes: MailboxNode[], expand: boolean): MailboxNode[] {
  return nodes.map((node) => ({
    ...node,
    isExpanded: expand || node.role === 'inbox',
    children:
      node.children.length > 0 ? recursivelyExpand(node.children, expand) : [],
  }));
}
