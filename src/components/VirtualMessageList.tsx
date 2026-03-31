import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import { SFReply, SFReplyAll, SFForward, SFFlag, SFArchive, SFTrash } from './SFIcon';
import { MessageListItem } from './MessageListItem';
import { SwipeableRow } from './SwipeableRow';
import { ContextMenu, ContextMenuItemConfig } from './ContextMenu';
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
  isMobile?: boolean;
  onSwipeArchive?: (emailId: string) => void;
  onSwipeDelete?: (emailId: string) => void;
  onReply?: (emailId: string) => void;
  onReplyAll?: (emailId: string) => void;
  onForward?: (emailId: string) => void;
  onArchive?: (emailId: string) => void;
  onDelete?: (emailId: string) => void;
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
  isMobile = false,
  onSwipeArchive,
  onSwipeDelete,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
}: VirtualMessageListProps) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; emailId: string } | null>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Build context menu items for the targeted email
  const contextMenuItems: ContextMenuItemConfig[] = useMemo(() => {
    if (!contextMenu) return [];
    const email = emails.find((e: any) => e.id === contextMenu.emailId);
    const isFlagged = !!email?.keywords?.['$flagged'];
    const iconClass = 'w-4 h-4';
    const iconStroke = 1.5;

    return [
      {
        id: 'reply',
        label: 'Reply',
        icon: <SFReply className={iconClass} strokeWidth={iconStroke} />,
        onSelect: () => onReply?.(contextMenu.emailId),
      },
      {
        id: 'reply-all',
        label: 'Reply All',
        icon: <SFReplyAll className={iconClass} strokeWidth={iconStroke} />,
        onSelect: () => onReplyAll?.(contextMenu.emailId),
      },
      {
        id: 'forward',
        label: 'Forward',
        icon: <SFForward className={iconClass} strokeWidth={iconStroke} />,
        onSelect: () => onForward?.(contextMenu.emailId),
      },
      {
        id: 'flag',
        label: isFlagged ? 'Unflag' : 'Flag',
        icon: <SFFlag className={`${iconClass} ${isFlagged ? 'text-[#FF9500]' : ''}`} strokeWidth={iconStroke} filled={isFlagged} />,
        onSelect: () => onToggleFlag(contextMenu.emailId, isFlagged),
        divider: true,
      },
      {
        id: 'archive',
        label: 'Archive',
        icon: <SFArchive className={iconClass} strokeWidth={iconStroke} />,
        onSelect: () => onArchive?.(contextMenu.emailId),
        divider: true,
      },
      {
        id: 'trash',
        label: 'Trash',
        icon: <SFTrash className={iconClass} strokeWidth={iconStroke} />,
        variant: 'destructive' as const,
        onSelect: () => onDelete?.(contextMenu.emailId),
      },
    ];
  }, [contextMenu, emails, onReply, onReplyAll, onForward, onToggleFlag, onArchive, onDelete]);

  // Handle context menu open from message item
  const handleContextMenu = useCallback(
    (emailId: string, e: React.MouseEvent<HTMLDivElement> | { clientX: number; clientY: number; preventDefault: () => void }) => {
      e.preventDefault();
      // Auto-select the email that was right-clicked / long-pressed
      onToggleSelection(emailId, false, false);
      setContextMenu({ x: e.clientX, y: e.clientY, emailId });
    },
    [onToggleSelection]
  );

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
    <>
    <Virtuoso
      ref={virtuosoRef}
      data={emailsWithMeta}
      className="flex-1 bg-[#F9F9F9] overflow-hidden"
      role="listbox"
      aria-label="Email list"
      aria-setsize={emailsWithMeta.length}
       itemContent={(index, email) => (
         <div 
           key={email.id} 
           role="option"
           aria-selected={selectedEmailId === email.id || selectedEmailIds.has(email.id)}
           aria-setsize={emailsWithMeta.length}
           aria-posinset={index + 1}
           className="relative"
         >
           <SwipeableRow
             enabled={isMobile}
             onSwipeRight={onSwipeArchive ? () => onSwipeArchive(email.id) : undefined}
             onSwipeLeft={onSwipeDelete ? () => onSwipeDelete(email.id) : undefined}
           >
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
             onContextMenu={(e) => handleContextMenu(email.id, e)}
              isRemoving={removingEmailIds.has(email.id)}
            />
           </SwipeableRow>
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

    {/* Context menu for right-click / long-press on message items */}
    {contextMenu && (
      <ContextMenu
        items={contextMenuItems}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={closeContextMenu}
      />
    )}
    </>
  );
};
