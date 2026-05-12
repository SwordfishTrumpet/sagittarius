import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../ThemeToggle';
import * as ThemeProviderModule from '../../../context/ThemeProvider';

// Mock the useThemeContext hook with a default safe return
vi.mock('../../../context/ThemeProvider', () => ({
  useThemeContext: vi.fn(() => ({
    mode: 'auto',
    setMode: vi.fn(),
    resolvedTheme: 'light',
    toggle: vi.fn(),
    isDark: false,
  })),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ThemeToggle', () => {
  const mockSetMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ThemeProviderModule.useThemeContext).mockReturnValue({
      mode: 'auto',
      setMode: mockSetMode,
      resolvedTheme: 'light',
      toggle: vi.fn(),
      isDark: false,
    });
  });

  it('renders all three theme options', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Automatic' })).toBeInTheDocument();
  });

  it('marks the active mode with aria-pressed=true', () => {
    vi.mocked(ThemeProviderModule.useThemeContext).mockReturnValue({
      mode: 'dark',
      setMode: mockSetMode,
      resolvedTheme: 'dark',
      toggle: vi.fn(),
      isDark: true,
    });

    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Automatic' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls setMode when a theme option is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(ThemeProviderModule.useThemeContext).mockReturnValue({
      mode: 'auto',
      setMode: mockSetMode,
      resolvedTheme: 'light',
      toggle: vi.fn(),
      isDark: false,
    });

    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(mockSetMode).toHaveBeenCalledWith('light');

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(mockSetMode).toHaveBeenCalledWith('dark');

    await user.click(screen.getByRole('button', { name: 'Automatic' }));
    expect(mockSetMode).toHaveBeenCalledWith('auto');
  });

  it('displays the correct helper text for each mode', () => {
    const { rerender } = render(<ThemeToggle />);
    expect(screen.getByText('Automatically switches between light and dark based on your system settings.')).toBeInTheDocument();

    vi.mocked(ThemeProviderModule.useThemeContext).mockReturnValue({
      mode: 'light',
      setMode: mockSetMode,
      resolvedTheme: 'light',
      toggle: vi.fn(),
      isDark: false,
    });
    rerender(<ThemeToggle />);
    expect(screen.getByText('Always use light appearance.')).toBeInTheDocument();

    vi.mocked(ThemeProviderModule.useThemeContext).mockReturnValue({
      mode: 'dark',
      setMode: mockSetMode,
      resolvedTheme: 'dark',
      toggle: vi.fn(),
      isDark: true,
    });
    rerender(<ThemeToggle />);
    expect(screen.getByText('Always use dark appearance.')).toBeInTheDocument();
  });

  it('applies selected styling to the active mode button', () => {
    vi.mocked(ThemeProviderModule.useThemeContext).mockReturnValue({
      mode: 'light',
      setMode: mockSetMode,
      resolvedTheme: 'light',
      toggle: vi.fn(),
      isDark: false,
    });

    render(<ThemeToggle />);

    const lightButton = screen.getByRole('button', { name: 'Light' });
    expect(lightButton.className).toContain('bg-white');
    expect(lightButton.className).toContain('text-[#007AFF]');
  });
});
