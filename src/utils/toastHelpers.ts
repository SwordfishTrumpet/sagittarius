import { toast } from 'sonner';

/**
 * Standardized toast error messages for consistent UX across the application.
 */
export const ToastErrors = {
  identity: {
    create: 'Failed to create identity',
    update: 'Failed to update identity',
    delete: 'Failed to delete identity',
  },
  vacation: {
    save: 'Failed to save vacation response',
  },
  sieve: {
    save: 'Failed to save rule',
    delete: 'Failed to delete rule',
    activate: 'Failed to update rule',
  },
  folder: {
    create: 'Failed to create folder',
    rename: 'Failed to rename folder',
    delete: 'Failed to delete folder',
  },
  email: {
    send: 'Failed to send email',
    saveDraft: 'Failed to save draft',
    move: 'Failed to move email',
    delete: 'Failed to delete email',
    import: 'Failed to import email',
    reopen: 'Failed to reopen draft',
  },
  attachment: {
    upload: 'Failed to upload attachment',
    empty: 'Cannot upload file: file is empty (0 bytes)',
  },
  settings: {
    save: 'Failed to save settings',
    load: 'Failed to load settings',
  },
  network: {
    default: 'Something went wrong. Please try again.',
    timeout: 'Request timed out. Please try again.',
    offline: 'You appear to be offline. Changes will sync when reconnected.',
  },
  mdn: {
    send: 'Failed to send receipt',
  },
} as const;

/**
 * Shows a standardized error toast for a failed operation.
 * @param operation The type of operation that failed (e.g., 'identity.create')
 * @param error Optional error object or message for additional context
 */
export function toastOperationError(
  operation: keyof typeof ToastErrors | `${keyof typeof ToastErrors}.${string}`,
  error?: Error | string | null,
): void {
  // Parse the operation path (e.g., 'identity.create' -> ['identity', 'create'])
  const [category, action] = operation.split('.') as [keyof typeof ToastErrors, string];

  // Get the error message from the constants
  const categoryErrors = ToastErrors[category];
  let message: string;

  if (categoryErrors && typeof categoryErrors === 'object') {
    message = (categoryErrors as Record<string, string>)[action] || ToastErrors.network.default;
  } else {
    message = ToastErrors.network.default;
  }

  // If an error was provided, we could potentially log it or include it in the message
  // For now, just show the standardized message to keep UX consistent
  toast.error(message);
}

/**
 * Shows a standardized success toast.
 * @param message The success message to display
 */
export function toastSuccess(message: string): void {
  toast.success(message);
}

/**
 * Shows an action toast with undo functionality.
 * @param message The action message to display
 * @param undoLabel Label for the undo button
 * @param onUndo Callback when undo is clicked
 */
export function toastWithUndo(
  message: string,
  undoLabel: string = 'Undo',
  onUndo: () => void,
): void {
  toast.success(message, {
    action: {
      label: undoLabel,
      onClick: onUndo,
    },
  });
}
