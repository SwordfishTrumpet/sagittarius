import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { ThemeMode } from '../../utils/theme';
import { useThemeContext } from '../../context/ThemeProvider';

const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'dark', label: 'Dark', Icon: Moon },
  { mode: 'auto', label: 'Automatic', Icon: Monitor },
];

/**
 * Theme toggle component with three options: Light, Dark, Automatic.
 * 
 * - Light: Always use light theme
 * - Dark: Always use dark theme
 * - Automatic: Follow system preference
 * 
 * Visual: iOS-style segmented control appearance
 */
export function ThemeToggle() {
  const { mode, setMode } = useThemeContext();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 p-1 bg-icloud-bg-layer1 rounded-xl">
        {THEME_OPTIONS.map(({ mode: optionMode, label, Icon }) => (
          <button
            key={optionMode}
            onClick={() => setMode(optionMode)}
            className={`
              flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg
              text-[13px] font-medium transition-all duration-200
              ${mode === optionMode
                ? 'bg-icloud-bg-layer2 text-icloud-accent shadow-sm'
                : ' text-icloud-text-secondary hover:text-icloud-text-primary dark:hover:text-white'
              }
            `}
            aria-pressed={mode === optionMode}
          >
            <Icon className="w-4 h-4" strokeWidth={1.5} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <p className="text-[12px] text-icloud-text-secondary px-1">
        {mode === 'auto' 
          ? 'Automatically switches between light and dark based on your system settings.'
          : mode === 'light'
            ? 'Always use light appearance.'
            : 'Always use dark appearance.'
        }
      </p>
    </div>
  );
}

export default ThemeToggle;
