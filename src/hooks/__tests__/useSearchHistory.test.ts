import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearchHistory } from '../useSearchHistory';
import type { SearchFilter } from '../../types/search';

describe('useSearchHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with empty history', () => {
    const { result } = renderHook(() => useSearchHistory());

    expect(result.current.history).toEqual([]);
    expect(result.current.getHistory()).toEqual([]);
    expect(result.current.getRecentSearches()).toEqual([]);
  });

  it('adds a search to history', () => {
    const { result } = renderHook(() => useSearchHistory());
    const filters: SearchFilter = { from: 'test@example.com' };

    act(() => {
      result.current.addToHistory('hello', filters);
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].query).toBe('hello');
    expect(result.current.history[0].filters).toEqual(filters);
  });

  it('persists history to localStorage', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('query', {});
    });

    const stored = localStorage.getItem('sagittarius_search_history');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toHaveLength(1);
  });

  it('restores history from localStorage on mount', () => {
    const existing = [
      { id: '1', query: 'existing', filters: {}, timestamp: Date.now() },
    ];
    localStorage.setItem('sagittarius_search_history', JSON.stringify(existing));

    const { result } = renderHook(() => useSearchHistory());

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].query).toBe('existing');
  });

  it('removes duplicate queries when adding', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('duplicate', {});
    });

    act(() => {
      result.current.addToHistory('duplicate', { from: 'other' });
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].query).toBe('duplicate');
  });

  it('limits history to 15 entries', () => {
    const { result } = renderHook(() => useSearchHistory());

    for (let i = 0; i < 20; i++) {
      act(() => {
        result.current.addToHistory(`query-${i}`, {});
      });
    }

    expect(result.current.history).toHaveLength(15);
    expect(result.current.history[0].query).toBe('query-19');
  });

  it('removes a specific search from history', async () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('a', {});
    });

    act(() => {
      result.current.addToHistory('b', {});
    });

    await waitFor(() => {
      expect(result.current.history.length).toBe(2);
    });

    const idToRemove = result.current.history.find((h) => h.query === 'a')!.id;

    act(() => {
      result.current.removeFromHistory(idToRemove);
    });

    await waitFor(() => {
      expect(result.current.history.length).toBe(1);
    });

    expect(result.current.history[0].query).toBe('b');
  });

  it('clears all history', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('a', {});
    });

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
    expect(localStorage.getItem('sagittarius_search_history')).toBeNull();
  });

  it('returns recent searches limited by count', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('first', {});
    });

    act(() => {
      result.current.addToHistory('second', {});
    });

    act(() => {
      result.current.addToHistory('third', {});
    });

    expect(result.current.getRecentSearches(2)).toHaveLength(2);
    expect(result.current.getRecentSearches(2)[0].query).toBe('third');
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('sagittarius_search_history', 'not-json');

    const { result } = renderHook(() => useSearchHistory());

    expect(result.current.history).toEqual([]);
  });
});
