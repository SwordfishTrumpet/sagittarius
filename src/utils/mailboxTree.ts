/**
 * Utility functions for building and managing nested mailbox hierarchies
 * RFC 8621: JMAP Mailboxes have optional parentId for nesting
 */

export interface MailboxNode {
  id: string;
  name: string;
  role?: string;
  parentId?: string | null;
  unreadEmails?: number;
  sortOrder?: number;
  children: MailboxNode[];
  isExpanded?: boolean;
  depth: number;
}

/**
 * Build a tree structure from flat mailbox array using parentId references
 * Supports RFC 8621 Mailbox objects with optional parentId property
 */
export function buildMailboxTree(flatMailboxes: any[]): MailboxNode[] {
  const mailboxMap = new Map<string, MailboxNode>();
  const roots: MailboxNode[] = [];

  // First pass: Create all nodes
  flatMailboxes.forEach((mailbox) => {
    const node: MailboxNode = {
      id: mailbox.id,
      name: mailbox.name,
      role: mailbox.role,
      parentId: mailbox.parentId || null,
      unreadEmails: mailbox.unreadEmails,
      sortOrder: mailbox.sortOrder || 0,
      children: [],
      depth: 0,
      isExpanded: mailbox.role === 'inbox', // Expand inbox by default
    };
    mailboxMap.set(mailbox.id, node);
  });

  // Second pass: Build parent-child relationships
  mailboxMap.forEach((node) => {
    if (node.parentId && mailboxMap.has(node.parentId)) {
      const parent = mailboxMap.get(node.parentId)!;
      parent.children.push(node);
      node.depth = parent.depth + 1;
    } else {
      // No parent or parent not found: it's a root
      roots.push(node);
    }
  });

  // Sort children at each level by sortOrder
  const sortChildren = (nodes: MailboxNode[]) => {
    nodes.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    nodes.forEach((node) => sortChildren(node.children));
  };

  sortChildren(roots);
  roots.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return roots;
}

/**
 * Flatten a tree back to array (useful for migrations or debugging)
 */
export function flattenMailboxTree(nodes: MailboxNode[]): MailboxNode[] {
  const result: MailboxNode[] = [];
  
  const traverse = (nodeList: MailboxNode[]) => {
    nodeList.forEach((node) => {
      result.push(node);
      if (node.children.length > 0) {
        traverse(node.children);
      }
    });
  };

  traverse(nodes);
  return result;
}

/**
 * Find a mailbox node by ID in the tree
 */
export function findMailboxNode(nodes: MailboxNode[], id: string): MailboxNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findMailboxNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get all ancestor IDs for a given mailbox (path up the tree)
 */
export function getMailboxAncestors(nodes: MailboxNode[], id: string): string[] {
  const ancestors: string[] = [];
  const node = findMailboxNode(nodes, id);
  
  if (!node) return ancestors;

  let current = node;
  while (current.parentId) {
    ancestors.unshift(current.parentId);
    const parent = findMailboxNode(nodes, current.parentId);
    if (!parent) break;
    current = parent;
  }

  return ancestors;
}

/**
 * Toggle expansion state of a mailbox node
 */
export function toggleMailboxExpanded(nodes: MailboxNode[], id: string): MailboxNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, isExpanded: !node.isExpanded };
    }
    if (node.children.length > 0) {
      return { ...node, children: toggleMailboxExpanded(node.children, id) };
    }
    return node;
  });
}

/**
 * Set expansion state for a mailbox and all ancestors (for showing context)
 */
export function expandMailboxPath(nodes: MailboxNode[], targetId: string): MailboxNode[] {
  const ancestors = getMailboxAncestors(nodes, targetId);
  const idsToExpand = new Set(ancestors);

  const expandRecursive = (nodeList: MailboxNode[]): MailboxNode[] => {
    return nodeList.map((node) => {
      const shouldExpand = idsToExpand.has(node.id) || node.role === 'inbox';
      return {
        ...node,
        isExpanded: shouldExpand,
        children: node.children.length > 0 ? expandRecursive(node.children) : [],
      };
    });
  };

  return expandRecursive(nodes);
}

/**
 * Separate system/role-based mailboxes from user-created folders
 * Useful for rendering "Smart Mailboxes" section separately
 */
export function separateSystemMailboxes(
  nodes: MailboxNode[]
): { system: MailboxNode[]; user: MailboxNode[] } {
  const system: MailboxNode[] = [];
  const user: MailboxNode[] = [];

  nodes.forEach((node) => {
    if (node.role) {
      system.push(node);
    } else {
      user.push(node);
    }
  });

  return { system, user };
}

/**
 * Get total unread count including all children
 */
export function getUnreadCountRecursive(node: MailboxNode): number {
  let count = node.unreadEmails || 0;
  node.children.forEach((child) => {
    count += getUnreadCountRecursive(child);
  });
  return count;
}

/**
 * Update expansion state for a specific mailbox node
 * Returns a new tree with the specified node's expansion state updated
 */
export function updateNodeExpansionState(
  nodes: MailboxNode[],
  nodeId: string,
  isExpanded: boolean
): MailboxNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, isExpanded };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: updateNodeExpansionState(node.children, nodeId, isExpanded),
      };
    }
    return node;
  });
}
