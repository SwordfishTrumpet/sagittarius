import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimatedEmailMoves } from '../useAnimatedEmailMoves';

describe('useAnimatedEmailMoves', () => {
  const mockOnMove = vi.fn();
  const mockOnMoveBulk = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should add email IDs to removing set when moving', () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMove: mockOnMove, onMoveBulk: mockOnMoveBulk })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1', 'email-2'], 'mailbox-1', 'Archive');
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(true);
    expect(result.current.removingEmailIds.has('email-2')).toBe(true);
  });

  it('should call onMove for single email after animation delay', () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMove: mockOnMove, onMoveBulk: mockOnMoveBulk })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    // Should not call onMove immediately
    expect(mockOnMove).not.toHaveBeenCalled();

    // Fast-forward past animation delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnMove).toHaveBeenCalledWith({
      emailId: 'email-1',
      mailboxIds: { 'mailbox-1': true },
    });
    expect(mockOnMoveBulk).not.toHaveBeenCalled();
  });

  it('should call onMoveBulk for multiple emails after animation delay', () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMove: mockOnMove, onMoveBulk: mockOnMoveBulk })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1', 'email-2'], 'mailbox-1', 'Archive');
    });

    // Fast-forward past animation delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnMoveBulk).toHaveBeenCalledWith({
      emailIds: ['email-1', 'email-2'],
      mailboxIds: { 'mailbox-1': true },
    });
    expect(mockOnMove).not.toHaveBeenCalled();
  });

  it('should clear previous removing state when starting new move', () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMove: mockOnMove, onMoveBulk: mockOnMoveBulk })
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
      useAnimatedEmailMoves({ onMove: mockOnMove, onMoveBulk: mockOnMoveBulk })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(true);

    act(() => {
      result.current.cancelPendingMoves();
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(false);

    // Fast-forward and verify onMove was not called
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnMove).not.toHaveBeenCalled();
  });

  it('should only execute most recent operation', () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMove: mockOnMove, onMoveBulk: mockOnMoveBulk })
    );

    // First move
    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    // Second move immediately after
    act(() => {
      result.current.moveEmailsToFolder(['email-2'], 'mailbox-2', 'Trash');
    });

    // Advance past both delays
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Only second move should execute
    expect(mockOnMove).toHaveBeenCalledTimes(1);
    expect(mockOnMove).toHaveBeenCalledWith({
      emailId: 'email-2',
      mailboxIds: { 'mailbox-2': true },
    });
  });

  it('should remove email IDs from removing set after animation completes', () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMove: mockOnMove, onMoveBulk: mockOnMoveBulk })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.removingEmailIds.has('email-1')).toBe(false);
  });

  it('should clear all pending timers on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useAnimatedEmailMoves({ onMove: mockOnMove, onMoveBulk: mockOnMoveBulk })
    );

    act(() => {
      result.current.moveEmailsToFolder(['email-1'], 'mailbox-1', 'Archive');
    });

    unmount();

    // Advance timers and verify no callbacks were called after unmount
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnMove).not.toHaveBeenCalled();
  });

  it('should handle rapid successive moves without memory leaks', () => {
    const { result } = renderHook(() =>
      useAnimatedEmailMoves({ onMove: mockOnMove, onMoveBulk: mockOnMoveBulk })
    );

    // Simulate rapid moves
    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.moveEmailsToFolder([`email-${i}`], `mailbox-${i}`, `Folder ${i}`);
      });
    }

    // Advance past all delays
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Only the last move should execute
    expect(mockOnMove).toHaveBeenCalledTimes(1);
    expect(mockOnMove).toHaveBeenCalledWith({
      emailId: 'email-9',
      mailboxIds: { 'mailbox-9': true },
    });
  });
});
