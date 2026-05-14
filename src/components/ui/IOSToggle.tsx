import React from 'react';

interface IOSToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * iOS-style toggle switch component
 * Matches Apple's design system with smooth animations
 * 
 * @example
 * ```tsx
 * <IOSToggle 
 *   checked={enabled} 
 *   onChange={setEnabled}
 *   label="Enable notifications"
 * />
 * ```
 */
export function IOSToggle({ 
  checked, 
  onChange, 
  label, 
  ariaLabel,
  className = '' 
}: IOSToggleProps) {
  const handleClick = () => {
    onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-icloud-accent ${
        checked ? 'bg-icloud-green' : 'bg-icloud-border'
      } ${className}`}
    >
      <span
        className={`absolute left-0 top-[2px] w-[27px] h-[27px] bg-white dark:bg-icloud-border rounded-full shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}
