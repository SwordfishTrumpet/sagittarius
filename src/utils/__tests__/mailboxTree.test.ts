import { describe, it, expect } from 'vitest';
import type { Mailbox } from '../../types/jmap';
import type { MailboxNode } from '../mailboxTree';
import {
  buildMailboxTree,
  flattenMailboxTree,
  findMailboxNode,
  getMailboxAncestors,
  toggleMailboxExpanded,
  expandMailboxPath,
  separateSystemMailboxes,
  getUnreadCountRecursive,
  updateNodeExpansionState,
} from '../mailboxTree';

// Test helper to cast mock trees
type MockNode = Partial<MailboxNode> & Pick<MailboxNode, 'id'>;
const mockNode = (n: MockNode): MailboxNode => ({
  name: 'Test',
  role: null,
  parentId: null,
  unreadEmails: 0,
  sortOrder: 0,
  depth: 0,
  isExpanded: false,
  children: [],
  ...n,
} as MailboxNode);

describe('mailboxTree', () => {
  // Test data factories
  const createMailbox = (id: string, name: string, overrides: Partial<Mailbox> = {}): Mailbox => ({
    id,
    name,
    role: overrides.role || null,
    parentId: overrides.parentId || null,
    sortOrder: overrides.sortOrder || 0,
    unreadEmails: overrides.unreadEmails || 0,
    totalEmails: overrides.totalEmails || 0,
    unreadThreads: overrides.unreadThreads || 0,
    totalThreads: overrides.totalThreads || 0,
    myRights: overrides.myRights || {
      mayReadItems: true,
      mayAddItems: true,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: true,
      mayRename: true,
      mayDelete: true,
      maySubmit: true,
    },
    isSubscribed: overrides.isSubscribed ?? true,
    ...overrides,
  });

  describe('buildMailboxTree', () => {
    it('should return empty array for empty input', () => {
      const result = buildMailboxTree([]);
      expect(result).toEqual([]);
    });

    it('should build tree from flat list with no parents', () => {
      const mailboxes = [
        createMailbox('1', 'Inbox', { role: 'inbox' }),
        createMailbox('2', 'Sent', { role: 'sent' }),
      ];
      const result = buildMailboxTree(mailboxes);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(result[0].children).toEqual([]);
    });

    it('should build nested tree with parent-child relationships', () => {
      const mailboxes = [
        createMailbox('1', 'Parent'),
        createMailbox('2', 'Child', { parentId: '1' }),
        createMailbox('3', 'Grandchild', { parentId: '2' }),
      ];
      const result = buildMailboxTree(mailboxes);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].id).toBe('2');
      expect(result[0].children[0].children[0].id).toBe('3');
    });

    it('should set correct depth for nested nodes', () => {
      const mailboxes = [
        createMailbox('1', 'Parent'),
        createMailbox('2', 'Child', { parentId: '1' }),
        createMailbox('3', 'Grandchild', { parentId: '2' }),
      ];
      const result = buildMailboxTree(mailboxes);
      expect(result[0].depth).toBe(0);
      expect(result[0].children[0].depth).toBe(1);
      expect(result[0].children[0].children[0].depth).toBe(2);
    });

    it('should handle multiple roots with children', () => {
      const mailboxes = [
        createMailbox('1', 'Work'),
        createMailbox('2', 'Work/ProjectA', { parentId: '1' }),
        createMailbox('3', 'Personal'),
        createMailbox('4', 'Personal/Family', { parentId: '3' }),
      ];
      const result = buildMailboxTree(mailboxes);
      expect(result).toHaveLength(2);
      expect(result[0].children).toHaveLength(1);
      expect(result[1].children).toHaveLength(1);
    });

    it('should sort roots by sortOrder', () => {
      const mailboxes = [
        createMailbox('1', 'Second', { sortOrder: 2 }),
        createMailbox('2', 'First', { sortOrder: 1 }),
        createMailbox('3', 'Third', { sortOrder: 3 }),
      ];
      const result = buildMailboxTree(mailboxes);
      expect(result[0].name).toBe('First');
      expect(result[1].name).toBe('Second');
      expect(result[2].name).toBe('Third');
    });

    it('should sort children by sortOrder', () => {
      const mailboxes = [
        createMailbox('1', 'Parent', { sortOrder: 1 }),
        createMailbox('2', 'Child C', { parentId: '1', sortOrder: 3 }),
        createMailbox('3', 'Child A', { parentId: '1', sortOrder: 1 }),
        createMailbox('4', 'Child B', { parentId: '1', sortOrder: 2 }),
      ];
      const result = buildMailboxTree(mailboxes);
      const children = result[0].children;
      expect(children[0].name).toBe('Child A');
      expect(children[1].name).toBe('Child B');
      expect(children[2].name).toBe('Child C');
    });

    it('should handle orphan nodes (parent not found) as roots', () => {
      const mailboxes = [
        createMailbox('1', 'Orphan', { parentId: 'nonexistent' }),
      ];
      const result = buildMailboxTree(mailboxes);
      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('nonexistent');
      expect(result[0].depth).toBe(0);
    });

    it('should expand inbox by default', () => {
      const mailboxes = [
        createMailbox('1', 'Inbox', { role: 'inbox' }),
        createMailbox('2', 'Child', { parentId: '1' }),
      ];
      const result = buildMailboxTree(mailboxes);
      expect(result[0].isExpanded).toBe(true);
    });

    it('should not expand non-inbox folders by default', () => {
      const mailboxes = [
        createMailbox('1', 'Work'),
        createMailbox('2', 'Child', { parentId: '1' }),
      ];
      const result = buildMailboxTree(mailboxes);
      expect(result[0].isExpanded).toBe(false);
    });

    it('should preserve mailbox properties on nodes', () => {
      const mailboxes = [
        createMailbox('1', 'Inbox', { 
          role: 'inbox', 
          unreadEmails: 5,
          sortOrder: 10 
        }),
      ];
      const result = buildMailboxTree(mailboxes);
      expect(result[0]).toMatchObject({
        id: '1',
        name: 'Inbox',
        role: 'inbox',
        unreadEmails: 5,
        sortOrder: 10,
      });
    });
  });

  describe('flattenMailboxTree', () => {
    it('should return empty array for empty tree', () => {
      const result = flattenMailboxTree([]);
      expect(result).toEqual([]);
    });

    it('should flatten single level tree', () => {
      const tree = [
        mockNode({ id: '1', name: 'A' }),
        mockNode({ id: '2', name: 'B' }),
      ];
      const result = flattenMailboxTree(tree);
      expect(result).toHaveLength(2);
    });

    it('should flatten nested tree in pre-order', () => {
      const tree = [
        mockNode({
          id: '1',
          name: 'Parent',
          children: [
            mockNode({
              id: '2',
              name: 'Child',
              children: [mockNode({ id: '3', name: 'Grandchild' })],
            }),
          ],
        }),
      ];
      const result = flattenMailboxTree(tree);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(result[2].id).toBe('3');
    });
  });

  describe('findMailboxNode', () => {
    const tree = [
      mockNode({
        id: '1',
        name: 'Parent',
        children: [
          mockNode({
            id: '2',
            name: 'Child',
            children: [mockNode({ id: '3', name: 'Grandchild' })],
          }),
        ],
      }),
    ];

    it('should find root node', () => {
      const result = findMailboxNode(tree, '1');
      expect(result?.id).toBe('1');
    });

    it('should find nested node', () => {
      const result = findMailboxNode(tree, '3');
      expect(result?.id).toBe('3');
      expect(result?.name).toBe('Grandchild');
    });

    it('should return null for non-existent node', () => {
      const result = findMailboxNode(tree, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should return null for empty tree', () => {
      const result = findMailboxNode([], '1');
      expect(result).toBeNull();
    });
  });

  describe('getMailboxAncestors', () => {
    const tree = [
      mockNode({
        id: '1',
        name: 'Grandparent',
        parentId: null,
        children: [
          mockNode({
            id: '2',
            name: 'Parent',
            parentId: '1',
            children: [
              mockNode({
                id: '3',
                name: 'Child',
                parentId: '2',
                children: [],
              }),
            ],
          }),
        ],
      }),
    ];

    it('should return empty array for root node', () => {
      const result = getMailboxAncestors(tree, '1');
      expect(result).toEqual([]);
    });

    it('should return single ancestor for direct child', () => {
      const result = getMailboxAncestors(tree, '2');
      expect(result).toEqual(['1']);
    });

    it('should return all ancestors for deeply nested node', () => {
      const result = getMailboxAncestors(tree, '3');
      expect(result).toEqual(['1', '2']);
    });

    it('should return empty array for non-existent node', () => {
      const result = getMailboxAncestors(tree, 'nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('toggleMailboxExpanded', () => {
    it('should toggle expansion state of target node', () => {
      const tree = [mockNode({ id: '1', isExpanded: false })];
      const result = toggleMailboxExpanded(tree, '1');
      expect(result[0].isExpanded).toBe(true);
    });

    it('should collapse expanded node', () => {
      const tree = [mockNode({ id: '1', isExpanded: true })];
      const result = toggleMailboxExpanded(tree, '1');
      expect(result[0].isExpanded).toBe(false);
    });

    it('should toggle nested node', () => {
      const tree = [
        mockNode({
          id: '1',
          isExpanded: true,
          children: [mockNode({ id: '2', isExpanded: false })],
        }),
      ];
      const result = toggleMailboxExpanded(tree, '2');
      expect(result[0].children[0].isExpanded).toBe(true);
      expect(result[0].isExpanded).toBe(true); // parent unchanged
    });

    it('should return unchanged tree for non-existent node', () => {
      const tree = [mockNode({ id: '1', isExpanded: false })];
      const result = toggleMailboxExpanded(tree, 'nonexistent');
      expect(result).toEqual(tree);
    });

    it('should not mutate original tree', () => {
      const tree = [mockNode({ id: '1', isExpanded: false })];
      const result = toggleMailboxExpanded(tree, '1');
      expect(tree[0].isExpanded).toBe(false); // original unchanged
      expect(result[0].isExpanded).toBe(true); // copy changed
    });
  });

  describe('expandMailboxPath', () => {
    const tree = [
      mockNode({
        id: '1',
        name: 'Root',
        role: null,
        parentId: null,
        isExpanded: false,
        children: [
          mockNode({
            id: '2',
            name: 'Parent',
            role: null,
            parentId: '1',
            isExpanded: false,
            children: [
              mockNode({
                id: '3',
                name: 'Target',
                role: null,
                parentId: '2',
                isExpanded: false,
                children: [],
              }),
            ],
          }),
        ],
      }),
    ];

    it('should expand all ancestors of target node', () => {
      const result = expandMailboxPath(tree, '3');
      expect(result[0].isExpanded).toBe(true); // Root expanded
      expect(result[0].children[0].isExpanded).toBe(true); // Parent expanded
      expect(result[0].children[0].children[0].isExpanded).toBe(false); // Target unchanged
    });

    it('should expand inbox nodes regardless of target', () => {
      const treeWithInbox = [
        mockNode({
          id: 'inbox-id',
          name: 'Inbox',
          role: 'inbox',
          isExpanded: false,
          children: [],
        }),
      ];
      const result = expandMailboxPath(treeWithInbox, 'nonexistent');
      expect(result[0].isExpanded).toBe(true);
    });
  });

  describe('separateSystemMailboxes', () => {
    it('should separate system and user mailboxes', () => {
      const tree = [
        mockNode({ id: '1', name: 'Inbox', role: 'inbox' }),
        mockNode({ id: '2', name: 'Work', role: null }),
        mockNode({ id: '3', name: 'Sent', role: 'sent' }),
      ];
      const result = separateSystemMailboxes(tree);
      expect(result.system).toHaveLength(2);
      expect(result.user).toHaveLength(1);
      expect(result.user[0].name).toBe('Work');
    });

    it('should return empty arrays for empty input', () => {
      const result = separateSystemMailboxes([]);
      expect(result.system).toEqual([]);
      expect(result.user).toEqual([]);
    });
  });

  describe('getUnreadCountRecursive', () => {
    it('should return own unread count for leaf node', () => {
      const node = mockNode({ id: '1', unreadEmails: 5 });
      expect(getUnreadCountRecursive(node)).toBe(5);
    });

    it('should include children unread counts', () => {
      const node = mockNode({
        id: '1',
        unreadEmails: 3,
        children: [
          mockNode({ id: '2', unreadEmails: 2 }),
          mockNode({ id: '3', unreadEmails: 4 }),
        ],
      });
      expect(getUnreadCountRecursive(node)).toBe(9);
    });

    it('should handle deeply nested unread counts', () => {
      const node = mockNode({
        id: '1',
        unreadEmails: 1,
        children: [
          mockNode({
            id: '2',
            unreadEmails: 2,
            children: [mockNode({ id: '3', unreadEmails: 3 })],
          }),
        ],
      });
      expect(getUnreadCountRecursive(node)).toBe(6);
    });

    it('should handle zero unread counts', () => {
      const node = mockNode({
        id: '1',
        unreadEmails: 0,
        children: [mockNode({ id: '2', unreadEmails: 0 })],
      });
      expect(getUnreadCountRecursive(node)).toBe(0);
    });

    it('should handle undefined unreadEmails', () => {
      const node = mockNode({ id: '1', unreadEmails: undefined as unknown as number });
      expect(getUnreadCountRecursive(node)).toBe(0);
    });
  });

  describe('updateNodeExpansionState', () => {
    it('should update expansion state of target node', () => {
      const tree = [mockNode({ id: '1', isExpanded: false })];
      const result = updateNodeExpansionState(tree, '1', true);
      expect(result[0].isExpanded).toBe(true);
    });

    it('should update nested node', () => {
      const tree = [
        mockNode({
          id: '1',
          isExpanded: true,
          children: [mockNode({ id: '2', isExpanded: false })],
        }),
      ];
      const result = updateNodeExpansionState(tree, '2', true);
      expect(result[0].children[0].isExpanded).toBe(true);
    });

    it('should not mutate original tree', () => {
      const tree = [mockNode({ id: '1', isExpanded: false })];
      const result = updateNodeExpansionState(tree, '1', true);
      expect(tree[0].isExpanded).toBe(false);
      expect(result[0].isExpanded).toBe(true);
    });
  });
});
