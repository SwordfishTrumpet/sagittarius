import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useMemo, useRef, useCallback, useEffect } from 'react';
import { Inbox } from 'lucide-react';
import { MessageListItem } from './MessageListItem';
import { AnimatePresence } from 'framer-motion';

interface VirtualMessageListProps {
  emails: any[];
  isLoading: boolean;
  isRefetching: boolean;
  selectedEmailId: string | null;
  selectedEmailIds: Set<string>;
  mailboxes: any[];
  onToggleSelection: (emailId: string, ctrlKey: boolean, shiftKey: boolean) => void;
  onToggleFlag: (emailId: string, flagged: boolean) => void;
  formatMessageDate: (date: string) => string;
  removingEmailIds?: Set<string>;
  scrollToEmailId?: string | null;
}

export const VirtualMessageList = ({
  emails,
  isLoading,
  isRefetching,
  selectedEmailId,
  selectedEmailIds,
  mailboxes,
  onToggleSelection,
  onToggleFlag,
  formatMessageDate,
  removingEmailIds = new Set(),
  scrollToEmailId,
}: VirtualMessageListProps) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Auto-scroll to selected email on keyboard navigation
  useEffect(() => {
    if (scrollToEmailId && virtuosoRef.current && emailsWithMeta.length > 0) {
      const index = emailsWithMeta.findIndex(e => e.id === scrollToEmailId);
      if (index >= 0) {
        virtuosoRef.current.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
      }
    }
  }, [scrollToEmailId]);

  // Get the sent mailbox to determine if message is sent
  const sentBoxId = useMemo(() => {
    return mailboxes?.find((m: any) => m.role === 'sent' || (!m.role && ['sent', 'sent items', 'sent mail'].includes((m.name || '').toLowerCase())))?.id;
  }, [mailboxes]);

  // Prepare email data with memoization to prevent unnecessary re-renders
  const emailsWithMeta = useMemo(() => {
    return emails.map((email: any) => ({
      ...email,
      isSent: sentBoxId ? !!email.mailboxIds?.[sentBoxId] : false,
    }));
  }, [emails, sentBoxId]);

  // Handle item click with selection logic
  const handleItemClick = useCallback(
    (email: any, e: React.MouseEvent<HTMLDivElement>) => {
      const ctrlKey = e.ctrlKey || e.metaKey;
      const shiftKey = e.shiftKey;
      onToggleSelection(email.id, ctrlKey, shiftKey);
    },
    [onToggleSelection]
  );

  // Handle flag toggle with event propagation stop
  const handleToggleFlag = useCallback(
    (email: any, e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onToggleFlag(email.id, !!email.keywords?.['$flagged']);
    },
    [onToggleFlag]
  );

  if (isLoading && !isRefetching) {
    return (
      <div className="flex items-center justify-center py-20 opacity-30 flex-1">
        <div className="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#8E8E93] p-10 text-center opacity-40">
        <Inbox className="w-10 h-10 mb-3 stroke-1" />
        <p className="text-sm">No messages</p>
      </div>
    );
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={emailsWithMeta}
      className="flex-1 bg-[#F9F9F9] overflow-hidden"
       itemContent={(_, email) => (
         <div key={email.id} className="relative">
             <MessageListItem
              emailId={email.id}
              sender={email.from?.[0]?.name || email.from?.[0]?.email || 'Unknown'}
              subject={email.subject || '(No Subject)'}
              snippet={email.preview}
              searchSnippet={email.searchSnippet}
              date={formatMessageDate(email.receivedAt)}
             unread={!email.keywords || !email.keywords['$seen']}
             selected={selectedEmailId === email.id}
             isMultiSelected={selectedEmailIds.has(email.id)}
             selectedEmailIds={selectedEmailIds}
              threadCount={email.threadCount}
              flagged={!!email.keywords?.['$flagged']}
              hasAttachment={!!email.hasAttachment}
              isSent={email.isSent}
             onClick={(e) => handleItemClick(email, e)}
             onToggleFlag={(e) => handleToggleFlag(email, e)}
             isRemoving={removingEmailIds.has(email.id)}
           />
         </div>
       )}
      overscan={10}
      increaseViewportBy={{ top: 0, bottom: 300 }}
      defaultItemHeight={100}
      style={{ height: '100%' }}
      // Smooth scrolling options
      computeItemKey={(_, email) => email.id}
      // Disable virtuoso's automatic scroll behavior to maintain selection
      rangeChanged={() => {
        // Optional: track range changes for analytics or prefetching
      }}
    />
  );
};
