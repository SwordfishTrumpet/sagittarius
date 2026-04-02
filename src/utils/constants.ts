// Application-wide timeout and duration constants
// Centralized to avoid magic numbers throughout the codebase

// Cache stale times (in milliseconds)
export const STALE_TIME = {
  mailboxes: 5 * 60 * 1000,        // 5 minutes
  quota: 15 * 60 * 1000,            // 15 minutes
  identities: 30 * 60 * 1000,       // 30 minutes
} as const;

// Auto-save and persistence
export const AUTO_SAVE = {
  draftDebounce: 2000,              // 2 seconds between draft saves
  draftPersistInterval: 30000,      // 30 seconds for persistent storage
} as const;

// Resource cleanup timeouts
export const CLEANUP = {
  objectUrlRevoke: 60000,           // 1 minute before revoking object URLs
  toastDuration: 4000,              // 4 seconds for toast notifications
  tooltipDelay: 300,                // 300ms for tooltip appearance
} as const;

// Animation and transition durations
export const ANIMATION = {
  fast: 150,                        // 150ms - quick transitions
  normal: 200,                      // 200ms - standard transitions
  slow: 300,                        // 300ms - emphasis transitions
  listItem: 250,                    // 250ms - list item animations
} as const;

// Network and API timeouts
export const NETWORK = {
  requestTimeout: 30000,            // 30 seconds for API requests
  reconnectDelay: 3000,              // 3 seconds between reconnection attempts
  maxReconnectAttempts: 5,           // Maximum reconnection attempts
} as const;

// Debounce delays
export const DEBOUNCE = {
  search: 300,                      // 300ms for search input
  resize: 100,                      // 100ms for window resize
  scroll: 50,                       // 50ms for scroll events
} as const;
