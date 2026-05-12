import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFontPreference } from '../useFontPreference';
import { FONT_STORAGE_KEY, DEFAULT_MONOSPACE_FONT } from '../../utils/monospaceFonts';

describe('useFontPreference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--font-mono');
    // Remove any injected font links
    document.querySelectorAll('link[id^="google-font-"]').forEach((el) => el.remove());
  });

  it('defaults to system font when no stored preference', () => {
    const { result } = renderHook(() => useFontPreference());
    expect(result.current.fontId).toBe('system');
    expect(result.current.font.name).toBe('System Default');
  });

  it('reads font from localStorage on initialization', () => {
    localStorage.setItem(FONT_STORAGE_KEY, 'fira-code');
    const { result } = renderHook(() => useFontPreference());
    expect(result.current.fontId).toBe('fira-code');
    expect(result.current.font.family).toContain('Fira Code');
  });

  it('persists font to localStorage when changed', () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontId('jetbrains-mono');
    });

    expect(localStorage.getItem(FONT_STORAGE_KEY)).toBe('jetbrains-mono');
    expect(result.current.fontId).toBe('jetbrains-mono');
  });

  it('sets --font-mono CSS custom property', () => {
    renderHook(() => useFontPreference());
    const rootStyle = getComputedStyle(document.documentElement);
    expect(rootStyle.getPropertyValue('--font-mono')).toBeTruthy();
  });

  it('injects Google Fonts link for non-system fonts', () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontId('fira-code');
    });

    const link = document.getElementById('google-font-fira-code') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link?.href).toContain('fonts.googleapis.com');
    expect(link?.href).toContain('Fira+Code');
  });

  it('does not inject Google Fonts link for system font', () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontId('system');
    });

    const link = document.getElementById('google-font-system');
    expect(link).toBeNull();
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(FONT_STORAGE_KEY, 'invalid-font');
    const { result } = renderHook(() => useFontPreference());
    expect(result.current.fontId).toBe(DEFAULT_MONOSPACE_FONT);
  });

  it('updates font metadata when font changes', () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontId('ubuntu-mono');
    });

    expect(result.current.font.ligatures).toBe(false);
    expect(result.current.font.googleFontName).toBe('Ubuntu+Mono');
  });
});
