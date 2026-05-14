/**
 * AccountSwitcher Component
 * 
 * A dropdown UI for switching between JMAP accounts.
 * Displays account name, email, and read-only status.
 * 
 * Design follows iCloud style with:
 * - Glassmorphic dropdown
 * - Avatar icons with account initials
 * - Read-only badges for shared accounts
 * - Active state indicator
 */

import React, { useState, useRef, useCallback } from 'react';
import { ChevronDown, User, Users, Lock, Check } from 'lucide-react';
import { useAccountContext, useAccountSwitcherOptions, type AccountSwitcherOption } from '../hooks/useAccountManager';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

interface AccountSwitcherProps {
  className?: string;
}

export function AccountSwitcher({ className = '' }: AccountSwitcherProps) {
  const { activeAccount, switchAccount, isSwitching } = useAccountContext();
  const accounts = useAccountSwitcherOptions();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useOnClickOutside(containerRef, () => setIsOpen(false));

  const handleSwitch = useCallback((accountId: string) => {
    if (accountId !== activeAccount?.id) {
      switchAccount(accountId);
    }
    setIsOpen(false);
  }, [activeAccount?.id, switchAccount]);

  // Get initials from account name/email
  const getInitials = (name: string): string => {
    const parts = name.split(/[@\s.]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Generate consistent color based on account name
  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-icloud-accent',
      'bg-icloud-green',
      'bg-icloud-orange',
      'bg-icloud-red',
      'bg-icloud-system-purple',
      'bg-icloud-system-pink',
      'bg-icloud-system-blue',
      'bg-icloud-system-magenta',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (accounts.length <= 1) {
    // Don't show switcher if only one account
    return null;
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          text-sm font-medium text-icloud-text-primary
          hover:bg-icloud-text-primary/5 active:bg-icloud-text-primary/10
          transition-colors duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isOpen ? 'bg-icloud-text-primary/5' : ''}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Switch account"
      >
        {/* Active Account Avatar */}
        {activeAccount && (
          <div
            className={`
              w-7 h-7 rounded-full flex items-center justify-center
              text-white text-xs font-semibold
              ${getAvatarColor(activeAccount.name)}
            `}
          >
            {getInitials(activeAccount.name)}
          </div>
        )}

        {/* Account Name */}
        <span className="max-w-[150px] truncate text-icloud-text-primary">
          {activeAccount?.name || 'Select Account'}
        </span>

        {/* Dropdown Chevron */}
        <ChevronDown
          className={`
            w-4 h-4 text-icloud-text-secondary
            transition-transform duration-200
            ${isOpen ? 'rotate-180' : ''}
          `}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`
            absolute right-0 top-full mt-2 w-72
            bg-white/95 bg-icloud-bg-primary/95 backdrop-blur-xl
            rounded-xl shadow-2xl border border-icloud-border
            py-2 z-50 dark:bg-icloud-bg-layer2
            animate-in fade-in slide-in-from-top-2 duration-150
          `}
          role="listbox"
          aria-label="Available accounts"
        >
          {/* Header */}
          <div className="px-4 py-2 border-b border-icloud-border">
            <p className="text-xs font-semibold text-icloud-text-secondary uppercase tracking-wider">
              Switch Account
            </p>
          </div>

          {/* Account List */}
          <div className="py-1 max-h-[300px] overflow-y-auto">
            {accounts.map((account) => (
              <AccountItem
                key={account.id}
                account={account}
                isActive={account.isActive}
                onSelect={() => handleSwitch(account.id)}
                getInitials={getInitials}
                getAvatarColor={getAvatarColor}
              />
            ))}
          </div>

          {/* Footer Info */}
          <div className="px-4 py-2 border-t border-icloud-border mt-1">
            <p className="text-xs text-icloud-text-secondary">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Account Item Component ============

interface AccountItemProps {
  account: AccountSwitcherOption;
  isActive: boolean;
  onSelect: () => void;
  getInitials: (name: string) => string;
  getAvatarColor: (name: string) => string;
}

function AccountItem({
  account,
  isActive,
  onSelect,
  getInitials,
  getAvatarColor,
}: AccountItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full px-4 py-3 flex items-center gap-3
        hover:bg-icloud-text-primary/5 transition-colors duration-150
        ${isActive ? 'bg-icloud-accent/5' : ''}
      `}
      role="option"
      aria-selected={isActive}
    >
      {/* Avatar */}
      <div
        className={`
          w-9 h-9 rounded-full flex items-center justify-center
          text-white text-sm font-semibold shrink-0
          ${getAvatarColor(account.name)}
        `}
      >
        {getInitials(account.name)}
      </div>

      {/* Account Info */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-icloud-text-primary truncate">
            {account.name}
          </span>
          {account.isReadOnly && (
            <Lock className="w-3 h-3 text-icloud-text-secondary shrink-0" aria-label="Read-only" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-icloud-text-secondary truncate">
            {account.email}
          </span>
          {!account.isPersonal && (
            <span className="text-[10px] px-1.5 py-0.5 bg-icloud-text-tertiary/15 text-icloud-text-secondary rounded-full">
              Shared
            </span>
          )}
        </div>
      </div>

      {/* Active Indicator */}
      {isActive && (
        <Check className="w-5 h-5 text-icloud-accent shrink-0" aria-label="Active account" />
      )}
    </button>
  );
}

// ============ Compact Account Switcher ============

export function CompactAccountSwitcher({ className = '' }: AccountSwitcherProps) {
  const { activeAccount, switchAccount, accounts } = useAccountContext();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(containerRef, () => setIsOpen(false));

  if (accounts.length <= 1) {
    return null;
  }

  const getInitials = (name: string): string => {
    const parts = name.split(/[@\s.]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-icloud-accent',
      'bg-icloud-green',
      'bg-icloud-orange',
      'bg-icloud-red',
      'bg-icloud-system-purple',
      'bg-icloud-system-pink',
      'bg-icloud-system-blue',
      'bg-icloud-system-magenta',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 p-1 rounded-lg hover:bg-icloud-text-primary/5 transition-colors"
        aria-label="Switch account"
        aria-expanded={isOpen}
      >
        <div
          className={`
            w-6 h-6 rounded-full flex items-center justify-center
            text-white text-[10px] font-semibold
            ${getAvatarColor(activeAccount?.name || '')}
          `}
        >
          {getInitials(activeAccount?.name || '??')}
        </div>
        <span className="text-xs font-medium text-icloud-text-primary max-w-[100px] truncate">
          {activeAccount?.name}
        </span>
        <ChevronDown className="w-3 h-3 text-icloud-text-secondary" />
      </button>

      {isOpen && (
        <div
          className="
            absolute right-0 top-full mt-1 w-64
            bg-white/95 bg-icloud-bg-primary/95 backdrop-blur-xl
            rounded-lg shadow-xl border border-icloud-border
            py-1 z-50 dark:bg-icloud-bg-layer2
          "
        >
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                switchAccount(account.id);
                setIsOpen(false);
              }}
              className={`
                w-full px-3 py-2 flex items-center gap-2
                hover:bg-icloud-text-primary/5 transition-colors
                ${account.id === activeAccount?.id ? 'bg-icloud-accent/5' : ''}
              `}
            >
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center
                  text-white text-[10px] font-semibold
                  ${getAvatarColor(account.name)}
                `}
              >
                {getInitials(account.name)}
              </div>
              <span className="text-sm text-icloud-text-primary flex-1 text-left truncate">
                {account.name}
              </span>
              {account.id === activeAccount?.id && (
                <Check className="w-4 h-4 text-icloud-accent" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
