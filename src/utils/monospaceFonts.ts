/**
 * Monospace font definitions and utilities
 */

export type MonospaceFontId =
  | 'system'
  | 'fira-code'
  | 'jetbrains-mono'
  | 'source-code-pro'
  | 'cascadia-code'
  | 'ubuntu-mono';

export interface MonospaceFont {
  id: MonospaceFontId;
  name: string;
  family: string;
  ligatures: boolean;
  weights: number[];
  googleFontName?: string;
}

export const MONOSPACE_FONTS: MonospaceFont[] = [
  {
    id: 'system',
    name: 'System Default',
    family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    ligatures: false,
    weights: [400, 500, 600],
  },
  {
    id: 'fira-code',
    name: 'Fira Code',
    family: "'Fira Code', monospace",
    ligatures: true,
    weights: [400, 500, 600],
    googleFontName: 'Fira+Code',
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    family: "'JetBrains Mono', monospace",
    ligatures: true,
    weights: [400, 500, 600],
    googleFontName: 'JetBrains+Mono',
  },
  {
    id: 'source-code-pro',
    name: 'Source Code Pro',
    family: "'Source Code Pro', monospace",
    ligatures: false,
    weights: [400, 500, 600],
    googleFontName: 'Source+Code+Pro',
  },
  {
    id: 'cascadia-code',
    name: 'Cascadia Code',
    family: "'Cascadia Code', 'Cascadia Mono', monospace",
    ligatures: true,
    weights: [400, 500, 600],
  },
  {
    id: 'ubuntu-mono',
    name: 'Ubuntu Mono',
    family: "'Ubuntu Mono', monospace",
    ligatures: false,
    weights: [400, 500, 600],
    googleFontName: 'Ubuntu+Mono',
  },
];

export const DEFAULT_MONOSPACE_FONT: MonospaceFontId = 'system';
export const FONT_STORAGE_KEY = 'sagittarius-monospace-font';

export function getFontById(id: MonospaceFontId): MonospaceFont {
  return MONOSPACE_FONTS.find((f) => f.id === id) || MONOSPACE_FONTS[0];
}

export function isValidFontId(id: string): id is MonospaceFontId {
  return MONOSPACE_FONTS.some((f) => f.id === id);
}
