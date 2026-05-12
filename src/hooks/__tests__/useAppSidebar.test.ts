import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppSidebar } from '../useAppSidebar';

describe('useAppSidebar', () => {
  it('initializes with default expanded state', () => {
    const { result } = renderHook(() => useAppSidebar());

    expect(result.current.isSidebarCollapsed).toBe(false);
    expect(result.current.expandedSections).toEqual({ mailboxes: true, folders: true });
  });

  it('initializes with collapsed state when defaultCollapsed is true', () => {
    const { result } = renderHook(() => useAppSidebar({ defaultCollapsed: true }));

    expect(result.current.isSidebarCollapsed).toBe(true);
  });

  it('toggles sidebar collapsed state', () => {
    const { result } = renderHook(() => useAppSidebar());

    act(() => {
      result.current.toggleSidebarCollapsed();
    });

    expect(result.current.isSidebarCollapsed).toBe(true);

    act(() => {
      result.current.toggleSidebarCollapsed();
    });

    expect(result.current.isSidebarCollapsed).toBe(false);
  });

  it('expands sidebar', () => {
    const { result } = renderHook(() => useAppSidebar({ defaultCollapsed: true }));

    act(() => {
      result.current.expandSidebar();
    });

    expect(result.current.isSidebarCollapsed).toBe(false);
  });

  it('collapses sidebar', () => {
    const { result } = renderHook(() => useAppSidebar());

    act(() => {
      result.current.collapseSidebar();
    });

    expect(result.current.isSidebarCollapsed).toBe(true);
  });

  it('toggles section expanded state', () => {
    const { result } = renderHook(() => useAppSidebar());

    act(() => {
      result.current.toggleSectionExpanded('mailboxes');
    });

    expect(result.current.expandedSections.mailboxes).toBe(false);
    expect(result.current.expandedSections.folders).toBe(true);

    act(() => {
      result.current.toggleSectionExpanded('folders');
    });

    expect(result.current.expandedSections.folders).toBe(false);
  });

  it('sets section expanded state explicitly', () => {
    const { result } = renderHook(() => useAppSidebar());

    act(() => {
      result.current.setSectionExpanded('mailboxes', false);
    });

    expect(result.current.expandedSections.mailboxes).toBe(false);

    act(() => {
      result.current.setSectionExpanded('mailboxes', true);
    });

    expect(result.current.expandedSections.mailboxes).toBe(true);
  });

  it('maintains referential stability of returned functions', () => {
    const { result, rerender } = renderHook(() => useAppSidebar());

    const firstToggle = result.current.toggleSidebarCollapsed;
    rerender();
    expect(result.current.toggleSidebarCollapsed).toBe(firstToggle);
  });
});
