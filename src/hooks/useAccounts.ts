import { useCallback, useMemo } from 'react'
import { useAccountStore, createNewAccount } from '../stores/accountStore'
import { jmapClient } from '../api/jmap'
import type { Account, AccountCredentials, AccountSession } from '../types/account'

export function useAccounts() {
  const accounts = useAccountStore((s) => s.accounts)
  const isLoading = useAccountStore((s) => s.isLoading)
  const error = useAccountStore((s) => s.error)
  
  return { accounts, isLoading, error }
}

export function useActiveAccount() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId)
  const accounts = useAccountStore((s) => s.accounts)
  const sessions = useAccountStore((s) => s.sessions)
  
  const activeAccount = useMemo(() => {
    return accounts.find((a) => a.id === activeAccountId)
  }, [accounts, activeAccountId])
  
  const activeSession = useMemo(() => {
    return sessions[activeAccountId || '']
  }, [sessions, activeAccountId])
  
  return { activeAccount, activeSession, activeAccountId }
}

export function useAccountActions() {
  const addAccount = useAccountStore((s) => s.addAccount)
  const removeAccount = useAccountStore((s) => s.removeAccount)
  const updateAccount = useAccountStore((s) => s.updateAccount)
  const setActiveAccount = useAccountStore((s) => s.setActiveAccount)
  const setSession = useAccountStore((s) => s.setSession)
  const clearSession = useAccountStore((s) => s.clearSession)
  const setLoading = useAccountStore((s) => s.setLoading)
  const setError = useAccountStore((s) => s.setError)
  
  const loginAccount = useCallback(async (credentials: AccountCredentials): Promise<Account | null> => {
    setLoading(true)
    setError(null)
    
    try {
      const session = await jmapClient.authenticate(credentials.username, credentials.password)
      
      if (!session) {
        throw new Error('Failed to establish session')
      }
      
      const authHeader = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
      
      const { account, accountSession } = createNewAccount(
        credentials,
        session,
        authHeader
      )
      
      addAccount(account, accountSession)
      
      return account
    } catch (error: any) {
      setError(error.message || 'Failed to add account')
      return null
    } finally {
      setLoading(false)
    }
  }, [addAccount, setLoading, setError])
  
  const logoutAccount = useCallback(async (accountId: string) => {
    const accounts = useAccountStore.getState().accounts
    const activeAccountId = useAccountStore.getState().activeAccountId
    
    clearSession(accountId)
    removeAccount(accountId)
    
    if (activeAccountId === accountId) {
      jmapClient.logout()
    }
  }, [clearSession, removeAccount])
  
  const switchAccount = useCallback((accountId: string) => {
    const accounts = useAccountStore.getState().accounts
    const account = accounts.find((a) => a.id === accountId)
    
    if (!account) {
      console.error('Account not found:', accountId)
      return
    }
    
    setActiveAccount(accountId)
    
    const sessions = useAccountStore.getState().sessions
    const session = sessions[accountId]
    
    if (session?.session && session?.accessToken) {
      sessionStorage.setItem('jmap_auth', session.accessToken)
      sessionStorage.setItem('jmap_session', JSON.stringify(session.session))
    }
  }, [setActiveAccount])
  
  const renameAccount = useCallback((accountId: string, name: string) => {
    updateAccount(accountId, { name })
  }, [updateAccount])
  
  const setAccountColor = useCallback((accountId: string, color: string) => {
    updateAccount(accountId, { color })
  }, [updateAccount])
  
  const refreshSession = useCallback(async (accountId: string, password: string): Promise<boolean> => {
    const accounts = useAccountStore.getState().accounts
    const account = accounts.find((a) => a.id === accountId)
    
    if (!account) {
      return false
    }
    
    try {
      const session = await jmapClient.authenticate(account.username, password)
      
      if (session) {
        const authHeader = `Basic ${btoa(`${account.username}:${password}`)}`
        setSession(accountId, {
          accountId,
          session,
          accessToken: authHeader,
          refreshedAt: Date.now(),
        })
        return true
      }
      
      return false
    } catch (error) {
      console.error('Failed to refresh session:', error)
      return false
    }
  }, [setSession])
  
  return {
    loginAccount,
    logoutAccount,
    switchAccount,
    renameAccount,
    setAccountColor,
    refreshSession,
    setLoading,
    setError,
  }
}