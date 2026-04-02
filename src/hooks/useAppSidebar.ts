import { useState, useCallback } from 'react'

interface SidebarSectionState {
  mailboxes: boolean
  folders: boolean
}

interface UseAppSidebarOptions {
  defaultCollapsed?: boolean
}

interface UseAppSidebarReturn {
  isSidebarCollapsed: boolean
  expandedSections: SidebarSectionState
  toggleSidebarCollapsed: () => void
  expandSidebar: () => void
  collapseSidebar: () => void
  toggleSectionExpanded: (section: keyof SidebarSectionState) => void
  setSectionExpanded: (section: keyof SidebarSectionState, expanded: boolean) => void
}

/**
 * Hook for managing app sidebar state.
 * Handles collapsed/expanded state and section expansion for mailboxes/folders.
 */
export function useAppSidebar({
  defaultCollapsed = false,
}: UseAppSidebarOptions = {}): UseAppSidebarReturn {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(defaultCollapsed)
  const [expandedSections, setExpandedSections] = useState<SidebarSectionState>({
    mailboxes: true,
    folders: true,
  })

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev)
  }, [])

  const expandSidebar = useCallback(() => {
    setIsSidebarCollapsed(false)
  }, [])

  const collapseSidebar = useCallback(() => {
    setIsSidebarCollapsed(true)
  }, [])

  const toggleSectionExpanded = useCallback((section: keyof SidebarSectionState) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }, [])

  const setSectionExpanded = useCallback((section: keyof SidebarSectionState, expanded: boolean) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: expanded,
    }))
  }, [])

  return {
    isSidebarCollapsed,
    expandedSections,
    toggleSidebarCollapsed,
    expandSidebar,
    collapseSidebar,
    toggleSectionExpanded,
    setSectionExpanded,
  }
}
