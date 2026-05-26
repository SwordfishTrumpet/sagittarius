import { useState, useEffect, useCallback } from 'react';
import {
  type ThemeFontId,
  DEFAULT_THEME_FONT,
  FONT_STORAGE_KEY,
  getFontById,
  isValidFontId,
} from '../utils/monospaceFonts';

export interface UseFontPreferenceReturn {
  fontId: ThemeFontId;
  setFontId: (id: ThemeFontId) => void;
  font: ReturnType<typeof getFontById>;
}

export function useFontPreference(): UseFontPreferenceReturn {
  const [fontId, setFontIdState] = useState<ThemeFontId>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME_FONT;
    try {
      const stored = localStorage.getItem(FONT_STORAGE_KEY);
      if (stored && isValidFontId(stored)) {
        return stored;
      }
    } catch {
      // Silently fail if localStorage is unavailable
    }
    return DEFAULT_THEME_FONT;
  });

  useEffect(() => {
    const root = document.documentElement;
    const font = getFontById(fontId);

    // Set UI font
    root.style.setProperty('--font-ui', font.family);

    // For monospace elements, use the font if it's monospace, otherwise system default
    if (font.category === 'mono') {
      root.style.setProperty('--font-mono', font.family);
    } else {
      root.style.setProperty(
        '--font-mono',
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      );
    }

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

  const setFontId = useCallback((id: ThemeFontId) => {
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
