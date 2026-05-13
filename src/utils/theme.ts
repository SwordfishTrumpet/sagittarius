// Theme mode types
export type ThemeMode = 'light' | 'dark' | 'auto';

// iCloud Mail Design System Colors — exact values from https://www.icloud.com
// Extracted from iCloud Mail v2616 CSS custom properties.
// All colors match Apple's design system precisely.

export const LIGHT_COLORS = {
  // Background
  backgroundPrimary: '#ffffff',
  backgroundSidebar: '#fbfbfd',
  backgroundLayer1: '#f2f2f7',
  backgroundLayer2: '#ffffff',
  card: '#ffffff',

  // Text (Apple label hierarchy — rgba on white)
  textPrimary: 'rgba(0, 0, 0, 0.88)',
  textSecondary: 'rgba(0, 0, 0, 0.56)',
  textTertiary: 'rgba(0, 0, 0, 0.48)',

  // Accent — Mail app blue (body sets h=210 s=100% l=44.5%)
  accent: '#0071e3',
  accentHover: '#0056cc',

  // Borders & dividers
  border: '#d1d1d6',
  divider: '#d1d1d6',

  // Semantic (iOS system colors)
  red: '#e30000',
  orange: '#ff9500',
  yellow: '#ffcc00',
  green: '#03a10e',

  // Grayscale
  gray1: 'hsl(240, 2.3%, 56.7%)',
  gray2: '#aeaeb2',
  gray3: 'hsl(240, 4.7%, 79.0%)',
  gray4: 'hsl(240, 5.7%, 82.9%)',
  gray5: 'hsl(240, 10.6%, 90.8%)',
  gray6: '#f2f2f7',

  // Shadow
  shadowColor: 'rgba(0, 0, 0, 0.16)',
  shadowStandard: '0 11px 34px rgba(0, 0, 0, 0.16)',

  // Scrollbar
  scrollbarThumb: '#c1c1c1',
  scrollbarThumbHover: '#a8a8a8',

  // Selection
  selectionBg: '#0071e3',
  selectionText: '#ffffff',

  // Semantic (legacy aliases kept for backward compat)
  success: '#03a10e',
  warning: '#ff9500',
  error: '#e30000',
  star: '#ff9500',
  appleBlue: '#0071e3',
  appleBlueHover: '#0056cc',
} as const;

export const DARK_COLORS = {
  // Background
  backgroundPrimary: '#1c1c1e',
  backgroundSidebar: '#202023',
  backgroundLayer1: '#323236',
  backgroundLayer2: '#434349',
  card: '#2c2c2e',

  // Text (Apple label hierarchy — rgba on black)
  textPrimary: 'rgba(255, 255, 255, 0.98)',
  textSecondary: 'rgba(255, 255, 255, 0.66)',
  textTertiary: 'rgba(255, 255, 255, 0.50)',

  // Accent — Mail app blue (body sets h=204 s=100% l=50%)
  accent: '#009aff',
  accentHover: '#007ae3',

  // Borders & dividers
  border: '#343436',
  divider: '#343436',

  // Semantic (iOS system colors)
  red: '#ff2d55',
  orange: '#ff9f0a',
  yellow: '#ffd60a',
  green: '#32d158',

  // Grayscale
  gray1: 'hsl(240, 2.3%, 56.7%)',
  gray2: '#636366',
  gray3: 'hsl(240, 1.4%, 29.0%)',
  gray4: 'hsl(240, 1.6%, 23.9%)',
  gray5: 'hsl(240, 1.9%, 20.8%)',
  gray6: '#2c2c2e',

  // Shadow
  shadowColor: 'rgba(0, 0, 0, 0.65)',
  shadowStandard: '0 11px 34px rgba(0, 0, 0, 0.65)',

  // Scrollbar
  scrollbarThumb: '#48484a',
  scrollbarThumbHover: '#636366',

  // Selection
  selectionBg: '#009aff',
  selectionText: '#ffffff',

  // Semantic (legacy aliases kept for backward compat)
  success: '#32d158',
  warning: '#ff9f0a',
  error: '#ff2d55',
  star: '#ff9f0a',
  appleBlue: '#009aff',
  appleBlueHover: '#007ae3',
} as const;

export const COLORS = LIGHT_COLORS;

export const TAILWIND_COLORS = {
  'icloud-accent': LIGHT_COLORS.accent,
  'icloud-accent-hover': LIGHT_COLORS.accentHover,
  'icloud-red': LIGHT_COLORS.red,
  'icloud-orange': LIGHT_COLORS.orange,
  'icloud-green': LIGHT_COLORS.green,
} as const;

export const THEME_STORAGE_KEY = 'sagittarius-theme';
export const DEFAULT_THEME_MODE: ThemeMode = 'auto';
