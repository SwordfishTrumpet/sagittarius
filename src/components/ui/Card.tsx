import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'small' | 'medium' | 'large';
  dividers?: boolean;
}

/**
 * Card — A reusable card component with the standard iCloud-style styling.
 * Used across settings components for consistent visual appearance.
 */
export function Card({
  children,
  className = '',
  padding = 'none',
  dividers = false,
}: CardProps) {
  const paddingClasses = {
    none: '',
    small: 'p-3',
    medium: 'p-4',
    large: 'p-6',
  };

  const dividerClass = dividers ? 'divide-y divide-icloud-border' : '';

  return (
    <div
      className={`bg-icloud-bg-layer2 rounded-2xl border border-icloud-border overflow-hidden ${dividerClass} ${paddingClasses[padding]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export interface FormSectionProps {
  children: ReactNode;
  className?: string;
}

/**
 * FormSection — A container for form fields with standard background and border styling.
 */
export function FormSection({ children, className = '' }: FormSectionProps) {
  return (
    <div className={`bg-icloud-bg-layer1 bg-icloud-bg-primary/50 rounded-2xl border border-icloud-border overflow-hidden ${className}`.trim()}>
      {children}
    </div>
  );
}

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * FormField — A standardized form field with label styling.
 */
export function FormField({ label, children, className = '' }: FormFieldProps) {
  return (
    <div className={`bg-icloud-bg-layer2 border-b border-icloud-border last:border-b-0 ${className}`.trim()}>
      <label className="block px-4 pt-3 text-[11px] font-semibold text-icloud-text-secondary  uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

export interface SkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton — A loading skeleton with consistent styling.
 */
export function Skeleton({ count = 1, className = '' }: SkeletonProps) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`.trim()}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 bg-icloud-border bg-icloud-card rounded-2xl" />
      ))}
    </div>
  );
}
