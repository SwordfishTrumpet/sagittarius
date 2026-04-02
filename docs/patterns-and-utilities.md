# Shared Patterns and Utilities

This document describes the shared patterns and utilities available in Sagittarius for building consistent, maintainable features.

## Table of Contents

- [JMAP Hook Factory](#jmap-hook-factory)
- [Optimistic Updates](#optimistic-updates)
- [Push Notification Management](#push-notification-management)
- [UI Components](#ui-components)
- [Toast Helpers](#toast-helpers)
- [Auth Utilities](#auth-utilities)

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

// Get next delay
const delay = strategy.nextDelay();
console.log(`Reconnecting in ${delay}ms (attempt ${strategy.attempts})`);

// Reset on successful connection
strategy.reset();
```

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

## Best Practices

### When Creating New JMAP Hooks

1. **Use the hook factory** for standard JMAP get methods
2. **Use `createJMAPListHook`** for list data
3. **Use `createJMAPSingletonHook`** for single objects (like VacationResponse)
4. **Only create custom hooks** when you need complex transform logic or additional query options

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
