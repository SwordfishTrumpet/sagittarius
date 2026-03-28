/**
 * Hook for managing mailbox tree expansion state
 * Persists expanded/collapsed folder states and provides utility functions
 */

import { useCallback, useState, useEffect } from 'react';
import { MailboxNode, toggleMailboxExpanded, expandMailboxPath } from '../utils/mailboxTree';

const EXPANSION_STATE_KEY = 'sagittarius_mailbox_expansion';

export function useMailboxExpansion(mailboxTree: MailboxNode[]) {
  const [treeState, setTreeState] = useState<MailboxNode[]>(mailboxTree);

  // Load persisted expansion state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EXPANSION_STATE_KEY);
      if (saved) {
        const expandedIds = new Set<string>(JSON.parse(saved));
        const updatedTree = applyExpansionState(mailboxTree, expandedIds);
        setTreeState(updatedTree);
      } else {
        setTreeState(mailboxTree);
      }
    } catch {
      // Silently fail if localStorage is unavailable or corrupt
      setTreeState(mailboxTree);
    }
  }, []);

  // Update tree state when mailbox tree changes
  useEffect(() => {
    setTreeState(mailboxTree);
  }, [mailboxTree]);

  const toggleExpanded = useCallback(
    (mailboxId: string) => {
      const updated = toggleMailboxExpanded(treeState, mailboxId);
      setTreeState(updated);

      // Persist new state
      const expandedIds = collectExpandedIds(updated);
      localStorage.setItem(EXPANSION_STATE_KEY, JSON.stringify(Array.from(expandedIds)));
    },
    [treeState]
  );

  const expandPath = useCallback(
    (mailboxId: string) => {
      const updated = expandMailboxPath(treeState, mailboxId);
      setTreeState(updated);

      // Persist new state
      const expandedIds = collectExpandedIds(updated);
      localStorage.setItem(EXPANSION_STATE_KEY, JSON.stringify(Array.from(expandedIds)));
    },
    [treeState]
  );

  const expandAll = useCallback(() => {
    const updated = recursivelyExpand(treeState, true);
    setTreeState(updated);

    const expandedIds = collectExpandedIds(updated);
    localStorage.setItem(EXPANSION_STATE_KEY, JSON.stringify(Array.from(expandedIds)));
  }, [treeState]);

  const collapseAll = useCallback(() => {
    const updated = recursivelyExpand(treeState, false);
    setTreeState(updated);

    const expandedIds = collectExpandedIds(updated);
    localStorage.setItem(EXPANSION_STATE_KEY, JSON.stringify(Array.from(expandedIds)));
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
