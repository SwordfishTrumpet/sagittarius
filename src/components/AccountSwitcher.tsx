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
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
      'bg-indigo-500',
      'bg-red-500',
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
          text-sm font-medium text-gray-700
          hover:bg-gray-100 active:bg-gray-200
          transition-colors duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isOpen ? 'bg-gray-100' : ''}
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
        <span className="max-w-[150px] truncate">
          {activeAccount?.name || 'Select Account'}
        </span>

        {/* Dropdown Chevron */}
        <ChevronDown
          className={`
            w-4 h-4 text-gray-400
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
            rounded-xl shadow-2xl border border-gray-200/50 border-icloud-border
            py-2 z-50
            animate-in fade-in slide-in-from-top-2 duration-150
          `}
          role="listbox"
          aria-label="Available accounts"
        >
          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-100 border-icloud-border">
            <p className="text-xs font-semibold text-gray-500  uppercase tracking-wider">
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
          <div className="px-4 py-2 border-t border-gray-100 border-icloud-border mt-1">
            <p className="text-xs text-gray-400 text-icloud-text-secondary">
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
        hover:bg-blue-50 transition-colors duration-150
        ${isActive ? 'bg-blue-50/50' : ''}
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
          <span className="text-sm font-medium text-gray-900 truncate">
            {account.name}
          </span>
          {account.isReadOnly && (
            <Lock className="w-3 h-3 text-gray-400 shrink-0" aria-label="Read-only" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 truncate">
            {account.email}
          </span>
          {!account.isPersonal && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
              Shared
            </span>
          )}
        </div>
      </div>

      {/* Active Indicator */}
      {isActive && (
        <Check className="w-5 h-5 text-blue-500 shrink-0" aria-label="Active account" />
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
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
      'bg-indigo-500',
      'bg-red-500',
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
        className="flex items-center gap-1 p-1 rounded-lg hover:bg-gray-100 transition-colors"
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
        <span className="text-xs font-medium text-gray-700 max-w-[100px] truncate">
          {activeAccount?.name}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>

      {isOpen && (
        <div
          className="
            absolute right-0 top-full mt-1 w-64
            bg-white/95 bg-icloud-bg-primary/95 backdrop-blur-xl
            rounded-lg shadow-xl border border-gray-200/50 border-icloud-border
            py-1 z-50
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
                hover:bg-blue-50 transition-colors
                ${account.id === activeAccount?.id ? 'bg-blue-50/50' : ''}
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
              <span className="text-sm text-gray-700 flex-1 text-left truncate">
                {account.name}
              </span>
              {account.id === activeAccount?.id && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
