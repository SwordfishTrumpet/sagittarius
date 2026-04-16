import { useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { Square, Send, Star, Paperclip } from 'lucide-react';
import { useDrag } from 'react-dnd';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';

interface MessageListItemProps {
  sender: string;
  subject: string;
  snippet: string;
  searchSnippet?: string;
  date: string;
  unread?: boolean;
  selected?: boolean;
  isMultiSelected?: boolean;
  threadCount?: number;
  flagged?: boolean;
  hasAttachment?: boolean;
  emailId: string;
  isSent?: boolean;
  selectedEmailIds?: Set<string>;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: () => void;
  onToggleFlag: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement> | { clientX: number; clientY: number; preventDefault: () => void }) => void;
  isRemoving?: boolean;
}

function MessageListItemComponent({
  sender,
  subject,
  snippet,
  searchSnippet,
  date,
  unread = false,
  selected = false,
  isMultiSelected = false,
  threadCount,
  flagged = false,
  hasAttachment = false,
  emailId,
  isSent = false,
  selectedEmailIds,
  onClick,
  onDoubleClick,
  onToggleFlag,
  onContextMenu,
  isRemoving = false,
}: MessageListItemProps) {
  // Long-press detection for touch devices
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const longPressTimestamp = useRef(0);
  const touchStartPos = useRef({ x: 0, y: 0 });

  // Cleanup long-press timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Reset flags at the start of each touch
    longPressTriggered.current = false;
    longPressTimestamp.current = 0;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      longPressTimestamp.current = Date.now();
      // Trigger haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(10);
      onContextMenu?.({
        clientX: touchStartPos.current.x,
        clientY: touchStartPos.current.y,
        preventDefault: () => {},
      });
    }, 500);
  }, [onContextMenu]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!longPressTimer.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    // Cancel long-press if finger moves more than 10px
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Check if this is a simulated mouse event from a touch (indicated by zero clientX/clientY in some browsers)
    // or if it's within the suppression window after a long-press
    const timeSinceLongPress = Date.now() - longPressTimestamp.current;
    
    // Suppress click if long-press was triggered (within last 500ms)
    if (longPressTriggered.current || timeSinceLongPress < 500) {
      longPressTriggered.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    onClick(e);
  }, [onClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e);
    }
  }, [onContextMenu]);

  // Sanitize searchSnippet to prevent XSS - only allow <mark> tags for highlighting
  const sanitizedSearchSnippet = useMemo(() => {
    if (!searchSnippet) return null;
    return DOMPurify.sanitize(searchSnippet, { ALLOWED_TAGS: ['mark'] });
  }, [searchSnippet]);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'EMAIL',
    item: () => {
      // If this email is part of a multi-selection, drag all selected emails
      if (selectedEmailIds && selectedEmailIds.size > 1 && selectedEmailIds.has(emailId)) {
        return { id: emailId, ids: Array.from(selectedEmailIds) };
      }
      return { id: emailId, ids: [emailId] };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [emailId, selectedEmailIds]);

  return (
    <motion.div
      ref={drag}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      initial={{ opacity: 1, x: 0 }}
      animate={isRemoving ? { opacity: 0, x: 100 } : { opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      tabIndex={0}
      aria-label={`${sender}, ${subject}, ${date}${unread ? ', unread' : ''}${flagged ? ', flagged' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(e as unknown as React.MouseEvent<HTMLDivElement>)
        }
      }}
      className={`px-5 py-3.5 border-b border-[#E5E5E5] transition-all relative cursor-default group focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 focus:ring-inset ${
        selected ? 'bg-[#007AFF]/10 z-10 shadow-[inset_0_0_0_0.5px_rgba(0,122,255,0.15)]' :
        isMultiSelected ? 'bg-[#007AFF]/5 z-10' :
        isDragging ? 'opacity-40 bg-gray-100' : 'bg-white hover:bg-[#F9F9F9]'
      }`}
    >
      {unread && (
        <div aria-label="Unread" className="absolute left-1.5 top-5 w-2.5 h-2.5 bg-[#007AFF] rounded-full border-2 border-white shadow-sm ring-1 ring-[#007AFF]/10"></div>
      )}
      <div className="flex justify-between items-baseline mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {isMultiSelected && (
            <Square className="w-4 h-4 fill-[#007AFF] text-[#007AFF] flex-shrink-0" strokeWidth={2} />
          )}
          {isSent && <Send className="w-3 h-3 text-[#6C6C70] shrink-0" strokeWidth={2} />}
          <span className={`text-[15px] truncate ${unread ? 'font-bold text-[#1C1C1E]' : 'font-semibold text-[#1C1C1E]'}`}>{sender}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasAttachment && (
            <Paperclip className="w-3.5 h-3.5 text-[#6C6C70] shrink-0" strokeWidth={1.75} />
          )}
          {threadCount && threadCount > 1 && (
            <span className="text-[11px] font-bold bg-[#8E8E93]/20 text-[#636366] px-1.5 py-0.5 rounded-md min-w-[18px] text-center">
              {threadCount}
            </span>
          )}
          <span className={`text-[12px] shrink-0 font-medium ${unread ? 'text-[#007AFF]' : 'text-[#6C6C70]'}`}>{date}</span>
        </div>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] mb-1 truncate leading-tight ${unread ? 'font-bold text-[#1C1C1E]' : 'font-semibold text-[#1C1C1E] opacity-90'}`}>{subject}</div>
          {sanitizedSearchSnippet ? (
            <div 
              className={`text-[13px] line-clamp-2 leading-snug tracking-tight ${selected || isMultiSelected ? 'text-[#3A3A3C]' : 'text-[#6C6C70]'} [&_mark]:bg-[#FFD60A]/40 [&_mark]:text-[#1C1C1E] [&_mark]:rounded-sm [&_mark]:px-0.5`}
              dangerouslySetInnerHTML={{ __html: sanitizedSearchSnippet }}
            />
          ) : (
            <div className={`text-[13px] line-clamp-2 leading-snug tracking-tight ${selected || isMultiSelected ? 'text-[#3A3A3C]' : 'text-[#6C6C70]'}`}>{snippet}</div>
          )}
        </div>
        <button
          onClick={onToggleFlag}
          aria-label={flagged ? 'Remove flag' : 'Add flag'}
          aria-pressed={flagged}
          className={`shrink-0 mt-1 transition-all focus:outline-none focus:ring-2 focus:ring-[#FF9500]/50 rounded ${flagged ? 'text-[#FF9500] opacity-100' : 'text-[#6C6C70] opacity-40 hover:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-40'}`}
        >
           <Star className={`w-3.5 h-3.5 ${flagged ? 'fill-current' : ''}`} strokeWidth={2} />
         </button>
       </div>
     </motion.div>
   );
 }

 export const MessageListItem = memo(MessageListItemComponent);
