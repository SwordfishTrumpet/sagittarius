/**
 * useSearchHistory Hook
 * Manages search history persistence in localStorage
 */

import { useState, useEffect } from 'react';
import { RecentSearch, SearchFilter } from '../types/search';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'sagittarius_search_history';
const MAX_HISTORY = 15;

export function useSearchHistory() {
  const [history, setHistory] = useState<RecentSearch[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (error) {
        logger.error('Failed to parse search history:', error);
        setHistory([]);
      }
    }
  }, []);

  /**
   * Add a search to history
   */
  const addToHistory = (query: string, filters: SearchFilter) => {
    const newEntry: RecentSearch = {
      id: Date.now().toString(),
      query,
      filters,
      timestamp: Date.now(),
    };

    // Use functional update to avoid stale closure issues with rapid calls
    setHistory(prevHistory => {
      // Avoid duplicates: remove if exact query already exists
      const filtered = prevHistory.filter((h) => h.query !== query);

      // Add new entry to front and limit to MAX_HISTORY
      const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  /**
   * Remove a specific search from history
   */
  const removeFromHistory = (id: string) => {
    setHistory(prevHistory => {
      const updated = prevHistory.filter((h) => h.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  /**
   * Clear all history
   */
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  /**
   * Get all history entries
   */
  const getHistory = () => history;

  /**
   * Get the most recent N entries
   */
  const getRecentSearches = (count: number = 5) => history.slice(0, count);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getHistory,
    getRecentSearches,
  };
}
