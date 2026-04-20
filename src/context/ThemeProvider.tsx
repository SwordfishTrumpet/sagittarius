import React, { createContext, useContext, ReactNode } from 'react';
import { useTheme, UseThemeReturn } from '../hooks/useTheme';

// Create context with undefined initial value
const ThemeContext = createContext<UseThemeReturn | undefined>(undefined);

/**
 * Provider component for theme state management.
 * Wraps the app to provide global theme context with system preference detection.
 * 
 * Usage:
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context.
 * Must be used within a ThemeProvider.
 * 
 * @throws Error if used outside of ThemeProvider
 * @returns Theme state and controls
 */
export function useThemeContext(): UseThemeReturn {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeProvider;
