/**
 * Multi-Account State Management for JMAP
 * 
 * Provides account switching functionality with per-account state isolation.
 * Uses React Context + TanStack Query for state management.
 * 
 * Features:
 * - Account switching with state persistence
 * - Per-account query cache isolation
 * - Account metadata access (personal, read-only, capabilities)
 * - Cross-account blob copy support
 */

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';
import type { JMAPAccount } from '../types/jmap';

// ============ Types ============

export interface AccountInfo extends JMAPAccount {
  id: string;
}

export interface ActiveAccount {
  accountId: string;
  account: AccountInfo;
}

interface AccountContextValue {
  /** Currently active account ID */
  activeAccountId: string | null;
  /** Currently active account info */
  activeAccount: AccountInfo | null;
  /** All available accounts */
  accounts: AccountInfo[];
  /** Personal accounts (isPersonal=true) */
  personalAccounts: AccountInfo[];
  /** Switch to a different account */
  switchAccount: (accountId: string) => void;
  /** Whether account switching is in progress */
  isSwitching: boolean;
  /** Get account info by ID */
  getAccountById: (accountId: string) => AccountInfo | null;
  /** Check if account has specific capability */
  accountHasCapability: (accountId: string, capability: string) => boolean;
}

// ============ Context ============

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccountContext(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error('useAccountContext must be used within AccountProvider');
  }
  return ctx;
}

// ============ Storage Key ============

const ACTIVE_ACCOUNT_KEY = 'sagittarius_active_account';

// ============ Helper Functions ============

function getStoredActiveAccount(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function setStoredActiveAccount(accountId: string | null): void {
  try {
    if (accountId) {
      sessionStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    } else {
      sessionStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

// ============ Provider Component ============

interface AccountProviderProps {
  children: React.ReactNode;
}

export function AccountProvider({ children }: AccountProviderProps) {
  const queryClient = useQueryClient();
  const session = jmapClient.getSession();
  
  // Get all accounts from session
  const allAccounts = session?.accounts || {};
  const accounts: AccountInfo[] = Object.entries(allAccounts).map(([id, account]) => ({
    ...account,
    id,
  }));
  
  const personalAccounts = accounts.filter(a => a.isPersonal);
  
  // Initialize active account from storage or primary account
  const [activeAccountId, setActiveAccountId] = useState<string | null>(() => {
    const stored = getStoredActiveAccount();
    if (stored && allAccounts[stored]) {
      return stored;
    }
    // Fall back to primary mail account
    return jmapClient.getPrimaryAccount('urn:ietf:params:jmap:mail');
  });
  
  const [isSwitching, setIsSwitching] = useState(false);
  
  // Active account info
  const activeAccount = activeAccountId ? allAccounts[activeAccountId] 
    ? { ...allAccounts[activeAccountId], id: activeAccountId }
    : null : null;
  
  // Switch account handler
  const switchAccount = useCallback((accountId: string) => {
    if (accountId === activeAccountId || !allAccounts[accountId]) {
      return;
    }
    
    setIsSwitching(true);
    
    // Store the selection
    setStoredActiveAccount(accountId);
    setActiveAccountId(accountId);
    
    // Invalidate all queries to fetch fresh data for the new account
    // We don't clear the cache - just invalidate so stale data is refreshed
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const queryKey = query.queryKey;
        // Invalidate queries that are account-specific but don't match new account
        // Most queries have accountId as second element in key
        if (queryKey.length >= 2 && typeof queryKey[1] === 'string') {
          return true; // Invalidate all account-scoped queries
        }
        return false;
      }
    });
    
    // Reset switching state after a short delay
    setTimeout(() => setIsSwitching(false), 100);
  }, [activeAccountId, allAccounts, queryClient]);
  
  // Get account by ID
  const getAccountById = useCallback((accountId: string): AccountInfo | null => {
    const account = allAccounts[accountId];
    if (!account) return null;
    return { ...account, id: accountId };
  }, [allAccounts]);
  
  // Check account capability
  const accountHasCapability = useCallback((accountId: string, capability: string): boolean => {
    const account = allAccounts[accountId];
    if (!account) return false;
    return !!account.accountCapabilities?.[capability];
  }, [allAccounts]);
  
  // Sync with session changes (e.g., after re-auth)
  useEffect(() => {
    const currentSession = jmapClient.getSession();
    if (!currentSession) return;
    
    const currentAccounts = currentSession.accounts || {};
    if (!currentAccounts[activeAccountId || '']) {
      // Active account no longer exists, switch to primary
      const primary = jmapClient.getPrimaryAccount('urn:ietf:params:jmap:mail');
      if (primary && currentAccounts[primary]) {
        setActiveAccountId(primary);
        setStoredActiveAccount(primary);
      }
    }
  }, [session?.accounts, activeAccountId]);
  
  const value: AccountContextValue = {
    activeAccountId,
    activeAccount,
    accounts,
    personalAccounts,
    switchAccount,
    isSwitching,
    getAccountById,
    accountHasCapability,
  };
  
  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
}

// ============ Convenience Hooks ============

/**
 * Hook to get the currently active account ID
 */
export function useActiveAccountId(): string | null {
  return useAccountContext().activeAccountId;
}

/**
 * Hook to get full info about the active account
 */
export function useActiveAccount(): AccountInfo | null {
  return useAccountContext().activeAccount;
}

/**
 * Hook to get all available accounts
 */
export function useAccounts(): AccountInfo[] {
  return useAccountContext().accounts;
}

/**
 * Hook to get only personal accounts
 */
export function usePersonalAccounts(): AccountInfo[] {
  return useAccountContext().personalAccounts;
}

/**
 * Hook to switch accounts
 */
export function useSwitchAccount(): (accountId: string) => void {
  return useAccountContext().switchAccount;
}

/**
 * Hook to check if account switching is in progress
 */
export function useIsSwitchingAccount(): boolean {
  return useAccountContext().isSwitching;
}

/**
 * Hook to get account by ID
 */
export function useAccountById(accountId: string): AccountInfo | null {
  const { getAccountById } = useAccountContext();
  return getAccountById(accountId);
}

/**
 * Hook to check if a specific account has a capability
 */
export function useAccountHasCapability(accountId: string, capability: string): boolean {
  const { accountHasCapability } = useAccountContext();
  return accountHasCapability(accountId, capability);
}

/**
 * Hook to check if active account has a capability
 */
export function useActiveAccountHasCapability(capability: string): boolean {
  const { activeAccountId, accountHasCapability } = useAccountContext();
  if (!activeAccountId) return false;
  return accountHasCapability(activeAccountId, capability);
}

// ============ Query Key Helpers ============

/**
 * Creates a query key scoped to an account
 * Use this helper when creating query keys for account-specific data
 */
export function createAccountQueryKey(
  base: string, 
  accountId: string | null, 
  ...rest: unknown[]
): [string, string | null, ...unknown[]] {
  return [base, accountId, ...rest];
}

/**
 * Hook that returns a function to create properly scoped query keys
 * for the currently active account
 */
export function useAccountQueryKey() {
  const { activeAccountId } = useAccountContext();
  
  return useCallback(
    (base: string, ...rest: unknown[]) => createAccountQueryKey(base, activeAccountId, ...rest),
    [activeAccountId]
  );
}

// ============ Account-Aware JMAP Request Hook ============

/**
 * Hook that returns the current account ID for JMAP requests
 * Falls back to primary account if no active account
 */
export function useJMAPAccountId(): string | null {
  const { activeAccountId } = useAccountContext();
  
  // If no active account (shouldn't happen in practice), fall back to primary
  if (!activeAccountId) {
    return jmapClient.getPrimaryAccount();
  }
  
  return activeAccountId;
}

// ============ Account Switcher UI Hook ============

export interface AccountSwitcherOption {
  id: string;
  name: string;
  email: string;
  isPersonal: boolean;
  isReadOnly: boolean;
  isActive: boolean;
}

/**
 * Hook for building account switcher UI
 */
export function useAccountSwitcherOptions(): AccountSwitcherOption[] {
  const { accounts, activeAccountId } = useAccountContext();
  
  return accounts.map(account => ({
    id: account.id,
    name: account.name,
    email: account.name, // JMAP account name is typically the email
    isPersonal: account.isPersonal,
    isReadOnly: account.isReadOnly ?? false,
    isActive: account.id === activeAccountId,
  }));
}
