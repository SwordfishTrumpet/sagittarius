/**
 * Search Types and Interfaces
 * Supports RFC 8621 JMAP Email/query filters with structured search
 */

export interface SearchFilter {
  from?: string;              // Email address or "me"
  to?: string;                // Email address
  cc?: string;                // Email address
  subject?: string;           // Subject keywords
  text?: string;              // Free-text search body
  before?: Date;              // Date range (before)
  after?: Date;               // Date range (after)
  hasAttachment?: boolean;    // Has attachments
  isUnread?: boolean;         // Unread emails
  isFlagged?: boolean;        // Flagged emails
  isDraft?: boolean;          // Draft emails
  isAnswered?: boolean;       // Replied to
}

export interface SearchPill {
  id: string;
  type: 'from' | 'to' | 'cc' | 'subject' | 'date' | 'attachment' | 'unread' | 'flagged' | 'draft' | 'text';
  label: string;
  value: string;
}

export interface RecentSearch {
  id: string;
  query: string;
  filters: SearchFilter;
  timestamp: number;
}

export interface ParsedQuery {
  text: string;
  filters: SearchFilter;
}
