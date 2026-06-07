import { useState, useEffect, useCallback } from 'react';
import {
  type ThemeFontId,
  DEFAULT_THEME_FONT,
  FONT_STORAGE_KEY,
  getFontById,
  isValidFontId,
} from '../utils/monospaceFonts';

// Self-hosted fonts via @fontsource — no CSP issues, no external requests
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-serif/400.css';
import '@fontsource/ibm-plex-serif/500.css';
import '@fontsource/ibm-plex-serif/600.css';
import '@fontsource/ibm-plex-serif/700.css';

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
      // Stale/removed font key — clean up
      if (stored) localStorage.removeItem(FONT_STORAGE_KEY);
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

    // Self-hosted fonts are loaded via @fontsource imports above.
    // No dynamic Google Fonts injection needed — eliminates CSP style-src issues.
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
