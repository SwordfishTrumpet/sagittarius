import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useThemeContext } from '../../context/ThemeProvider';
import { IOSToggle } from '../../components/ui/IOSToggle';

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
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

  it('provides default auto mode and light resolved theme', () => {
    function Consumer() {
      const { mode, resolvedTheme } = useThemeContext();
      return (
        <div>
          <span data-testid="mode">{mode}</span>
          <span data-testid="resolved">{resolvedTheme}</span>
        </div>
      );
    }

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('auto');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
  });

  it('provides setMode that updates theme', () => {
    function Consumer() {
      const { mode, setMode } = useThemeContext();
      return (
        <div>
          <span data-testid="mode">{mode}</span>
          <button onClick={() => setMode('dark')}>Set Dark</button>
        </div>
      );
    }

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set Dark' }));
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(localStorage.getItem('sagittarius-theme')).toBe('dark');
  });

  it('provides toggle function', () => {
    function Consumer() {
      const { mode, toggle, resolvedTheme } = useThemeContext();
      return (
        <div>
          <span data-testid="mode">{mode}</span>
          <span data-testid="resolved">{resolvedTheme}</span>
          <button onClick={toggle}>Toggle</button>
        </div>
      );
    }

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    // Start in auto (resolved light), toggle should go to dark
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
  });

  it('provides isDark boolean', () => {
    function Consumer() {
      const { isDark } = useThemeContext();
      return <span data-testid="isDark">{isDark ? 'yes' : 'no'}</span>;
    }

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('isDark')).toHaveTextContent('no');
  });

  it('throws when useThemeContext is used outside ThemeProvider', () => {
    function OrphanConsumer() {
      const ctx = useThemeContext();
      return <span>{ctx.mode}</span>;
    }

    // Suppress console.error for this expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<OrphanConsumer />)).toThrow('useThemeContext must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });

  it('syncs theme across multiple consumers', () => {
    function ConsumerA() {
      const { mode } = useThemeContext();
      return <span data-testid="a">{mode}</span>;
    }
    function ConsumerB() {
      const { setMode } = useThemeContext();
      return <button onClick={() => setMode('dark')}>Set Dark</button>;
    }

    render(
      <ThemeProvider>
        <ConsumerA />
        <ConsumerB />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set Dark' }));
    expect(screen.getByTestId('a')).toHaveTextContent('dark');
  });
});
