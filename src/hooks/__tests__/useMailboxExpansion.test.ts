import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMailboxExpansion } from '../useMailboxExpansion';
import type { MailboxNode } from '../../utils/mailboxTree';

// Mock mailboxTree utils
vi.mock('../../utils/mailboxTree', () => ({
  toggleMailboxExpanded: vi.fn((nodes: MailboxNode[], id: string) =>
    nodes.map((n) => (n.id === id ? { ...n, isExpanded: !n.isExpanded } : n))
  ),
  expandMailboxPath: vi.fn((nodes: MailboxNode[], id: string) =>
    nodes.map((n) => (n.id === id ? { ...n, isExpanded: true } : n))
  ),
}));

function createMailboxNode(overrides: Partial<MailboxNode> & { id: string }): MailboxNode {
  return {
    id: overrides.id,
    name: overrides.name || 'Mailbox',
    role: overrides.role || null,
    parentId: overrides.parentId || null,
    unreadEmails: 0,
    sortOrder: 0,
    children: [],
    depth: 0,
    isExpanded: overrides.isExpanded ?? false,
  };
}

describe('useMailboxExpansion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with the provided mailbox tree', () => {
    const tree = [createMailboxNode({ id: 'inbox', name: 'Inbox' })];
    const { result } = renderHook(() => useMailboxExpansion(tree));

    expect(result.current.mailboxTree).toHaveLength(1);
    expect(result.current.mailboxTree[0].id).toBe('inbox');
  });

  it('toggles expansion state of a mailbox', () => {
    const tree = [createMailboxNode({ id: 'inbox', name: 'Inbox', isExpanded: false })];
    const { result } = renderHook(() => useMailboxExpansion(tree));

    act(() => {
      result.current.toggleExpanded('inbox');
    });

    expect(result.current.mailboxTree[0].isExpanded).toBe(true);
  });

  it('expands a mailbox path', () => {
    const tree = [createMailboxNode({ id: 'inbox', name: 'Inbox', isExpanded: false })];
    const { result } = renderHook(() => useMailboxExpansion(tree));

    act(() => {
      result.current.expandPath('inbox');
    });

    expect(result.current.mailboxTree[0].isExpanded).toBe(true);
  });

  it('expands all mailboxes', () => {
    const tree = [
      createMailboxNode({ id: 'a', name: 'A', isExpanded: false }),
      createMailboxNode({ id: 'b', name: 'B', isExpanded: false }),
    ];
    const { result } = renderHook(() => useMailboxExpansion(tree));

    act(() => {
      result.current.expandAll();
    });

    expect(result.current.mailboxTree.every((n) => n.isExpanded)).toBe(true);
  });

  it('collapses all mailboxes except inbox', () => {
    const tree = [
      createMailboxNode({ id: 'inbox', name: 'Inbox', role: 'inbox', isExpanded: true }),
      createMailboxNode({ id: 'sent', name: 'Sent', isExpanded: true }),
    ];
    const { result } = renderHook(() => useMailboxExpansion(tree));

    act(() => {
      result.current.collapseAll();
    });

    expect(result.current.mailboxTree.find((n) => n.id === 'inbox')!.isExpanded).toBe(true);
    expect(result.current.mailboxTree.find((n) => n.id === 'sent')!.isExpanded).toBe(false);
  });

  it('persists expansion state to localStorage', () => {
    const tree = [createMailboxNode({ id: 'inbox', name: 'Inbox', isExpanded: false })];
    const { result } = renderHook(() => useMailboxExpansion(tree));

    act(() => {
      result.current.toggleExpanded('inbox');
    });

    const saved = localStorage.getItem('sagittarius_mailbox_expansion');
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved!)).toContain('inbox');
  });

  it('restores expansion state from localStorage on mount', () => {
    localStorage.setItem('sagittarius_mailbox_expansion', JSON.stringify(['sent']));

    const tree = [
      createMailboxNode({ id: 'inbox', name: 'Inbox', isExpanded: false }),
      createMailboxNode({ id: 'sent', name: 'Sent', isExpanded: false }),
    ];
    const { result } = renderHook(() => useMailboxExpansion(tree));

    expect(result.current.mailboxTree.find((n) => n.id === 'sent')!.isExpanded).toBe(true);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('sagittarius_mailbox_expansion', 'not-json');

    const tree = [createMailboxNode({ id: 'inbox', name: 'Inbox' })];
    const { result } = renderHook(() => useMailboxExpansion(tree));

    expect(result.current.mailboxTree).toHaveLength(1);
  });
});
