import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFontPreference } from '../useFontPreference';
import { FONT_STORAGE_KEY, DEFAULT_THEME_FONT } from '../../utils/monospaceFonts';

describe('useFontPreference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--font-ui');
    document.documentElement.style.removeProperty('--font-mono');
    document.querySelectorAll('link[id^="google-font-"]').forEach((el) => el.remove());
  });

  it('defaults to icloud-default font when no stored preference', () => {
    const { result } = renderHook(() => useFontPreference());
    expect(result.current.fontId).toBe('icloud-default');
    expect(result.current.font.name).toBe('iCloud Default');
  });

  it('reads font from localStorage on initialization', () => {
    localStorage.setItem(FONT_STORAGE_KEY, 'jetbrains-mono');
    const { result } = renderHook(() => useFontPreference());
    expect(result.current.fontId).toBe('jetbrains-mono');
    expect(result.current.font.family).toContain('JetBrains Mono');
  });

  it('persists font to localStorage when changed', () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontId('inter');
    });

    expect(localStorage.getItem(FONT_STORAGE_KEY)).toBe('inter');
    expect(result.current.fontId).toBe('inter');
  });

  it('sets --font-ui CSS custom property', () => {
    renderHook(() => useFontPreference());
    const rootStyle = getComputedStyle(document.documentElement);
    expect(rootStyle.getPropertyValue('--font-ui')).toBeTruthy();
  });

  it('sets --font-mono to system default for non-mono fonts', () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontId('inter');
    });

    const rootStyle = getComputedStyle(document.documentElement);
    expect(rootStyle.getPropertyValue('--font-mono')).toContain('monospace');
  });

  it('sets --font-mono to font family for mono fonts', () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontId('jetbrains-mono');
    });

    const rootStyle = getComputedStyle(document.documentElement);
    expect(rootStyle.getPropertyValue('--font-mono')).toContain('JetBrains Mono');
  });

  it('injects Google Fonts link for remote fonts', () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontId('inter');
    });

    const link = document.getElementById('google-font-inter') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link?.href).toContain('fonts.googleapis.com');
    expect(link?.href).toContain('Inter');
  });

  it('does not inject Google Fonts link for system font', () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontId('icloud-default');
    });

    const link = document.getElementById('google-font-icloud-default');
    expect(link).toBeNull();
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(FONT_STORAGE_KEY, 'invalid-font');
    const { result } = renderHook(() => useFontPreference());
    expect(result.current.fontId).toBe(DEFAULT_THEME_FONT);
  });
});
