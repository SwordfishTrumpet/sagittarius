import { useState, useCallback, useRef, useMemo } from 'react';
import { X, Maximize2, Minimize2, Trash2, Send, Paperclip, Bold, Italic, Underline, List, ListOrdered, Link, ChevronDown, Clock } from 'lucide-react';
import { useCompose, useIdentities } from '../hooks/useJMAP';
import { toast } from 'sonner';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import UnderlineExtension from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import { jmapClient } from '../api/jmap';
import { ScheduleSendPicker } from './ScheduleSendPicker';
import { motion } from 'framer-motion';
import { buildReplyQuote, buildForwardQuote } from '../utils/quoteBuilder';

interface Recipient {
  name?: string;
  email: string;
}

interface ComposerProps {
  onClose: () => void;
  replyTo?: any;
  isMobile?: boolean;
}

export function Composer({ onClose, replyTo, isMobile = false }: ComposerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [to, setTo] = useState<string>(() => {
    if (!replyTo) return '';
    if (replyTo._forward) return ''; // Forward: empty To
    if (replyTo._replyAll) {
      // Combine from + to + cc, excluding duplicates
      const all = [
        ...(replyTo.from || []),
        ...(replyTo.to || []),
        ...(replyTo.cc || []),
      ].map((r: any) => r.email).filter(Boolean);
      return [...new Set(all)].join(', ');
    }
    return replyTo.from?.[0]?.email || '';
  });
  const [cc, setCc] = useState<string>('');
  const [bcc, setBcc] = useState<string>('');
  const [subject, setSubject] = useState<string>(() => {
    if (!replyTo) return '';
    if (replyTo._forward) return `Fwd: ${replyTo.subject || ''}`;
    return `Re: ${replyTo.subject || ''}`;
  });
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: identities } = useIdentities();
  const [selectedIdentityId, setSelectedIdentityId] = useState<string | null>(null);
  const selectedIdentity = identities?.find((i: any) => i.id === selectedIdentityId) || identities?.[0];
  const composeMutation = useCompose();
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [sendAt, setSendAt] = useState<string | null>(null);
  const [isQuoteCollapsed, setIsQuoteCollapsed] = useState(false);

  // Build initial content for the editor from reply/forward
  const initialContent = useMemo(() => {
    if (!replyTo) return '';
    if (replyTo._forward) return buildForwardQuote(replyTo);
    return buildReplyQuote(replyTo);
  }, [replyTo]);

  // Get max delayed send from capabilities
  const maxDelayedSend = (() => {
    try {
      const cap = jmapClient.getAccountCapability?.('urn:ietf:params:jmap:submission');
      return (cap as any)?.maxDelayedSend ?? 0;
    } catch { return 0; }
  })();

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      LinkExtension.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Sent from Sagittarius',
      }),
    ],
    content: initialContent,
    onCreate: ({ editor }) => {
      if (initialContent) {
        // Position cursor at start (above quoted text) for replies
        setTimeout(() => editor.commands.focus('start'), 50);
      }
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[150px] text-[15px] leading-relaxed font-sans prose prose-sm max-w-none',
      },
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await jmapClient.uploadBlob(file);
        setAttachments(prev => [...prev, {
          blobId: res.blobId,
          name: file.name,
          type: file.type,
          size: file.size
        }]);
      }
      toast.success('Files attached');
    } catch (err) {
      toast.error('Failed to upload attachment');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (blobId: string) => {
    setAttachments(prev => prev.filter(a => a.blobId !== blobId));
  };

  const handleSend = (scheduledDate?: Date) => {
    if (!to || !subject || !editor || !selectedIdentity) return;

    const parseRecipients = (str: string): Recipient[] => {
      return str.split(',').map(s => s.trim()).filter(s => s.includes('@')).map(s => ({ email: s }));
    };

    const htmlContent = (() => {
      // Ensure quoted content is visible before extracting HTML
      const quotedEl = document.querySelector('.ProseMirror #quoted-content') as HTMLElement;
      if (quotedEl) quotedEl.style.display = '';
      return editor.getHTML();
    })();
    const scheduleAt = scheduledDate ? scheduledDate.toISOString() : (sendAt || undefined);

    composeMutation.mutate({
      to: parseRecipients(to),
      cc: cc ? parseRecipients(cc) : undefined,
      bcc: bcc ? parseRecipients(bcc) : undefined,
      subject,
      body: htmlContent, 
      attachments: attachments.length > 0 ? attachments : undefined,
      identityId: selectedIdentity?.id || '',
      fromEmail: selectedIdentity?.email || '',
      ...(scheduleAt ? { sendAt: scheduleAt } : {}),
    }, {
      onSuccess: () => {
        toast.success(scheduleAt ? 'Message scheduled' : 'Message sent');
        onClose();
      },
      onError: (err: any) => {
        toast.error(`Failed to send: ${err.message}`);
      }
    });
  };

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  // Minimized state: polished bottom bar
  if (isMinimized) {
    return (
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed bottom-0 right-6 w-[280px] bg-white border border-[#E5E5EA] rounded-t-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex items-center justify-between px-4 py-2.5 cursor-pointer z-[200]"
        onClick={() => setIsMinimized(false)}
      >
        <span className="font-semibold text-[13px] text-[#1C1C1E] truncate">{subject || 'New Message'}</span>
        <div className="flex gap-2 items-center">
          <button className="p-0.5 hover:bg-black/5 rounded text-[#8E8E93] transition-colors">
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-0.5 hover:bg-black/5 rounded text-[#8E8E93] transition-colors">
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="composer-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 5 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className={`bg-white flex flex-col overflow-hidden ${
          isMobile 
            ? 'w-full h-full rounded-none' 
            : 'rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.08)] border border-[#E5E5EA] w-[640px] max-w-[calc(100vw-48px)] h-[70vh] max-h-[720px] min-h-[480px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-4 py-3 border-b border-[#E5E5EA] flex items-center gap-2 bg-white rounded-t-xl shrink-0">
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close composer"
            className="w-7 h-7 rounded-full bg-[#E5E5EA] hover:bg-[#D1D1D6] flex items-center justify-center transition-colors"
          >
            <X size={12} strokeWidth={2.5} className="text-[#636366]" />
          </button>

          {/* Title */}
          <h2 id="composer-title" className="flex-1 text-center text-[15px] font-semibold text-[#1C1C1E] truncate">
            {subject || 'New Message'}
          </h2>

          {/* Right side: minimize + send */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 hover:bg-black/5 rounded-md text-[#8E8E93] transition-colors"
            >
              <Minimize2 className="w-4 h-4" strokeWidth={1.5} />
            </button>

            <button 
              onClick={() => handleSend()}
              disabled={composeMutation.isPending || !to || !selectedIdentity}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#007AFF] text-white rounded-full font-semibold text-[13px] hover:bg-[#0062CC] transition-colors disabled:opacity-40"
            >
              {composeMutation.isPending ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending
                </span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>{sendAt ? 'Scheduled' : 'Send'}</span>
                </>
              )}
            </button>

            {maxDelayedSend > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                  disabled={composeMutation.isPending || !to || !selectedIdentity}
                  className="p-1.5 bg-[#007AFF] text-white rounded-full hover:bg-[#0062CC] transition-colors disabled:opacity-40"
                >
                  <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
                {showSchedulePicker && (
                  <div className="absolute right-0 top-full mt-2 z-50">
                    <ScheduleSendPicker
                      maxDelaySeconds={maxDelayedSend}
                      onSchedule={(date) => {
                        setShowSchedulePicker(false);
                        handleSend(date);
                      }}
                      onCancel={() => setShowSchedulePicker(false)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div role="form" aria-label="Compose email" className="flex-1 flex flex-col overflow-hidden">
          {/* From identity selector */}
          {identities && identities.length > 1 && (
            <div className="px-5 py-2 border-b border-[#E5E5EA] flex items-center gap-2 shrink-0">
              <label htmlFor="composer-from" className="text-[#8E8E93] w-14 font-medium text-[13px]">From:</label>
              <select
                id="composer-from"
                value={selectedIdentity?.id || ''}
                onChange={(e) => setSelectedIdentityId(e.target.value)}
                className="flex-1 border-none focus:ring-0 focus:outline-none text-[14px] py-1 bg-transparent cursor-pointer appearance-none"
              >
                {identities.map((identity: any) => (
                  <option key={identity.id} value={identity.id}>
                    {identity.name ? `${identity.name} <${identity.email}>` : identity.email}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-[#8E8E93] pointer-events-none" />
            </div>
          )}

          {/* To field */}
          <div className="px-5 py-2 border-b border-[#E5E5EA] flex items-center gap-2 shrink-0">
            <label htmlFor="composer-to" className="text-[#8E8E93] w-14 font-medium text-[13px]">
              <span aria-hidden="true">To:</span>
              <span className="sr-only">Recipients (required)</span>
            </label>
            <input 
              id="composer-to"
              value={to} 
              onChange={e => setTo(e.target.value)} 
              className="flex-1 border-none focus:ring-0 focus:outline-none text-[14px] py-1 bg-transparent" 
              placeholder="Recipients"
              aria-required="true"
              autoFocus 
            />
            {!showCcBcc && (
              <button 
                onClick={() => setShowCcBcc(true)}
                aria-expanded="false"
                aria-controls="cc-bcc-fields"
                className="text-[#007AFF] text-[12px] font-semibold hover:underline transition-opacity"
              >
                Cc/Bcc
              </button>
            )}
          </div>

          {/* Cc/Bcc fields */}
          <div id="cc-bcc-fields" role="group" aria-label="Cc and Bcc recipients">
            {showCcBcc && (
              <>
                <div className="px-5 py-2 border-b border-[#E5E5EA] flex items-center gap-2 animate-in fade-in duration-200 shrink-0">
                  <label htmlFor="composer-cc" className="text-[#8E8E93] w-14 font-medium text-[13px]">Cc:</label>
                  <input 
                    id="composer-cc"
                    value={cc} 
                    onChange={e => setCc(e.target.value)} 
                    className="flex-1 border-none focus:ring-0 focus:outline-none text-[14px] py-1 bg-transparent" 
                  />
                </div>
                <div className="px-5 py-2 border-b border-[#E5E5EA] flex items-center gap-2 animate-in fade-in duration-200 shrink-0">
                  <label htmlFor="composer-bcc" className="text-[#8E8E93] w-14 font-medium text-[13px]">Bcc:</label>
                  <input 
                    id="composer-bcc"
                    value={bcc} 
                    onChange={e => setBcc(e.target.value)} 
                    className="flex-1 border-none focus:ring-0 focus:outline-none text-[14px] py-1 bg-transparent" 
                  />
                </div>
              </>
            )}
          </div>

          {/* Subject field */}
          <div className="px-5 py-2 border-b border-[#E5E5EA] flex items-center gap-2 shrink-0">
            <label htmlFor="composer-subject" className="text-[#8E8E93] w-14 font-medium text-[13px]">Subject:</label>
            <input 
              id="composer-subject"
              value={subject} 
              onChange={e => setSubject(e.target.value)} 
              className="flex-1 border-none focus:ring-0 focus:outline-none text-[14px] py-1 font-semibold bg-transparent" 
              aria-required="true"
            />
          </div>

          {/* Formatting toolbar — always visible */}
          {editor && (
            <div role="toolbar" aria-label="Text formatting" className="px-5 py-1.5 border-b border-[#E5E5EA] flex items-center gap-1 shrink-0 bg-[#FAFAFA]">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                aria-hidden="true"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                aria-label="Attach file"
                className="p-1.5 hover:bg-black/5 rounded text-[#8E8E93] cursor-pointer transition-colors disabled:opacity-50"
              >
                <Paperclip className={`w-3.5 h-3.5 ${isUploading ? 'animate-pulse' : ''}`} strokeWidth={1.5} />
              </button>
              <div aria-hidden="true" className="w-[1px] h-4 bg-[#E5E5EA] mx-1" />
              <ToolbarButton 
                onClick={() => editor.chain().focus().toggleBold().run()} 
                active={editor.isActive('bold')}
                icon={<Bold className="w-3.5 h-3.5" />} 
                label="Bold"
              />
              <ToolbarButton 
                onClick={() => editor.chain().focus().toggleItalic().run()} 
                active={editor.isActive('italic')}
                icon={<Italic className="w-3.5 h-3.5" />} 
                label="Italic"
              />
              <ToolbarButton 
                onClick={() => editor.chain().focus().toggleUnderline().run()} 
                active={editor.isActive('underline')}
                icon={<Underline className="w-3.5 h-3.5" />} 
                label="Underline"
              />
              <div aria-hidden="true" className="w-[1px] h-4 bg-[#E5E5EA] mx-1" />
              <ToolbarButton 
                onClick={() => editor.chain().focus().toggleBulletList().run()} 
                active={editor.isActive('bulletList')}
                icon={<List className="w-3.5 h-3.5" />} 
                label="Bullet list"
              />
              <ToolbarButton 
                onClick={() => editor.chain().focus().toggleOrderedList().run()} 
                active={editor.isActive('orderedList')}
                icon={<ListOrdered className="w-3.5 h-3.5" />} 
                label="Numbered list"
              />
              <div aria-hidden="true" className="w-[1px] h-4 bg-[#E5E5EA] mx-1" />
              <ToolbarButton 
                onClick={setLink} 
                active={editor.isActive('link')}
                icon={<Link className="w-3.5 h-3.5" />} 
                label="Insert link"
              />
            </div>
          )}

          {/* Attachments area */}
          {attachments.length > 0 && (
            <div className="px-5 py-2.5 border-b border-[#E5E5EA] flex flex-wrap gap-2 max-h-28 overflow-y-auto">
              {attachments.map(a => (
                <div key={a.blobId} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#007AFF]/[0.08] border border-[#007AFF]/[0.15] rounded-full text-[12px] font-medium text-[#007AFF] animate-in zoom-in-95 duration-200">
                  <Paperclip className="w-3 h-3" strokeWidth={1.5} />
                  <span className="max-w-[120px] truncate">{a.name}</span>
                  <span className="text-[#007AFF]/60 text-[11px]">{(a.size / 1024).toFixed(0)}K</span>
                  <button onClick={() => removeAttachment(a.blobId)} className="p-0.5 hover:bg-[#007AFF]/[0.15] rounded-full transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Editor body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <EditorContent editor={editor} />
          </div>

          {/* Quoted text toggle */}
          {replyTo && initialContent && (
            <div className="px-5 border-t border-[#E5E5EA] shrink-0">
              <button
                onClick={() => {
                  const next = !isQuoteCollapsed;
                  setIsQuoteCollapsed(next);
                  const el = document.querySelector('.ProseMirror #quoted-content') as HTMLElement;
                  if (el) el.style.display = next ? 'none' : '';
                }}
                className="py-1.5 text-[12px] text-[#007AFF] font-medium hover:underline transition-colors flex items-center gap-1"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${isQuoteCollapsed ? '' : 'rotate-180'}`} strokeWidth={2} />
                <span>{isQuoteCollapsed ? 'Show' : 'Hide'} Quoted Text</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-2.5 border-t border-[#E5E5EA] flex items-center justify-between bg-white shrink-0">
          <button onClick={onClose} className="p-1.5 hover:bg-[#FF3B30]/10 rounded-lg text-[#8E8E93] hover:text-[#FF3B30] transition-colors" title="Discard draft">
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <span className="text-[11px] text-[#C7C7CC] font-medium">
            Draft
          </span>
          <div className="w-7" />
        </footer>
      </motion.div>
    </motion.div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}

function ToolbarButton({ onClick, active, icon, label }: ToolbarButtonProps) {
  return (
    <button 
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`p-1.5 rounded transition-colors ${active ? 'text-[#007AFF] bg-[#007AFF]/10' : 'hover:bg-black/5 text-[#8E8E93]'}`}
    >
      {icon}
    </button>
  );
}
