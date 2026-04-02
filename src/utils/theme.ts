// Apple iCloud Mail Design System Colors
// Extracted to maintain consistency across the application

export const COLORS = {
  // Primary Brand Colors
  appleBlue: '#007AFF',
  appleBlueHover: '#0062CC',
  appleBlueLight: 'rgba(0, 122, 255, 0.08)',
  appleBlueBorder: 'rgba(0, 122, 255, 0.15)',

  // Neutral Grays (iOS style)
  gray50: '#F2F2F7',      // Sidebar background, light backgrounds
  gray100: '#E5E5EA',     // Borders, dividers
  gray200: '#D1D1D6',     // Hover states for gray elements
  gray400: '#8E8E93',     // Secondary text, icons
  gray600: '#6C6C70',    // Tertiary text
  gray900: '#1C1C1E',     // Primary text

  // Semantic Colors
  success: '#34C759',     // Green - success states
  warning: '#FF9500',     // Orange - warnings, offline indicators
  error: '#FF3B30',       // Red - errors, destructive actions
  star: '#FF9500',        // Flagged/starred items

  // UI Specific
  white: '#FFFFFF',
  black: '#000000',
  backdrop: 'rgba(0, 0, 0, 0.30)',
  glassmorphic: 'rgba(255, 255, 255, 0.30)',
} as const;

// Tailwind-compatible color map for dynamic classes
export const TAILWIND_COLORS = {
  // Primary
  'apple-blue': COLORS.appleBlue,
  'apple-blue-hover': COLORS.appleBlueHover,

  // Grays
  'gray-50': COLORS.gray50,
  'gray-100': COLORS.gray100,
  'gray-200': COLORS.gray200,
  'gray-400': COLORS.gray400,
  'gray-600': COLORS.gray600,
  'gray-900': COLORS.gray900,

  // Semantic
  success: COLORS.success,
  warning: COLORS.warning,
  error: COLORS.error,
  star: COLORS.star,
} as const;
