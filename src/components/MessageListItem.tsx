import { Square, Send, Star, Paperclip } from 'lucide-react';
import { useDrag } from 'react-dnd';
import { motion } from 'framer-motion';

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
  onToggleFlag: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isRemoving?: boolean;
}

export function MessageListItem({
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
  onToggleFlag,
  isRemoving = false,
}: MessageListItemProps) {
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
      onClick={onClick}
      initial={{ opacity: 1, x: 0 }}
      animate={isRemoving ? { opacity: 0, x: 100 } : { opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`px-5 py-3.5 border-b border-[#E5E5E5] transition-all relative cursor-default group ${
        selected ? 'bg-[#007AFF]/10 z-10 shadow-[inset_0_0_0_0.5px_rgba(0,122,255,0.15)]' :
        isMultiSelected ? 'bg-[#007AFF]/5 z-10' :
        isDragging ? 'opacity-40 bg-gray-100' : 'bg-white hover:bg-[#F9F9F9]'
      }`}
    >
      {unread && (
        <div className="absolute left-1.5 top-5 w-2.5 h-2.5 bg-[#007AFF] rounded-full border-2 border-white shadow-sm ring-1 ring-[#007AFF]/10"></div>
      )}
      <div className="flex justify-between items-baseline mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {isMultiSelected && (
            <Square className="w-4 h-4 fill-[#007AFF] text-[#007AFF] flex-shrink-0" strokeWidth={2} />
          )}
          {isSent && <Send className="w-3 h-3 text-[#8E8E93] shrink-0" strokeWidth={2} />}
          <span className={`text-[15px] truncate ${unread ? 'font-bold text-[#1C1C1E]' : 'font-semibold text-[#1C1C1E]'}`}>{sender}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasAttachment && (
            <Paperclip className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" strokeWidth={1.75} />
          )}
          {threadCount && threadCount > 1 && (
            <span className="text-[11px] font-bold bg-[#8E8E93]/20 text-[#8E8E93] px-1.5 py-0.5 rounded-md min-w-[18px] text-center">
              {threadCount}
            </span>
          )}
          <span className={`text-[12px] shrink-0 font-medium ${unread ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>{date}</span>
        </div>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] mb-1 truncate leading-tight ${unread ? 'font-bold text-[#1C1C1E]' : 'font-semibold text-[#1C1C1E] opacity-90'}`}>{subject}</div>
          {searchSnippet ? (
            <div 
              className={`text-[13px] line-clamp-2 leading-snug tracking-tight ${selected || isMultiSelected ? 'text-[#3A3A3C]' : 'text-[#8E8E93]'} [&_mark]:bg-[#FFD60A]/40 [&_mark]:text-[#1C1C1E] [&_mark]:rounded-sm [&_mark]:px-0.5`}
              dangerouslySetInnerHTML={{ __html: searchSnippet }}
            />
          ) : (
            <div className={`text-[13px] line-clamp-2 leading-snug tracking-tight ${selected || isMultiSelected ? 'text-[#3A3A3C]' : 'text-[#8E8E93]'}`}>{snippet}</div>
          )}
        </div>
        <button
          onClick={onToggleFlag}
          className={`shrink-0 mt-1 transition-all ${flagged ? 'text-[#FF9500] opacity-100' : 'text-[#8E8E93] opacity-0 group-hover:opacity-40 hover:opacity-100'}`}
        >
          <Star className={`w-3.5 h-3.5 ${flagged ? 'fill-current' : ''}`} strokeWidth={2} />
        </button>
      </div>
    </motion.div>
  );
}
