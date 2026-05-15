/**
 * Search Types and Interfaces
 * Supports RFC 8621 JMAP Email/query and Thread/query filters with structured search
 */

export interface SearchFilter {
  // Email-level filters
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

  // Thread-level filters (Thread/query per RFC 8621 §4.4)
  threadFrom?: string;        // Thread has email from this sender
  threadTo?: string;          // Thread has email to this recipient
  threadSubject?: string;     // Thread has email with this subject
  threadHasAttachment?: boolean; // Thread has emails with attachments

  // Arbitrary header filters — RFC 8621 §4.4.1
  headerFilters?: { headerName: string; value?: string }[];
}

export interface SearchPill {
  id: string;
  type: 'from' | 'to' | 'cc' | 'subject' | 'date' | 'attachment' | 'unread' | 'flagged' | 'draft' | 'text' | 'header' |
        'threadFrom' | 'threadTo' | 'threadSubject' | 'threadAttachment';
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
