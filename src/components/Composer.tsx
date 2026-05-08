import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { X, Maximize2, Minimize2, Trash2, Send, Paperclip, Bold, Italic, Underline, List, ListOrdered, Link, ChevronDown, Clock, FileText } from 'lucide-react';
import { useCompose } from '../hooks/jmap/useCompose';
import { useIdentities } from '../hooks/jmap/useIdentities';
import { toast } from 'sonner';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import UnderlineExtension from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import { jmapClient } from '../api/jmap';
import { ScheduleSendPicker } from './ScheduleSendPicker';
import { EmailTemplatesDialog } from './dialogs/EmailTemplatesDialog';
import { motion } from 'framer-motion';
import { buildReplyQuote, buildForwardQuote, getEmailBodyHtml } from '../utils/quoteBuilder';
import { upsertIdentitySignature } from '../utils/signatureBuilder';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { clearComposerDraft, getComposerDraftKey, loadComposerDraft, saveComposerDraft, type ComposerDraft } from '../utils/draftStorage';
import { isDeferredMutationResult } from '../utils/offlineSyncQueue';
import { useSaveDraft } from '../hooks/jmap/useSaveDraft';
import { useAttachmentLimits } from '../hooks/useCapabilityLimits';
import { toastOperationError } from '../utils/toastHelpers';
import type { Email, Identity, EmailAddress, Attachment, EmailTemplate } from '../types/jmap';
import type { ReplyContext } from '../hooks/useComposerState';

/** Local recipient format used in composer */
interface Recipient {
  name?: string;
  email: string;
}

interface ComposerProps {
  onClose: () => void;
  replyTo?: ReplyContext;
  draftEmail?: Email;
  isMobile?: boolean;
}

export function Composer({ onClose, replyTo, draftEmail, isMobile = false }: ComposerProps) {
  const accountId = jmapClient.getPrimaryAccount?.() ?? null;
  const draftContext = draftEmail ? { id: draftEmail.id, _draft: true } : replyTo;
  const draftKey = useMemo(
    () => getComposerDraftKey(accountId, draftContext),
    [accountId, draftContext],
  );
  const restoredDraft = useMemo(() => loadComposerDraft(draftKey), [draftKey]);
  const [isMinimized, setIsMinimized] = useState(false);
  const initialDraftBody = useMemo(() => draftEmail ? getEmailBodyHtml(draftEmail) : '', [draftEmail]);
  const formatRecipients = useCallback((recipients?: Recipient[] | EmailAddress[] | null) => recipients?.map((recipient) => recipient.email).filter(Boolean).join(', ') || '', []);
  const [to, setTo] = useState<string>(() => {
    if (draftEmail) return formatRecipients(draftEmail.to);
    if (restoredDraft) return restoredDraft.to;
    if (!replyTo) return '';
    if (replyTo._forward) return ''; // Forward: empty To
    if (replyTo._replyAll) {
      // Combine from + to + cc, excluding duplicates
      const all = [
        ...(replyTo.from || []),
        ...(replyTo.to || []),
        ...(replyTo.cc || []),
      ].map((r) => r.email).filter(Boolean);
      return [...new Set(all)].join(', ');
    }
    return replyTo.from?.[0]?.email || '';
  });
  const [cc, setCc] = useState<string>(() => draftEmail ? formatRecipients(draftEmail.cc) : (restoredDraft ? restoredDraft.cc : ''));
  const [bcc, setBcc] = useState<string>(() => draftEmail ? formatRecipients(draftEmail.bcc) : (restoredDraft ? restoredDraft.bcc : ''));
  const [subject, setSubject] = useState<string>(() => {
    if (draftEmail) return draftEmail.subject || '';
    if (restoredDraft) return restoredDraft.subject;
    if (!replyTo) return '';
    if (replyTo._forward) return `Fwd: ${replyTo.subject || ''}`;
    return `Re: ${replyTo.subject || ''}`;
  });
  const [showCcBcc, setShowCcBcc] = useState<boolean>(() => draftEmail ? Boolean(draftEmail.cc?.length || draftEmail.bcc?.length) : (restoredDraft ? (restoredDraft.showCcBcc || Boolean(restoredDraft.cc || restoredDraft.bcc)) : false));
  const [attachments, setAttachments] = useState<Attachment[]>(() => draftEmail ? (draftEmail.attachments as Attachment[] || []) : (restoredDraft ? restoredDraft.attachments : []));
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get JMAP server max upload size for display (default 50MB per RFC 8620)
  const maxUploadSizeMB = useMemo(() => {
    const coreCapabilities = jmapClient.getCapabilityConfig('urn:ietf:params:jmap:core') as { maxSizeUpload?: number } | null;
    const maxBytes = coreCapabilities?.maxSizeUpload ?? 50_000_000;
    return Math.floor(maxBytes / 1024 / 1024);
  }, []);

  // Use capability-aware attachment limits (checks maxSizeAttachmentsPerEmail)
  const { maxTotalSizeMB: maxAttachmentsSizeMB, validateAttachments, canAddAttachment } = useAttachmentLimits();

  const { data: identities } = useIdentities();
  const [selectedIdentityId, setSelectedIdentityId] = useState<string | null>(() => restoredDraft ? restoredDraft.selectedIdentityId : null);
  const selectedIdentity = identities?.find((i) => i.id === selectedIdentityId) || identities?.[0];
  const composeMutation = useCompose();
  const saveDraftMutation = useSaveDraft();
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [sendAt, setSendAt] = useState<string | null>(() => restoredDraft ? restoredDraft.sendAt : null);
  const [isQuoteCollapsed, setIsQuoteCollapsed] = useState<boolean>(() => restoredDraft ? restoredDraft.isQuoteCollapsed : false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const shouldPersistDraftRef = useRef(true);
  const latestDraftRef = useRef<ComposerDraft | null>(null);
  const saveDraftTimeoutRef = useRef<number | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusTrap(dialogRef, { isActive: !isMinimized });

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
      if (saveDraftTimeoutRef.current !== null) {
        window.clearTimeout(saveDraftTimeoutRef.current);
      }
    };
  }, []);

  /** Convert ReplyContext to EmailForQuote for quote building */
  const toEmailForQuote = useCallback((ctx: ReplyContext | undefined): Parameters<typeof buildReplyQuote>[0] | null => {
    if (!ctx) return null;
    return {
      from: ctx.from,
      to: ctx.to,
      cc: ctx.cc,
      subject: ctx.subject,
      receivedAt: ctx.receivedAt,
      htmlBody: ctx.bodyParts?.htmlBody,
      textBody: ctx.bodyParts?.textBody,
      bodyValues: ctx.bodyParts?.bodyValues,
    };
  }, []);

  // Build initial content for the editor from reply/forward
  const initialReplyContent = useMemo(() => {
    if (!replyTo) return '';
    const emailForQuote = toEmailForQuote(replyTo);
    if (!emailForQuote) return '';
    if (replyTo._forward) return buildForwardQuote(emailForQuote);
    return buildReplyQuote(emailForQuote);
  }, [replyTo, toEmailForQuote]);

  const initialContent = useMemo(() => {
    if (draftEmail) return initialDraftBody;
    if (restoredDraft) return restoredDraft.body;
    return upsertIdentitySignature(initialReplyContent, selectedIdentity);
  }, [draftEmail, initialDraftBody, initialReplyContent, restoredDraft, selectedIdentity]);

  const [bodyHtml, setBodyHtml] = useState<string>(() => draftEmail ? initialDraftBody : (restoredDraft ? restoredDraft.body : initialContent));

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
    onUpdate: ({ editor }) => {
      setBodyHtml(editor.getHTML());
    },
    onCreate: ({ editor }) => {
      setBodyHtml(editor.getHTML());
      if (initialReplyContent) {
        // Position cursor at start (above quoted text) for replies
        focusTimeoutRef.current = setTimeout(() => editor.commands.focus('start'), 50);
      }
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[150px] text-[15px] leading-relaxed font-sans prose prose-sm max-w-none',
      },
    },
  });

  useEffect(() => {
    if (!selectedIdentityId && identities && identities.length > 0) {
      const draftFromEmail = draftEmail?.from?.[0]?.email;
      if (draftFromEmail) {
        const matchingIdentity = identities.find((identity: any) => identity.email === draftFromEmail);
        if (matchingIdentity) {
          setSelectedIdentityId(matchingIdentity.id)
          return
        }
      }
      setSelectedIdentityId(identities[0].id)
    }
  }, [draftEmail, identities, selectedIdentityId])

  const hasHydratedInitialSignatureRef = useRef(false)

  useEffect(() => {
    if (!editor || !selectedIdentity) return

    if (!hasHydratedInitialSignatureRef.current) {
      hasHydratedInitialSignatureRef.current = true
      if (restoredDraft || draftEmail) {
        return
      }
    }

    const currentHtml = editor.getHTML()
    const nextHtml = upsertIdentitySignature(currentHtml, selectedIdentity)
    if (nextHtml === currentHtml) return

    setBodyHtml(nextHtml)

    if (typeof editor.commands.setContent === 'function') {
      editor.commands.setContent(nextHtml, false)
      return
    }

    const testEditor = editor as unknown as { __setHTML?: (value: string) => void }
    if (typeof testEditor.__setHTML === 'function') {
      testEditor.__setHTML(nextHtml)
    }
  }, [draftEmail, editor, restoredDraft, selectedIdentity])

  useEffect(() => {
    if (!draftKey || !shouldPersistDraftRef.current) return;

    const draft: ComposerDraft = {
      to,
      cc,
      bcc,
      subject,
      body: bodyHtml,
      attachments,
      selectedIdentityId,
      showCcBcc,
      sendAt,
      isQuoteCollapsed,
    };

    latestDraftRef.current = draft;
    if (saveDraftTimeoutRef.current !== null) {
      window.clearTimeout(saveDraftTimeoutRef.current);
    }
    saveDraftTimeoutRef.current = window.setTimeout(() => {
      if (!shouldPersistDraftRef.current) return;
      const latest = latestDraftRef.current;
      if (!latest) return;
      saveComposerDraft(draftKey, latest);
    }, 700);

    return () => {
      if (saveDraftTimeoutRef.current !== null) {
        window.clearTimeout(saveDraftTimeoutRef.current);
        saveDraftTimeoutRef.current = null;
      }
    };
  }, [draftKey, to, cc, bcc, subject, bodyHtml, attachments, selectedIdentityId, showCcBcc, sendAt, isQuoteCollapsed]);

  useEffect(() => {
    return () => {
      // Clear any pending debounced save to prevent race condition
      if (saveDraftTimeoutRef.current !== null) {
        window.clearTimeout(saveDraftTimeoutRef.current);
        saveDraftTimeoutRef.current = null;
      }
      // Then perform the final save
      if (!draftKey || !shouldPersistDraftRef.current || !latestDraftRef.current) return;
      saveComposerDraft(draftKey, latestDraftRef.current);
    };
  }, [draftKey]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Get JMAP server upload limit from capabilities (default 50MB per RFC 8620)
    const coreCapabilities = jmapClient.getCapabilityConfig('urn:ietf:params:jmap:core') as { maxSizeUpload?: number } | null;
    const maxUploadBytes = coreCapabilities?.maxSizeUpload ?? 50_000_000; // Default 50MB
    const maxUploadMB = Math.floor(maxUploadBytes / 1024 / 1024);

    setIsUploading(true);
    let uploadedCount = 0;
    let rejectedCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file size - reject zero-byte files as some mail servers reject them
        if (file.size === 0) {
          toastOperationError('attachment.empty', file.name);
          rejectedCount++;
          continue;
        }

        // Check if adding this file would exceed the total attachment size limit
        if (!canAddAttachment(attachments, file.size)) {
          toast.error(
            `Cannot add ${file.name}: Total attachment size would exceed server limit of ${maxAttachmentsSizeMB} MB. ` +
            `Current: ${((attachments.reduce((sum, a) => sum + a.size, 0)) / 1024 / 1024).toFixed(1)} MB`
          );
          rejectedCount++;
          continue;
        }

        // Reject files larger than JMAP server limit
        if (file.size > maxUploadBytes) {
          toast.error(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed: ${maxUploadMB} MB`);
          rejectedCount++;
          continue;
        }

        // Warn about files approaching the individual limit
        if (file.size > maxUploadBytes * 0.8) {
          toast.warning(`Large file: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB). Approaching server upload limit of ${maxUploadMB} MB.`);
        }

        // Warn about files approaching the total attachment limit
        const currentTotal = attachments.reduce((sum, a) => sum + a.size, 0);
        const projectedTotal = currentTotal + file.size;
        if (projectedTotal > maxAttachmentsSizeMB * 1024 * 1024 * 0.8) {
          toast.warning(`Attachments are ${(projectedTotal / 1024 / 1024).toFixed(1)} MB of ${maxAttachmentsSizeMB} MB limit`);
        }

        const res = await jmapClient.uploadBlob(file);
        setAttachments(prev => [...prev, {
          blobId: res.blobId,
          name: file.name,
          type: file.type,
          size: file.size
        }]);
        uploadedCount++;
      }

      if (uploadedCount > 0 && rejectedCount === 0) {
        toast.success(`${uploadedCount} file${uploadedCount === 1 ? '' : 's'} attached`);
      } else if (uploadedCount > 0 && rejectedCount > 0) {
        toast.warning(`${uploadedCount} file${uploadedCount === 1 ? '' : 's'} attached, ${rejectedCount} rejected`);
      } else if (rejectedCount > 0) {
        toast.error(`No files attached. ${rejectedCount} file${rejectedCount === 1 ? '' : 's'} rejected due to size limits.`);
      }

      // Validate total size after upload
      const validation = validateAttachments(attachments);
      if (!validation.isValid) {
        toast.error(validation.error);
      }
    } catch (err: any) {
      // Check for 413 Payload Too Large
      if (err.message?.includes('413') || err.message?.toLowerCase().includes('too large')) {
        toast.error(`Upload failed: File too large. Check that your reverse proxy (nginx/Apache) allows uploads up to ${maxUploadMB} MB. See deployment documentation.`);
      } else {
        toastOperationError('attachment.upload');
      }
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
      ...(draftEmail?.id ? { draftId: draftEmail.id } : {}),
    }, {
      onSuccess: (result) => {
        if (isDeferredMutationResult(result)) {
          shouldPersistDraftRef.current = false;
          if (saveDraftTimeoutRef.current !== null) {
            window.clearTimeout(saveDraftTimeoutRef.current);
            saveDraftTimeoutRef.current = null;
          }
          clearComposerDraft(draftKey);
          toast.success('Message queued for sync when you are back online');
          onClose();
          return;
        }

        shouldPersistDraftRef.current = false;
        if (saveDraftTimeoutRef.current !== null) {
          window.clearTimeout(saveDraftTimeoutRef.current);
          saveDraftTimeoutRef.current = null;
        }
        clearComposerDraft(draftKey);
        toast.success(scheduleAt ? 'Message scheduled' : 'Message sent');
        onClose();
      },
      onError: (err: Error) => {
        toastOperationError('email.send', err);
      }
    });
  };

  const handleSelectTemplate = useCallback((template: EmailTemplate) => {
    // Only fill in empty fields or fields that are just the default signature
    if (!to.trim()) setTo(template.to || '');
    if (!cc.trim()) setCc(template.cc || '');
    if (!bcc.trim()) setBcc(template.bcc || '');
    if (!subject.trim()) setSubject(template.subject);
    
    // For body, only replace if it's empty or just a signature
    const currentBody = editor?.getHTML() || '';
    const isEmptyOrSignature = !currentBody.trim() || 
      currentBody === '<p></p>' || 
      (currentBody.includes('Sent from Sagittarius') && currentBody.replace(/<[^>]*>/g, '').trim().length < 30);
    
    if (isEmptyOrSignature && editor) {
      const newBody = template.body;
      setBodyHtml(newBody);
      editor.commands.setContent(newBody, false);
    }
  }, [editor, to, cc, bcc, subject]);

  const handleDiscardDraft = useCallback(() => {
    shouldPersistDraftRef.current = false;
    if (saveDraftTimeoutRef.current !== null) {
      window.clearTimeout(saveDraftTimeoutRef.current);
      saveDraftTimeoutRef.current = null;
    }
    clearComposerDraft(draftKey);
    onClose();
  }, [draftKey, onClose]);

  // Helper to check if draft has meaningful content
  const hasDraftContent = useCallback(() => {
    const hasRecipients = to.trim() || cc.trim() || bcc.trim();
    const hasSubject = subject.trim();
    const hasBody = bodyHtml.trim() && bodyHtml !== '<p></p>';
    return Boolean(hasRecipients || hasSubject || hasBody);
  }, [to, cc, bcc, subject, bodyHtml]);

  // Save draft to server and close (used when X button or backdrop is clicked)
  const handleCloseWithSave = useCallback(async () => {
    // If discarding was requested or no content, just close
    if (!shouldPersistDraftRef.current || !hasDraftContent()) {
      clearComposerDraft(draftKey);
      onClose();
      return;
    }

    // Stop localStorage persistence
    shouldPersistDraftRef.current = false;
    if (saveDraftTimeoutRef.current !== null) {
      window.clearTimeout(saveDraftTimeoutRef.current);
      saveDraftTimeoutRef.current = null;
    }

    const parseRecipients = (str: string): Recipient[] => {
      return str.split(',').map(s => s.trim()).filter(s => s.includes('@')).map(s => ({ email: s }));
    };

    try {
      await saveDraftMutation.mutateAsync({
        to: parseRecipients(to),
        cc: cc ? parseRecipients(cc) : undefined,
        bcc: bcc ? parseRecipients(bcc) : undefined,
        subject,
        body: bodyHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
        fromEmail: selectedIdentity?.email || '',
        draftId: draftEmail?.id,
      });
      clearComposerDraft(draftKey);
      toast.success('Draft saved');
    } catch (err: unknown) {
      // If server save fails, still clear localStorage and close
      // The user can still recover from server drafts folder if needed
      clearComposerDraft(draftKey);
      const error = err instanceof Error ? err : new Error('Unknown error');
      toastOperationError('email.saveDraft', error);
    } finally {
      onClose();
    }
  }, [draftKey, onClose, hasDraftContent, saveDraftMutation, to, cc, bcc, subject, bodyHtml, attachments, selectedIdentity, draftEmail]);

  // Memoized backdrop click handler
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseWithSave();
    }
  }, [handleCloseWithSave]);

  // Memoized close button click handler
  const handleCloseButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    handleCloseWithSave();
  }, [handleCloseWithSave]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    // Validate URL - only allow http:, https:, mailto:, tel:
    // This prevents javascript: URLs which could lead to XSS attacks
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    try {
      const parsed = new URL(url, window.location.origin);
      if (!allowedProtocols.includes(parsed.protocol)) {
        toast.error('Invalid URL protocol. Only http, https, mailto, and tel are allowed.');
        return;
      }
    } catch {
      toast.error('Invalid URL format.');
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
        className="fixed bottom-0 right-6 w-[280px] bg-white dark:bg-[#1C1C1E] border border-[#E5E5EA] dark:border-[#38383A] rounded-t-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.30)] flex items-center justify-between px-4 py-2.5 cursor-pointer z-[300]"
        onClick={() => setIsMinimized(false)}
        role="button"
        tabIndex={0}
        aria-label={`Expand composer: ${subject || 'New Message'}`}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsMinimized(false);
          }
        }}
      >
        <span className="font-semibold text-[13px] text-[#1C1C1E] dark:text-white truncate">{subject || 'New Message'}</span>
        <div className="flex gap-2 items-center">
          <button aria-label="Expand composer" onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }} className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded text-[#6C6C70] dark:text-[#8E8E93] transition-colors">
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button aria-label="Close and save draft" onClick={handleCloseButtonClick} className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded text-[#6C6C70] dark:text-[#8E8E93] transition-colors">
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
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
    >
      <motion.div
        ref={dialogRef}
        id="composer-dialog"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 5 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className={`bg-white dark:bg-[#1C1C1E] flex flex-col overflow-hidden ${
          isMobile 
            ? 'w-full h-full rounded-none dark:bg-black' 
            : 'rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.40)] border border-[#E5E5EA] dark:border-[#38383A] w-[640px] max-w-[calc(100vw-48px)] h-[70vh] max-h-[720px] min-h-[480px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Autofill background override - prevents yellow browser autofill color */}
        <style>{`
          #composer-dialog input:-webkit-autofill,
          #composer-dialog input:-webkit-autofill:hover,
          #composer-dialog input:-webkit-autofill:focus,
          #composer-dialog input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px transparent inset !important;
            -webkit-text-fill-color: inherit !important;
            transition: background-color 5000s ease-in-out 0s;
          }
        `}</style>

        {/* Header */}
        <header className="px-4 py-3 border-b border-[#E5E5EA] dark:border-[#38383A] flex items-center gap-2 bg-white dark:bg-[#1C1C1E] rounded-t-xl shrink-0">
          {/* Close button */}
          <button
            onClick={handleCloseWithSave}
            aria-label="Close and save draft"
            className="w-7 h-7 rounded-full bg-[#E5E5EA] dark:bg-[#3A3A3C] hover:bg-[#D1D1D6] dark:hover:bg-[#48484A] flex items-center justify-center transition-colors"
          >
            <X size={12} strokeWidth={2.5} className="text-[#636366] dark:text-[#8E8E93]" />
          </button>

          {/* Title */}
          <h2 id="composer-title" className="flex-1 text-center text-[15px] font-semibold text-[#1C1C1E] dark:text-white truncate">
            {subject || 'New Message'}
          </h2>

          {/* Right side: minimize + send */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMinimized(true)}
              aria-label="Minimize composer"
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-md text-[#6C6C70] dark:text-[#8E8E93] transition-colors"
            >
              <Minimize2 className="w-4 h-4" strokeWidth={1.5} />
            </button>

            <button 
              onClick={() => handleSend()}
              disabled={composeMutation.isPending || !to || !selectedIdentity}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#007AFF] dark:bg-[#0A84FF] text-white rounded-full font-semibold text-[13px] hover:bg-[#0062CC] dark:hover:bg-[#0070E0] transition-colors disabled:opacity-40"
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
                  aria-label={showSchedulePicker ? 'Hide schedule send options' : 'Show schedule send options'}
                  aria-expanded={showSchedulePicker}
                  aria-haspopup="dialog"
                  className="p-1.5 bg-[#007AFF] dark:bg-[#0A84FF] text-white rounded-full hover:bg-[#0062CC] dark:hover:bg-[#0070E0] transition-colors disabled:opacity-40"
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
            <div className="px-5 py-2 border-b border-[#E5E5EA] dark:border-[#38383A] flex items-center gap-2 shrink-0">
                <label htmlFor="composer-from" className="text-[#6C6C70] dark:text-[#8E8E93] w-14 font-medium text-[13px]">From:</label>
              <select
                id="composer-from"
                value={selectedIdentity?.id || ''}
                onChange={(e) => setSelectedIdentityId(e.target.value)}
                className="flex-1 border-none focus:ring-0 focus:outline-none text-[14px] py-1 bg-transparent cursor-pointer appearance-none text-[#1C1C1E] dark:text-white"
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
          <div className="px-5 py-2 border-b border-[#E5E5EA] dark:border-[#38383A] flex items-center gap-2 shrink-0">
            <label htmlFor="composer-to" className="text-[#6C6C70] dark:text-[#8E8E93] w-14 font-medium text-[13px]">
              <span aria-hidden="true">To:</span>
              <span className="sr-only">Recipients (required)</span>
            </label>
            <input 
              id="composer-to"
              value={to} 
              onChange={e => setTo(e.target.value)} 
              className="flex-1 border-none focus:ring-0 focus:outline-none text-[14px] py-1 bg-transparent text-[#1C1C1E] dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#636366]" 
              placeholder="Recipients"
              aria-required="true"
              autoFocus 
            />
            {!showCcBcc && (
              <button 
                onClick={() => setShowCcBcc(true)}
                aria-expanded="false"
                aria-controls="cc-bcc-fields"
                className="text-[#007AFF] dark:text-[#0A84FF] text-[12px] font-semibold hover:underline transition-opacity"
              >
                Cc/Bcc
              </button>
            )}
          </div>

          {/* Cc/Bcc fields */}
          <div id="cc-bcc-fields" role="group" aria-label="Cc and Bcc recipients">
            {showCcBcc && (
              <>
                <div className="px-5 py-2 border-b border-[#E5E5EA] dark:border-[#38383A] flex items-center gap-2 animate-in fade-in duration-200 shrink-0">
                  <label htmlFor="composer-cc" className="text-[#6C6C70] dark:text-[#8E8E93] w-14 font-medium text-[13px]">Cc:</label>
                  <input 
                    id="composer-cc"
                    value={cc} 
                    onChange={e => setCc(e.target.value)} 
                    className="flex-1 border-none focus:ring-0 focus:outline-none text-[14px] py-1 bg-transparent text-[#1C1C1E] dark:text-white" 
                  />
                </div>
                <div className="px-5 py-2 border-b border-[#E5E5EA] dark:border-[#38383A] flex items-center gap-2 animate-in fade-in duration-200 shrink-0">
                  <label htmlFor="composer-bcc" className="text-[#6C6C70] dark:text-[#8E8E93] w-14 font-medium text-[13px]">Bcc:</label>
                  <input 
                    id="composer-bcc"
                    value={bcc} 
                    onChange={e => setBcc(e.target.value)} 
                    className="flex-1 border-none focus:ring-0 focus:outline-none text-[14px] py-1 bg-transparent text-[#1C1C1E] dark:text-white" 
                  />
                </div>
              </>
            )}
          </div>

          {/* Subject field */}
          <div className="px-5 py-2 border-b border-[#E5E5EA] dark:border-[#38383A] flex items-center gap-2 shrink-0">
            <label htmlFor="composer-subject" className="text-[#6C6C70] dark:text-[#8E8E93] w-14 font-medium text-[13px]">Subject:</label>
            <input 
              id="composer-subject"
              value={subject} 
              onChange={e => setSubject(e.target.value)} 
              className="flex-1 border-none focus:ring-0 focus:outline-none text-[14px] py-1 font-semibold bg-transparent text-[#1C1C1E] dark:text-white" 
              aria-required="true"
            />
          </div>

          {/* Formatting toolbar — always visible */}
          {editor && (
            <div role="toolbar" aria-orientation="horizontal" aria-label="Text formatting" className="px-5 py-1.5 border-b border-[#E5E5EA] dark:border-[#38383A] flex items-center gap-1 shrink-0 bg-[#FAFAFA] dark:bg-[#2C2C2E]">
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
                aria-label={`Attach file (max ${maxUploadSizeMB} MB per file, ${maxAttachmentsSizeMB} MB total)`}
                title={`Attach file (max ${maxUploadSizeMB} MB per file, ${maxAttachmentsSizeMB} MB total)`}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded text-[#8E8E93] dark:text-[#8E8E93] cursor-pointer transition-colors disabled:opacity-50"
              >
                <Paperclip className={`w-3.5 h-3.5 ${isUploading ? 'animate-pulse' : ''}`} strokeWidth={1.5} />
              </button>
              <div aria-hidden="true" className="w-[1px] h-4 bg-[#E5E5EA] dark:bg-[#48484A] mx-1" />
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
              <div aria-hidden="true" className="w-[1px] h-4 bg-[#E5E5EA] dark:bg-[#48484A] mx-1" />
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
              <div aria-hidden="true" className="w-[1px] h-4 bg-[#E5E5EA] dark:bg-[#48484A] mx-1" />
              <ToolbarButton 
                onClick={setLink} 
                active={editor.isActive('link')}
                icon={<Link className="w-3.5 h-3.5" />} 
                label="Insert link"
              />
              <div aria-hidden="true" className="w-[1px] h-4 bg-[#E5E5EA] dark:bg-[#48484A] mx-1" />
              <ToolbarButton 
                onClick={() => setShowTemplatesDialog(true)} 
                active={false}
                icon={<FileText className="w-3.5 h-3.5" />} 
                label="Insert template"
              />
            </div>
          )}

          {/* Attachments area */}
          {attachments.length > 0 && (
            <div className="px-5 py-2.5 border-b border-[#E5E5EA] dark:border-[#38383A]">
              {/* Attachment pills */}
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {attachments.map(a => (
                  <div key={a.blobId} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#007AFF]/[0.08] dark:bg-[#0A84FF]/[0.15] border border-[#007AFF]/[0.15] dark:border-[#0A84FF]/[0.20] rounded-full text-[12px] font-medium text-[#007AFF] dark:text-[#0A84FF] animate-in zoom-in-95 duration-200">
                    <Paperclip className="w-3 h-3" strokeWidth={1.5} />
                    <span className="max-w-[120px] truncate">{a.name}</span>
                    <span className="text-[#005FCC] dark:text-[#64B5FF] text-[11px]">{(a.size / 1024).toFixed(0)}K</span>
                    <button aria-label={`Remove attachment ${a.name}`} onClick={() => removeAttachment(a.blobId)} className="p-0.5 hover:bg-[#007AFF]/[0.15] dark:hover:bg-[#0A84FF]/[0.20] rounded-full transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {/* Total size indicator */}
              {(() => {
                const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);
                const isNearLimit = totalSize > maxAttachmentsSizeMB * 1024 * 1024 * 0.8;
                return (
                  <div className={`mt-2 text-[11px] ${isNearLimit ? 'text-[#FF9500] dark:text-[#FF9F0A] font-medium' : 'text-[#8E8E93] dark:text-[#636366]'}`}>
                    Total: {(totalSize / 1024 / 1024).toFixed(1)} MB of {maxAttachmentsSizeMB} MB
                    {isNearLimit && ' (approaching limit)'}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Editor body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <EditorContent editor={editor} />
          </div>

          {/* Quoted text toggle */}
          {replyTo && initialReplyContent && (
            <div className="px-5 border-t border-[#E5E5EA] dark:border-[#38383A] shrink-0">
              <button
                onClick={() => {
                  const next = !isQuoteCollapsed;
                  setIsQuoteCollapsed(next);
                  const el = document.querySelector('.ProseMirror #quoted-content') as HTMLElement;
                  if (el) el.style.display = next ? 'none' : '';
                }}
                className="py-1.5 text-[12px] text-[#007AFF] dark:text-[#0A84FF] font-medium hover:underline transition-colors flex items-center gap-1"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${isQuoteCollapsed ? '' : 'rotate-180'}`} strokeWidth={2} />
                <span>{isQuoteCollapsed ? 'Show' : 'Hide'} Quoted Text</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-2.5 border-t border-[#E5E5EA] dark:border-[#38383A] flex items-center justify-between bg-white dark:bg-[#1C1C1E] shrink-0">
          <button onClick={handleDiscardDraft} aria-label="Discard draft" className="p-1.5 hover:bg-[#FF3B30]/10 rounded-lg text-[#6C6C70] dark:text-[#8E8E93] hover:text-[#FF3B30] dark:hover:text-[#FF453A] transition-colors" title="Discard draft">
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <span className="text-[11px] text-[#C7C7CC] dark:text-[#636366] font-medium">
            Draft
          </span>
          <div className="w-7" />
        </footer>
      </motion.div>
      
      {/* Templates Dialog */}
      <EmailTemplatesDialog
        isOpen={showTemplatesDialog}
        onClose={() => setShowTemplatesDialog(false)}
        onSelectTemplate={handleSelectTemplate}
        selectionMode={true}
      />
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
      className={`p-1.5 rounded transition-colors ${active ? 'text-[#007AFF] dark:text-[#0A84FF] bg-[#007AFF]/10 dark:bg-[#0A84FF]/15' : 'hover:bg-black/5 dark:hover:bg-white/10 text-[#6C6C70] dark:text-[#8E8E93]'}`}
    >
      {icon}
    </button>
  );
}
