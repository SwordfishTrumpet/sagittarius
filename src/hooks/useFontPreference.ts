/**
 * useFontPreference Hook
 * Manages monospace font selection with localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';
import {
  type MonospaceFontId,
  DEFAULT_MONOSPACE_FONT,
  FONT_STORAGE_KEY,
  getFontById,
  isValidFontId,
} from '../utils/monospaceFonts';

export interface UseFontPreferenceReturn {
  /** Currently selected font ID */
  fontId: MonospaceFontId;
  /** Set the active font ID */
  setFontId: (id: MonospaceFontId) => void;
  /** Full font metadata for the active font */
  font: ReturnType<typeof getFontById>;
}

/**
 * Hook for managing monospace font preference.
 *
 * Features:
 * - Persist font selection to localStorage
 * - Apply CSS custom property `--font-mono` to :root
 * - Dynamically inject Google Fonts link tags for non-system fonts
 */
export function useFontPreference(): UseFontPreferenceReturn {
  const [fontId, setFontIdState] = useState<MonospaceFontId>(() => {
    if (typeof window === 'undefined') return DEFAULT_MONOSPACE_FONT;
    try {
      const stored = localStorage.getItem(FONT_STORAGE_KEY);
      if (stored && isValidFontId(stored)) {
        return stored;
      }
    } catch {
      // Silently fail if localStorage is unavailable
    }
    return DEFAULT_MONOSPACE_FONT;
  });

  // Apply CSS variable and load external font resources
  useEffect(() => {
    const root = document.documentElement;
    const font = getFontById(fontId);

    // Set CSS custom property for app-wide usage
    root.style.setProperty('--font-mono', font.family);

    // Inject Google Fonts stylesheet for non-system fonts
    if (font.googleFontName) {
      const linkId = `google-font-${font.id}`;
      let link = document.getElementById(linkId) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${font.googleFontName}:wght@${font.weights.join(';')}&display=swap`;
        document.head.appendChild(link);
      }
    }
  }, [fontId]);

  const setFontId = useCallback((id: MonospaceFontId) => {
    setFontIdState(id);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, id);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, []);

  const font = getFontById(fontId);

  return {
    fontId,
    setFontId,
    font,
  };
}
