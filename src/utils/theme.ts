// Theme mode types
export type ThemeMode = 'light' | 'dark' | 'auto';

// Apple iCloud Mail Design System Colors - Light Mode
export const LIGHT_COLORS = {
  // Primary Brand Colors
  appleBlue: '#007AFF',
  appleBlueHover: '#0062CC',
  appleBlueLight: 'rgba(0, 122, 255, 0.08)',
  appleBlueBorder: 'rgba(0, 122, 255, 0.15)',

  // Background Colors
  background: '#F2F2F7',           // Main app background
  backgroundElevated: '#FFFFFF',   // Cards, dialogs, elevated surfaces
  backgroundSecondary: '#F2F2F7',  // Secondary surfaces (sidebar)

  // Neutral Grays (iOS style)
  gray50: '#F2F2F7',      // Sidebar background, light backgrounds
  gray100: '#E5E5EA',     // Borders, dividers
  gray200: '#D1D1D6',     // Hover states for gray elements
  gray400: '#8E8E93',     // Secondary text, icons
  gray600: '#6C6C70',    // Tertiary text
  gray900: '#1C1C1E',     // Primary text

  // Text Colors
  textPrimary: '#1C1C1E',
  textSecondary: '#6C6C70',
  textTertiary: '#8E8E93',

  // Semantic Colors
  success: '#34C759',     // Green - success states
  warning: '#FF9500',     // Orange - warnings, offline indicators
  error: '#FF3B30',       // Red - errors, destructive actions
  star: '#FF9500',        // Flagged/starred items

  // UI Specific
  white: '#FFFFFF',
  black: '#000000',
  border: '#E5E5EA',
  divider: '#E5E5EA',
  backdrop: 'rgba(0, 0, 0, 0.30)',
  glassmorphic: 'rgba(255, 255, 255, 0.70)',
  glassmorphicHover: 'rgba(255, 255, 255, 0.85)',

  // Selection
  selectionBg: '#007AFF',
  selectionText: '#FFFFFF',

  // Scrollbar
  scrollbarThumb: '#C1C1C1',
  scrollbarThumbHover: '#A8A8A8',
} as const;

// Apple iCloud Mail Design System Colors - Dark Mode (iOS/macOS style)
export const DARK_COLORS = {
  // Primary Brand Colors
  appleBlue: '#0A84FF',        // Slightly lighter blue for dark mode
  appleBlueHover: '#0070E0',
  appleBlueLight: 'rgba(10, 132, 255, 0.15)',
  appleBlueBorder: 'rgba(10, 132, 255, 0.20)',

  // Background Colors
  background: '#000000',           // Pure black (OLED optimized)
  backgroundElevated: '#1C1C1E',   // Cards, dialogs, elevated surfaces
  backgroundSecondary: '#1C1C1E',  // Secondary surfaces

  // Neutral Grays (iOS Dark Mode style)
  gray50: '#1C1C1E',      // Secondary background
  gray100: '#2C2C2E',     // Elevated surfaces
  gray200: '#3A3A3C',     // Borders, dividers
  gray400: '#8E8E93',     // Secondary text, icons (same as light)
  gray600: '#636366',     // Tertiary text
  gray900: '#FFFFFF',     // Primary text (white)

  // Text Colors
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',

  // Semantic Colors
  success: '#30D158',     // Green adjusted for dark mode
  warning: '#FF9F0A',     // Orange adjusted for dark mode
  error: '#FF453A',       // Red adjusted for dark mode
  star: '#FF9F0A',        // Flagged/starred items

  // UI Specific
  white: '#FFFFFF',
  black: '#000000',
  border: '#38383A',
  divider: '#38383A',
  backdrop: 'rgba(0, 0, 0, 0.60)',
  glassmorphic: 'rgba(28, 28, 30, 0.80)',
  glassmorphicHover: 'rgba(44, 44, 46, 0.90)',

  // Selection
  selectionBg: '#0A84FF',
  selectionText: '#FFFFFF',

  // Scrollbar
  scrollbarThumb: '#48484A',
  scrollbarThumbHover: '#636366',
} as const;

// Legacy COLORS export for backward compatibility (light mode)
export const COLORS = LIGHT_COLORS;

// Tailwind-compatible color map for dynamic classes
export const TAILWIND_COLORS = {
  // Primary
  'apple-blue': LIGHT_COLORS.appleBlue,
  'apple-blue-hover': LIGHT_COLORS.appleBlueHover,

  // Grays
  'gray-50': LIGHT_COLORS.gray50,
  'gray-100': LIGHT_COLORS.gray100,
  'gray-200': LIGHT_COLORS.gray200,
  'gray-400': LIGHT_COLORS.gray400,
  'gray-600': LIGHT_COLORS.gray600,
  'gray-900': LIGHT_COLORS.gray900,

  // Semantic
  success: LIGHT_COLORS.success,
  warning: LIGHT_COLORS.warning,
  error: LIGHT_COLORS.error,
  star: LIGHT_COLORS.star,
} as const;

// Storage key for persisting theme preference
export const THEME_STORAGE_KEY = 'sagittarius-theme';

// Default theme mode
export const DEFAULT_THEME_MODE: ThemeMode = 'auto';
