export type ThemeFontId =
  | 'icloud-default'
  | 'jetbrains-mono'
  | 'inter'
  | 'ibm-plex-sans'
  | 'ibm-plex-serif';

export type FontCategory = 'sans' | 'serif' | 'mono';

export interface ThemeFont {
  id: ThemeFontId;
  name: string;
  family: string;
  category: FontCategory;
  weights: number[];
}

export const THEME_FONTS: ThemeFont[] = [
  {
    id: 'icloud-default',
    name: 'iCloud Default',
    family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif',
    category: 'sans',
    weights: [400, 500, 600, 700],
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    family: "'JetBrains Mono', monospace",
    category: 'mono',
    weights: [400, 500, 600],
  },
  {
    id: 'inter',
    name: 'Inter',
    family: "'Inter', sans-serif",
    category: 'sans',
    weights: [400, 500, 600, 700],
  },
  {
    id: 'ibm-plex-sans',
    name: 'IBM Plex Sans',
    family: "'IBM Plex Sans', sans-serif",
    category: 'sans',
    weights: [400, 500, 600, 700],
  },
  {
    id: 'ibm-plex-serif',
    name: 'IBM Plex Serif',
    family: "'IBM Plex Serif', serif",
    category: 'serif',
    weights: [400, 500, 600, 700],
  },
];

export const DEFAULT_THEME_FONT: ThemeFontId = 'icloud-default';
export const FONT_STORAGE_KEY = 'sagittarius-interface-font';

export function getFontById(id: ThemeFontId): ThemeFont {
  return THEME_FONTS.find((f) => f.id === id) || THEME_FONTS[0];
}

export function isValidFontId(id: string): id is ThemeFontId {
  return THEME_FONTS.some((f) => f.id === id);
}
