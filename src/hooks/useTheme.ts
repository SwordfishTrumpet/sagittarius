import { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeMode, THEME_STORAGE_KEY, DEFAULT_THEME_MODE } from '../utils/theme';
import { logger } from '../utils/logger';

export interface UseThemeReturn {
  /** Current theme mode setting (light/dark/auto) */
  mode: ThemeMode;
  /** The actual resolved theme (light or dark) that should be applied */
  resolvedTheme: 'light' | 'dark';
  /** Set the theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark (ignores auto) */
  toggle: () => void;
  /** True if currently in dark mode */
  isDark: boolean;
}

/**
 * Hook for managing theme state with localStorage persistence and system preference detection.
 * 
 * Features:
 * - Persist theme preference to localStorage
 * - Detect system preference with matchMedia when mode='auto'
 * - Apply/remove 'dark' class on document.documentElement
 * - Sync across tabs via storage event
 * 
 * @returns Theme state and controls
 */
export function useTheme(): UseThemeReturn {
  // Initialize mode from localStorage or default
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME_MODE;
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        return stored;
      }
    } catch (e) {
      logger.warn('[useTheme] Failed to read theme from localStorage', e);
    }
    return DEFAULT_THEME_MODE;
  });

  // Track system preference for auto mode - initialize synchronously
  const systemPrefersDarkRef = useRef<boolean>(
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  // Initialize system preference detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemPrefersDarkRef.current = mediaQuery.matches;

    const handleChange = (e: MediaQueryListEvent) => {
      systemPrefersDarkRef.current = e.matches;
      // Trigger re-render if in auto mode
      if (mode === 'auto') {
        updateDocumentClass('auto');
      }
    };

    // Use addEventListener if available (modern API), fallback to addListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Legacy API for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [mode]);

  // Calculate resolved theme based on mode and system preference
  const resolvedTheme: 'light' | 'dark' = (() => {
    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    // auto mode
    return systemPrefersDarkRef.current ? 'dark' : 'light';
  })();

  // Apply theme class to document
  const updateDocumentClass = useCallback((newMode: ThemeMode) => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const shouldBeDark = newMode === 'dark' || (newMode === 'auto' && systemPrefersDarkRef.current);

    if (shouldBeDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    logger.debug('[useTheme] Theme updated:', { mode: newMode, resolved: shouldBeDark ? 'dark' : 'light' });
  }, []);

  // Update document class whenever mode or system preference changes
  useEffect(() => {
    updateDocumentClass(mode);
  }, [mode, updateDocumentClass]);

  // Listen for storage changes (sync across tabs)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const newMode = e.newValue as ThemeMode;
        if (newMode === 'light' || newMode === 'dark' || newMode === 'auto') {
          setModeState(newMode);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Set mode with persistence
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      logger.warn('[useTheme] Failed to save theme to localStorage', e);
    }
  }, []);

  // Toggle between light and dark (cycles: light -> dark -> light, ignores auto)
  const toggle = useCallback(() => {
    const newMode = resolvedTheme === 'light' ? 'dark' : 'light';
    setMode(newMode);
  }, [resolvedTheme, setMode]);

  return {
    mode,
    resolvedTheme,
    setMode,
    toggle,
    isDark: resolvedTheme === 'dark',
  };
}

export default useTheme;
