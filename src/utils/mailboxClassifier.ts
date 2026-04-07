/**
 * Utility to classify mailboxes into system (Mailboxes) and custom (Folders) sections
 * Aligns with iCloud Mail's "MAILBOXES" and "FOLDERS" categorization
 */

import type { Mailbox } from '../types/jmap';

/**
 * System mailbox roles as per RFC 8621
 */
const SYSTEM_ROLES = new Set([
  'inbox',
  'sent',
  'drafts',
  'trash',
  'archive',
  'junk',
  'spam',
  'flagged',
]);

/**
 * iCloud Mail display order for system mailboxes.
 * Lower number = higher in the list.
 */
const SYSTEM_SORT_ORDER: Record<string, number> = {
  inbox: 0,
  drafts: 1,
  sent: 2,
  junk: 3,
  spam: 3, // alias for junk
  trash: 4,
  archive: 5,
  flagged: 6,
};

/**
 * Well-known system folder names that servers may use WITHOUT setting a role.
 * Maps lowercase name → canonical role for classification purposes.
 */
const KNOWN_SYSTEM_NAMES: Record<string, string> = {
  'inbox': 'inbox',
  'drafts': 'drafts',
  'draft': 'drafts',
  'sent': 'sent',
  'sent items': 'sent',
  'sent mail': 'sent',
  'junk': 'junk',
  'junk mail': 'junk',
  'spam': 'junk',
  'trash': 'trash',
  'deleted items': 'trash',
  'deleted messages': 'trash',
  'bin': 'trash',
  'archive': 'archive',
  'archives': 'archive',
};

export interface ClassifiedMailboxes {
  system: Mailbox[];  // Mailboxes with system roles (Inbox, Sent, Drafts, etc.)
  custom: Mailbox[];  // Custom user-created folders
}

/**
 * Resolve the effective role for a mailbox.
 * Uses the server-provided role first, then falls back to name matching.
 */
function getEffectiveRole(mailbox: Mailbox): Mailbox['role'] | null {
  if (mailbox.role && SYSTEM_ROLES.has(mailbox.role)) {
    return mailbox.role;
  }
  // Fallback: match by well-known name (only for top-level mailboxes)
  if (!mailbox.parentId) {
    const nameLower = (mailbox.name || '').toLowerCase().trim();
    if (KNOWN_SYSTEM_NAMES[nameLower]) {
      return KNOWN_SYSTEM_NAMES[nameLower] as Mailbox['role'];
    }
  }
  return null;
}

/**
 * Classify flat mailboxes into system and custom folders.
 * - System: mailboxes with a role OR a well-known system name (top-level only)
 * - Custom: everything else
 * System mailboxes are sorted in iCloud Mail order.
 */
export function classifyMailboxes(mailboxes: Mailbox[]): ClassifiedMailboxes {
  const system: Mailbox[] = [];
  const custom: Mailbox[] = [];

  mailboxes.forEach((mailbox) => {
    const role = getEffectiveRole(mailbox);
    if (role) {
      // Attach effective role for downstream use (icon, sort)
      system.push({ ...mailbox, _effectiveRole: role } as Mailbox);
    } else {
      custom.push(mailbox);
    }
  });

  // Sort system mailboxes in iCloud Mail canonical order
  system.sort((a, b) => {
    const orderA = SYSTEM_SORT_ORDER[(a as unknown as { _effectiveRole: string })._effectiveRole] ?? 99;
    const orderB = SYSTEM_SORT_ORDER[(b as unknown as { _effectiveRole: string })._effectiveRole] ?? 99;
    return orderA - orderB;
  });

  return { system, custom };
}

/**
 * Check if a mailbox is a system mailbox
 */
export function isSystemMailbox(mailbox: Mailbox): boolean {
  return getEffectiveRole(mailbox) !== null;
}

/**
 * Check if a mailbox is a custom folder
 */
export function isCustomFolder(mailbox: Mailbox): boolean {
  return !isSystemMailbox(mailbox);
}
