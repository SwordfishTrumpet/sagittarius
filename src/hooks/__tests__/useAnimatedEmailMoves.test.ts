import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimatedEmailMoves } from '../useAnimatedEmailMoves';

describe('useAnimatedEmailMoves', () => {
  const mockOnMoveAsync = vi.fn().mockResolvedValue(undefined);
  const mockOnMoveBulkAsync = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should add email IDs to removing set when moving', () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMoveAsync: mockOnMoveAsync, onMoveBulkAsync: mockOnMoveBulkAsync })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1', 'email-2'], 'mailbox-1', 'Archive');
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(true);
    expect(result.current.removingEmailIds.has('email-2')).toBe(true);
  });

  it('should call onMoveAsync for single email after animation delay', async () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMoveAsync: mockOnMoveAsync, onMoveBulkAsync: mockOnMoveBulkAsync })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    // Should not call onMoveAsync immediately
    expect(mockOnMoveAsync).not.toHaveBeenCalled();

    // Fast-forward past animation delay and flush microtasks for the async callback
    await act(async () => {
      vi.advanceTimersByTime(300);
      // Flush any pending microtasks from the async callback
      await vi.runAllTicks();
    });

    expect(mockOnMoveAsync).toHaveBeenCalledWith({
      emailId: 'email-1',
      mailboxIds: { 'mailbox-1': true },
    });
    expect(mockOnMoveBulkAsync).not.toHaveBeenCalled();
  });

  it('should call onMoveBulkAsync for multiple emails after animation delay', async () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMoveAsync: mockOnMoveAsync, onMoveBulkAsync: mockOnMoveBulkAsync })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1', 'email-2'], 'mailbox-1', 'Archive');
    });

    // Fast-forward past animation delay and flush microtasks
    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTicks();
    });

    expect(mockOnMoveBulkAsync).toHaveBeenCalledWith({
      emailIds: ['email-1', 'email-2'],
      mailboxIds: { 'mailbox-1': true },
    });
    expect(mockOnMoveAsync).not.toHaveBeenCalled();
  });

  it('should clear previous removing state when starting new move', () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMoveAsync: mockOnMoveAsync, onMoveBulkAsync: mockOnMoveBulkAsync })
    );

    // First move
    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(true);

    // Second move before first completes
    act(() => {
      result.current.moveEmailsToFolder(['email-2'], 'mailbox-2', 'Trash');
    });

    // First email should no longer be in removing set
    expect(result.current.removingEmailIds.has('email-1')).toBe(false);
    expect(result.current.removingEmailIds.has('email-2')).toBe(true);
  });

  it('should cancel pending moves when cancelPendingMoves is called', () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMoveAsync: mockOnMoveAsync, onMoveBulkAsync: mockOnMoveBulkAsync })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(true);

    act(() => {
      result.current.cancelPendingMoves();
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(false);

    // Fast-forward and verify onMoveAsync was not called
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnMoveAsync).not.toHaveBeenCalled();
  });

  it('should only execute most recent operation', async () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMoveAsync: mockOnMoveAsync, onMoveBulkAsync: mockOnMoveBulkAsync })
    );

    // First move
    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    // Second move immediately after
    act(() => {
      result.current.moveEmailsToFolder(['email-2'], 'mailbox-2', 'Trash');
    });

    // Advance past both delays and flush microtasks
    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runAllTicks();
    });

    // Only second move should execute
    expect(mockOnMoveAsync).toHaveBeenCalledTimes(1);
    expect(mockOnMoveAsync).toHaveBeenCalledWith({
      emailId: 'email-2',
      mailboxIds: { 'mailbox-2': true },
    });
  });

  it('should remove email IDs from removing set after mutation resolves', async () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMoveAsync: mockOnMoveAsync, onMoveBulkAsync: mockOnMoveBulkAsync })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(true);

    // Advance timer and flush microtasks — the mutation resolves, clearing removingEmailIds
    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTicks();
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(false);
  });

  it('should clear all pending timers on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useAnimatedEmailMoves({ onMoveAsync: mockOnMoveAsync, onMoveBulkAsync: mockOnMoveBulkAsync })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    unmount();

    // Advance timers and verify no callbacks were called after unmount
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnMoveAsync).not.toHaveBeenCalled();
  });

  it('should handle rapid successive moves without memory leaks', async () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMoveAsync: mockOnMoveAsync, onMoveBulkAsync: mockOnMoveBulkAsync })
    );

    // Simulate rapid moves
    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.moveEmailsToFolder([`email-${i}`], `mailbox-${i}`, `Folder ${i}`);
      });
    }

    // Advance past all delays and flush microtasks
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await vi.runAllTicks();
    });

    // Only the last move should execute
    expect(mockOnMoveAsync).toHaveBeenCalledTimes(1);
    expect(mockOnMoveAsync).toHaveBeenCalledWith({
      emailId: 'email-9',
      mailboxIds: { 'mailbox-9': true },
    });
  });
});
