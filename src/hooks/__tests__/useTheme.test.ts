import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';
import { THEME_STORAGE_KEY } from '../../utils/theme';

describe('useTheme', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset document class
    document.documentElement.classList.remove('dark');
    // Reset matchMedia mock
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should default to auto mode when no stored preference', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('auto');
  });

  it('should read mode from localStorage on initialization', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('should persist mode to localStorage when changed', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setMode('dark');
    });

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(result.current.mode).toBe('dark');
  });

  it('should apply dark class to document when dark mode is active', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setMode('dark');
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(result.current.isDark).toBe(true);
  });

  it('should remove dark class when light mode is active', () => {
    document.documentElement.classList.add('dark');
    
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setMode('light');
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(result.current.isDark).toBe(false);
  });

  it('should detect system preference in auto mode', () => {
    // Mock prefers-color-scheme: dark - must be set up before renderHook
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result } = renderHook(() => useTheme());
    
    // Mode should be auto, but resolved theme should be dark based on system
    expect(result.current.mode).toBe('auto');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(result.current.isDark).toBe(true);
  });

  it('should toggle between light and dark modes', () => {
    const { result } = renderHook(() => useTheme());
    
    // Start with light mode
    act(() => {
      result.current.setMode('light');
    });
    expect(result.current.resolvedTheme).toBe('light');

    // Toggle to dark
    act(() => {
      result.current.toggle();
    });
    expect(result.current.mode).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');

    // Toggle back to light
    act(() => {
      result.current.toggle();
    });
    expect(result.current.mode).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('should handle corrupted localStorage gracefully', () => {
    // Set invalid value
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid-value');
    
    const { result } = renderHook(() => useTheme());
    
    // Should fall back to default (auto)
    expect(result.current.mode).toBe('auto');
  });

  it('should sync across tabs via storage event', () => {
    const { result } = renderHook(() => useTheme());
    
    // Start with light
    act(() => {
      result.current.setMode('light');
    });
    expect(result.current.mode).toBe('light');

    // Simulate storage event from another tab
    act(() => {
      const event = new StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        newValue: 'dark',
        oldValue: 'light',
        storageArea: localStorage,
      });
      window.dispatchEvent(event);
    });

    // Mode should update
    expect(result.current.mode).toBe('dark');
  });

  it('should handle light system preference in auto mode', () => {
    // Mock prefers-color-scheme: light - must be set up before renderHook
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false, // false for all queries means light mode
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result } = renderHook(() => useTheme());
    
    expect(result.current.mode).toBe('auto');
    expect(result.current.resolvedTheme).toBe('light');
    expect(result.current.isDark).toBe(false);
  });

  it('should provide all expected return values', () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current).toHaveProperty('mode');
    expect(result.current).toHaveProperty('resolvedTheme');
    expect(result.current).toHaveProperty('setMode');
    expect(result.current).toHaveProperty('toggle');
    expect(result.current).toHaveProperty('isDark');
    
    expect(typeof result.current.setMode).toBe('function');
    expect(typeof result.current.toggle).toBe('function');
    expect(typeof result.current.isDark).toBe('boolean');
  });
});
