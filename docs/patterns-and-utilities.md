# Shared Patterns and Utilities

This document describes the shared patterns and utilities available in Sagittarius for building consistent, maintainable features.

## Table of Contents

- [Testing Patterns](#testing-patterns)
- [JMAP Hook Factory](#jmap-hook-factory)
- [Optimistic Updates](#optimistic-updates)
- [Push Notification Management](#push-notification-management)
- [UI Components](#ui-components)
- [Toast Helpers](#toast-helpers)
- [Auth Utilities](#auth-utilities)

---

## Testing Patterns

### Threaded Test Execution

Tests run in parallel using Vitest's thread pool by default (configured in `vitest.config.ts`). This provides ~27% faster execution.

```bash
# Default: threaded execution
npm test

# Sequential (for debugging)
npm run test:sequential

# CI-optimized (dot reporter)
npm run test:ci
```

### Component Test Setup

Always wrap components with required providers:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
})

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
)

// In tests:
render(<MyComponent />, { wrapper: Wrapper })
```

### Mocking Framer Motion

Framer Motion components need special handling for event simulation:

```typescript
// ❌ userEvent.dblClick may not work with mocked motion components
await user.dblClick(element)

// ✅ Use fireEvent for reliable event triggering
import { fireEvent } from '@testing-library/react'
fireEvent.doubleClick(element)
```

### Mocking JMAP Client

Always include `getPrimaryAccount` in jmapClient mocks:

```typescript
vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getAccountCapability: () => ({ maxDelayedSend: 3600 }),
    uploadBlob: vi.fn(),
    getPrimaryAccount: () => 'account-1',  // Required!
  },
}))
```

### Handling Component Refs in Tests

When components rely on DOM refs for positioning (like ContextMenu submenus), ensure fallback logic:

```typescript
// Component should handle missing refs gracefully
const openSubmenu = (item, index, button?) => {
  const rect = (button || itemRefs.current[index])?.getBoundingClientRect();
  const menuRect = menuRef.current?.getBoundingClientRect();
  
  if (rect && menuRect) {
    // Normal positioning
    setSubmenuPos({ top: rect.top - menuRect.top, left: rect.right - menuRect.left });
  } else if (menuRect) {
    // Fallback for test environment
    setSubmenuPos({ top: index * 40, left: menuRect.width });
  }
  // Still show submenu even without positioning
  setActiveSubmenu(item.id);
};
```

### Accessibility Testing Checklist

- [ ] Verify `aria-label` attributes match expected button names
- [ ] Test `aria-pressed` for toggle buttons
- [ ] Test `aria-selected` for tabs and selectable items
- [ ] Verify `role` attributes (dialog, menu, tab, etc.)
- [ ] Test keyboard navigation (Tab, Arrow keys, Enter, Escape)

### Common Test Fix Patterns

| Issue | Cause | Solution |
|-------|-------|----------|
| "No QueryClient set" | Missing provider wrapper | Add `QueryClientProvider` wrapper |
| "getPrimaryAccount is not a function" | Incomplete jmapClient mock | Add `getPrimaryAccount` to mock |
| Double-click not triggering | Framer-motion mock incompatibility | Use `fireEvent.doubleClick()` |
| Menu/submenu not appearing | Missing ref in test environment | Add fallback positioning in component |
| aria-label mismatch | Wrong button name in test | Update test to match actual aria-label |

---

## JMAP Hook Factory

The JMAP hook factory reduces boilerplate when creating new JMAP query hooks. Located in `src/hooks/jmap/jmapHookFactory.ts`.

### Usage

```typescript
import { createJMAPQueryHook, createJMAPListHook, createJMAPSingletonHook } from './jmap/jmapHookFactory';

// For list data (most common)
export const useVacation = createJMAPSingletonHook<VacationResponse>(
  'VacationResponse/get',
  'vacation',
  {
    staleTime: 10 * 60 * 1000, // 10 minutes
  }
);

// For list data
export const useMailboxes = createJMAPListHook<Mailbox>(
  'Mailbox/get',
  'mailboxes'
);

// For custom transform
export const useCustomData = createJMAPQueryHook<CustomType>(
  'Custom/get',
  'custom',
  {
    transform: (response) => {
      // Custom transformation logic
      return response.methodResponses[0][1].list;
    },
    capability: 'urn:ietf:params:jmap:custom',
  }
);
```

### Factory Functions

| Factory | Use Case | Returns |
|---------|----------|---------|
| `createJMAPQueryHook` | Generic hook with custom transform | `TResult` |
| `createJMAPListHook` | List data from JMAP get method | `TItem[]` |
| `createJMAPSingletonHook` | Single object or null (e.g., VacationResponse) | `TResult \| null` |

### Options

- `transform`: Transform the raw JMAP response
- `getArgs`: Customize the arguments passed to the JMAP method
- `capability`: Required JMAP capability for the method
- `staleTime`: Cache stale time in milliseconds (default: 10 minutes)

---

## Optimistic Updates

The optimistic update utilities provide consistent patterns for updating UI before the server confirms the change. Located in `src/hooks/jmap/optimisticUpdates.ts`.

### Basic Usage

```typescript
import { performOptimisticEmailUpdate, rollbackOptimisticUpdates } from './jmap/optimisticUpdates';

const mutation = useMutation({
  mutationFn: async ({ emailId, keywords }) => {
    // ... API call
  },
  onMutate: async ({ emailId, keywords }) => {
    const { previousSnapshots } = await performOptimisticEmailUpdate({
      queryClient,
      queryKeys: [['threads'], ['emails'], ['emailDetail']],
      applyPatch: (email) => ({ ...email, keywords: { ...email.keywords, ...keywords } }),
      shouldPatch: (email) => email.id === emailId,
    });

    return { previousSnapshots };
  },
  onError: (err, vars, context) => {
    rollbackOptimisticUpdates(queryClient, context?.previousSnapshots);
  },
});
```

### Factory for Common Patterns

```typescript
import { createEmailOptimisticHandlers } from './jmap/optimisticUpdates';

const { onMutate, onError } = createEmailOptimisticHandlers({
  queryClient,
  queryKeys: [['threads'], ['emails']],
  getEmailIds: (vars) => vars.emailIds,
  getPatch: (vars) => ({ keywords: vars.keywords }),
});

const mutation = useMutation({
  mutationFn: apiCall,
  onMutate,
  onError,
});
```

---

## Push Notification Management

Shared utilities for managing push notifications from EventSource and WebSocket connections.

### Notification Suppression

Suppress new-mail notifications after local mutations (prevents notification sounds from server echoes). Located in `src/utils/notificationSuppressor.ts`.

```typescript
import { sharedNotificationSuppressor } from '../utils/notificationSuppressor';

// Before local mutation
sharedNotificationSuppressor.suppress();

// Check if notifications should be suppressed
if (sharedNotificationSuppressor.shouldSuppress(3000)) {
  // Skip notification
}
```

### State Change Handling

Handle JMAP StateChange push notifications consistently. Located in `src/utils/stateChangeHandler.ts`.

```typescript
import { createStateChangeHandler } from '../utils/stateChangeHandler';

const handler = createStateChangeHandler(queryClient, {
  logPrefix: '[MyManager]',
});

// Handle incoming state change
handler.handleStateChange(changedData, newMailListeners);

// Invalidate specific type
handler.invalidateForType('Email', newMailListeners);
```

### Reconnection Strategy

Exponential backoff reconnection logic. Located in `src/utils/reconnectionStrategy.ts`.

```typescript
import { createReconnectionStrategy, RECONNECTION_DEFAULTS } from '../utils/reconnectionStrategy';

const strategy = createReconnectionStrategy({
  baseDelayMs: 1000,
  maxDelayMs: 60000,
});

// Get next delay - NOTE: attempts starts at 0 and increments AFTER nextDelay()
const delay = strategy.nextDelay();
console.log(`Reconnecting in ${delay}ms (attempt ${strategy.attempts})`);

// Reset on successful connection
strategy.reset();
```

⚠️ **CRITICAL PATTERN - Never Block First Reconnect:**

The `attempts` counter starts at 0 and only increments **after** calling `nextDelay()`. Do NOT add logic like:

```typescript
// ❌ WRONG - This blocks ALL reconnection attempts!
if (strategy.attempts === 0) {
  console.error('First attempt failed, giving up forever');
  return;
}
```

Always allow the reconnection strategy to handle backoff naturally. The strategy will exponentially increase delays (1s → 2s → 4s → 8s... max 60s) and reset on successful connection.

---

## UI Components

### BaseDialog

Reusable modal dialog with consistent styling, focus trapping, and accessibility. Located in `src/components/dialogs/BaseDialog.tsx`.

```tsx
import { BaseDialog } from './dialogs/BaseDialog';

function MyDialog({ isOpen, onClose }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Dialog Title"
      titleId="my-dialog-title"
      initialFocusRef={inputRef}
    >
      <form className="p-6">
        {/* Dialog content */}
      </form>
    </BaseDialog>
  );
}
```

### Card Components

Standardized card and form section styling. Located in `src/components/ui/Card.tsx`.

```tsx
import { Card, FormSection, FormField, Skeleton } from './ui/Card';

// Standard card
<Card padding="medium">
  <p>Card content</p>
</Card>

// Form section with fields
<FormSection>
  <FormField label="Display Name">
    <input type="text" className="w-full px-4 pb-3 pt-1" />
  </FormField>
  <FormField label="Email">
    <input type="email" className="w-full px-4 pb-3 pt-1" />
  </FormField>
</FormSection>

// Loading skeleton
<Skeleton count={3} />
```

### Card Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `padding` | `'none' \| 'small' \| 'medium' \| 'large'` | `'none'` | Inner padding |
| `dividers` | `boolean` | `false` | Add dividers between children |
| `className` | `string` | `''` | Additional CSS classes |

---

## Toast Helpers

Standardized toast notifications for consistent UX. Located in `src/utils/toastHelpers.ts`.

### Usage

```typescript
import { toastOperationError, toastSuccess, toastWithUndo, ToastErrors } from '../utils/toastHelpers';

// Standardized error message
toastOperationError('identity.create');
// Shows: "Failed to create identity"

// With custom error
toastOperationError('email.send', new Error('Network timeout'));

// Success toast
toastSuccess('Email sent successfully');

// With undo action
toastWithUndo(
  'Email moved to Trash',
  'Undo',
  () => restoreEmail(originalLocation)
);
```

### Error Categories

Available error keys for `toastOperationError()`:

| Category | Actions |
|----------|---------|
| `identity` | `create`, `update`, `delete` |
| `vacation` | `save` |
| `sieve` | `save`, `delete`, `activate` |
| `folder` | `create`, `rename`, `delete` |
| `email` | `send`, `saveDraft`, `move`, `delete`, `import` |
| `settings` | `save`, `load` |
| `network` | `default`, `timeout`, `offline` |

### Adding New Error Messages

Add new messages to `ToastErrors` in `src/utils/toastHelpers.ts`:

```typescript
export const ToastErrors = {
  myFeature: {
    myAction: 'Failed to perform my action',
  },
  // ...
};
```

---

## Auth Utilities

Token extraction and auth-related helpers. Located in `src/utils/auth.ts`.

```typescript
import { extractAuthToken, isBasicAuth } from '../utils/auth';

// Extract token from Authorization header
const authToken = extractAuthToken('Basic dXNlcjpwYXNz');
// Returns: "dXNlcjpwYXNz"

// Check if Basic auth
if (isBasicAuth(authHeader)) {
  // Handle Basic auth
}
```

---

## JMAP Filter Types

RFC 8621 §4.4 defines the filter types for Email/query. Use these types instead of `any` when building filters:

```typescript
import type { EmailFilter, EmailFilterCondition, EmailFilterOperator } from '../types/jmap';

// Building filter conditions
const mailboxConditions: EmailFilter[] = [];
if (mailboxId) {
  mailboxConditions.push({ inMailbox: mailboxId });
}

// Combining with operators
const filter: EmailFilter = {
  allOf: [
    { inMailbox: inboxId },
    { hasKeyword: '$flagged' },
    { text: searchTerm }
  ]
};

// Complex nested filters
const complexFilter: EmailFilter = {
  anyOf: [
    { from: 'sender@example.com' },
    { 
      allOf: [
        { to: 'me@example.com' },
        { hasAttachment: true }
      ]
    }
  ]
};
```

### Key Filter Properties

| Property | Type | Description |
|----------|------|-------------|
| `inMailbox` | `string` | Must be in this mailbox |
| `hasKeyword` | `string` | Has keyword (e.g., `$seen`, `$flagged`) |
| `notHasKeyword` | `string` | Does not have keyword |
| `from` | `string` | From field contains |
| `to` | `string` | To field contains |
| `subject` | `string` | Subject contains |
| `text` | `string` | Any text field contains |
| `hasAttachment` | `boolean` | Has attachments |
| `after` | `string` | Received on or after (ISO date) |
| `before` | `string` | Received on or before (ISO date) |

### Type-Safe Hook Parameters

When creating hooks that accept filters, use the `EmailFilter` type:

```typescript
export function useThreads(
  mailboxId?: string,
  searchTerm?: string,
  quickFilters?: EmailFilter,  // Instead of Record<string, any>
) {
  // ... implementation
}
```

---

## JMAP Query Hooks

For query operations (searching/filtering with `/query` + `/get`), use the established hooks in `src/hooks/jmap/useJMAPQueries.ts`:

```typescript
import { 
  useMailboxQuery, 
  useThreadQuery, 
  useIdentityQuery,
  useQuotaQuery 
} from '../hooks/jmap/useJMAPQueries';

// Search mailboxes by name
const { data: mailboxes } = useMailboxQuery({
  filter: { name: 'inbox' }
});

// Find threads from specific sender
const { data: threads } = useThreadQuery({
  filter: { from: 'sender@example.com' }
});

// Find identities by email pattern
const { data: identities } = useIdentityQuery({
  filter: { email: '@example.com' }
});

// Find quotas by resource type (RFC 9425)
const { data: quotas } = useQuotaQuery({
  filter: { resourceType: 'octets' }
});
```

### Query Hook Options

All query hooks accept the same options interface:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filter` | `FilterCondition \| FilterOperator` | - | Filter conditions per RFC |
| `sort` | `JMAPSortComparator[]` | varies | Sort order (property + direction) |
| `limit` | `number` | 100 | Maximum results to return |
| `position` | `number` | 0 | Pagination offset |

### Available Query Hooks

| Hook | JMAP Methods | Filter Type | Stale Time |
|------|--------------|-------------|------------|
| `useMailboxQuery` | `Mailbox/query` + `Mailbox/get` | `MailboxFilter` | 5 min |
| `useThreadQuery` | `Thread/query` + `Thread/get` | `ThreadFilter` | 5 min |
| `useIdentityQuery` | `Identity/query` + `Identity/get` | `IdentityFilter` | 10 min |
| `useQuotaQuery` | `Quota/query` + `Quota/get` | `QuotaFilter` | 10 min |

---

## Quota Filter Types (RFC 9425)

For Quota/query operations (RFC 9425 - JMAP for Quotas):

```typescript
import type { QuotaFilter, QuotaFilterCondition, QuotaFilterOperator } from '../types/jmap';

// Simple filter by resource type
const filter: QuotaFilter = { resourceType: 'octets' };

// Filter by scope
const filter: QuotaFilter = { scope: 'account' };

// Complex nested filters
const complexFilter: QuotaFilter = {
  allOf: [
    { resourceType: 'octets' },
    { scope: 'account' },
    { name: 'Storage' }
  ]
};
```

### Quota Filter Properties

| Property | Type | Description |
|----------|------|-------------|
| `ids` | `string[]` | Specific quota IDs to match |
| `resourceType` | `string` | Resource type (e.g., `'octets'`, `'messages'`) |
| `scope` | `string` | Quota scope (`'account'`, `'domain'`, `'global'`) |
| `name` | `string` | Quota name contains |
| `types` | `string[]` | Types this quota applies to |

---

## Best Practices

### When Creating New JMAP Hooks

1. **Use the hook factory** for standard JMAP get methods
2. **Use `createJMAPListHook`** for list data
3. **Use `createJMAPSingletonHook`** for single objects (like VacationResponse)
4. **Only create custom hooks** when you need complex transform logic or additional query options
5. **Use proper JMAP filter types** — replace `any` with `EmailFilter`, `Email`, `Mailbox` types

### Type Safety Checklist

- [ ] Use `Mailbox` type instead of `any` for mailbox parameters
- [ ] Use `Email` type instead of `any` for email parameters
- [ ] Use `EmailFilter` type for JMAP query filters
- [ ] Use `QuotaFilter` type for Quota/query filters (RFC 9425)
- [ ] Import types from `'../types/jmap'` or `'../types/sieve'`
- [ ] Add defensive depth limits for recursive components

### When Implementing Mutations

1. **Use optimistic updates** for immediate UI feedback
2. **Use `performOptimisticEmailUpdate`** for standard email mutations
3. **Always provide rollback** in `onError` handlers
4. **Suppress notifications** for local mutations to prevent duplicate sounds

### When Creating Dialogs

1. **Use `BaseDialog`** for consistent modal behavior
2. **Provide `titleId`** for accessibility
3. **Use `initialFocusRef`** for better keyboard navigation
4. **Use `FormSection` and `FormField`** for form layouts

### When Showing Toast Notifications

1. **Use `toastOperationError`** for standardized error messages
2. **Add new error keys** to `ToastErrors` rather than using raw strings
3. **Use `toastWithUndo`** for actions that can be reversed
4. **Be consistent** with error message phrasing across the app

---

## Defensive Coding Patterns

### Recursion Depth Limiting

When rendering recursive structures (like folder hierarchies), add a depth limit to prevent infinite loops from circular references:

```typescript
/** Maximum nesting depth for recursive components */
const MAX_DEPTH = 10;

interface RecursiveProps {
  node: TreeNode;
  maxDepth?: number;
}

function RecursiveComponent({ node, maxDepth = MAX_DEPTH }: RecursiveProps) {
  // Safety check: stop rendering if depth exceeded
  if (maxDepth <= 0) {
    console.warn(`[RecursiveComponent] Max depth exceeded at node "${node.name}"`);
    return null;
  }

  return (
    <div>
      {/* Render current node */}
      <span>{node.name}</span>
      
      {/* Render children with decremented depth */}
      {node.children?.map(child => (
        <RecursiveComponent
          key={child.id}
          node={child}
          maxDepth={maxDepth - 1}
        />
      ))}
    </div>
  );
}
```

**When to use:**
- Recursive folder hierarchies
- Tree views with user-generated content
- Any recursive component that processes server data

---

## Debugging Push Connections

When troubleshooting "Reconnecting" status or connection issues:

### Check Browser Console

Push connection logs now appear in the browser console (not just `logger.debug`):

```
[useWebSocket] Connecting to ws://.../jmap/ws?access_token=***
[useWebSocket] Connection state changed: true        ← Connected
[JMAP WebSocket] Closed (code=1006). Will reconnect... ← Reconnecting
[EventSource] Connection lost. Reconnecting in 1000ms... (attempt 1)
```

### Common Issues

1. **Always "Reconnecting"**
   - Check DevTools → Network → WS (WebSocket filter)
   - Verify JMAP session has `webSocketUrl` or `eventSourceUrl`
   - Check that credentials are valid (401 errors block connection)

2. **WebSocket 401 Errors**
   - Stalwart returns WebSocket URL in unauthenticated session
   - But WebSocket connection requires valid auth token
   - Ensure user is logged in with valid credentials

3. **EventSource Not Reconnecting**
   - Fixed: Previously blocked on `attempts === 0`
   - Now always retries with exponential backoff

### Add Console Warnings for Critical Failures

When connection failures affect user experience, use `console.warn`:

```typescript
// ❌ Invisible to users - only in logger debug logs
logger.warn('[Connection] Failed to connect');

// ✅ Visible in browser DevTools console
// eslint-disable-next-line no-console
console.warn('[Connection] Failed to connect - check credentials');
logger.warn('[Connection] Failed to connect');
```

This ensures users can self-diagnose connection issues without needing to enable debug logging.

---

## RFC Implementation Learnings

### RFC Number Verification

**Always verify RFC numbers before implementation.** During the implementation of JMAP Contacts, we discovered:

- ❌ **RFC 9248** is NOT "JMAP for Contacts" — it's "Interoperability Profile for Relay User Equipment" (Video Relay Service for deaf/hard-of-hearing users)
- ✅ **RFC 9610** is the correct RFC for JMAP for Contacts (published December 2024)

**Best practice:** When implementing a new RFC:
1. Check the official RFC title at datatracker.ietf.org
2. Verify the abstract matches your expected functionality
3. Update any documentation with incorrect RFC references

### Complex Nested Filter Types

Some JMAP RFCs define complex filter conditions with nested property paths:

```typescript
// RFC 9610 ContactCard filters support nested name searches
export interface ContactCardFilterCondition {
  // Standard conditions
  text?: string;
  email?: string;
  
  // Nested name component conditions
  'name/given'?: string;     // Given name
  'name/surname'?: string;   // Surname
  'name/surname2'?: string;  // Second surname
}
```

When building query keys for these filters, serialize the entire filter object:

```typescript
queryKey: ['contactCardQuery', accountId, JSON.stringify(filter)]
```

### Multi-Data Type References (RFC 9610 Pattern)

RFC 9610 ContactCards can belong to multiple AddressBooks via a map structure:

```typescript
// A ContactCard belongs to one or more AddressBooks
interface ContactCard {
  addressBookIds: Record<string, boolean>; // Map of AddressBook ID -> true
}
```

When filtering, check for existence in the map:

```typescript
const inAddressBook = (card: ContactCard, bookId: string) => 
  card.addressBookIds[bookId] === true;
```

### RFC Dependency Chains

RFCs often depend on other RFCs. For example:

| RFC | Purpose | Depends On |
|-----|---------|------------|
| RFC 9610 | JMAP for Contacts | RFC 9553 (JSContact Card format) |
| RFC 8984 | JSCalendar | RFC 5545 (iCalendar concepts) |
| RFC 9404 | Blob Management | RFC 8620 (JMAP Core) |

When implementing, check if the RFC references data types from other specifications.

### Sharing and Permissions (RFC 9670 Integration)

RFC 9610 integrates with JMAP Sharing (RFC 9670) for shared address books:

```typescript
export interface AddressBookRights {
  mayRead: boolean;   // Can view contacts
  mayWrite: boolean;  // Can create/edit contacts
  mayShare: boolean;  // Can share with others
  mayDelete: boolean; // Can delete address book
}

export interface AddressBook {
  shareWith: Record<string, AddressBookRights> | null;
  myRights: AddressBookRights; // Server-set
}
```

Always implement both `shareWith` (who it's shared with) and `myRights` (what the current user can do).

### Handling Group/Collection Types

Some JMAP types represent groups of other objects:

```typescript
// ContactCard can represent an individual OR a group
interface ContactCard {
  kind?: 'individual' | 'group' | 'organization' | 'location';
  // For groups, members contains uids of other contacts
  members?: string[];
}
```

Provide type guards for working with group types:

```typescript
export function isContactGroup(contact: ContactCard): boolean {
  return contact.kind === 'group';
}
```
