import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { useEmailParse } from '../hooks/useEmailParse';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { EmailBodyPart } from '../types/jmap';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'headers' | 'text' | 'html' | 'structure';

interface RawEmailViewerProps {
  blobId: string;
  onClose: () => void;
}

/** Extended body part with parsed structure properties */
interface ParsedBodyPart extends EmailBodyPart {
  subParts?: ParsedBodyPart[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a flat header list from the JMAP headers array */
function renderHeaders(headers: { name: string; value: string }[] | undefined) {
  if (!headers || headers.length === 0) {
    return (
      <p className="text-[13px] text-icloud-text-secondary italic px-4 py-6 text-center">
        No headers available
      </p>
    );
  }

  return (
    <table className="w-full text-[13px] border-collapse">
      <tbody>
        {headers.map((h, i) => (
          <tr
            key={i}
            className={i % 2 === 0 ? 'bg-icloud-card' : 'bg-icloud-bg-layer1'}
          >
            <td className="px-3 sm:px-4 py-2 font-semibold text-icloud-text-primary align-top whitespace-nowrap w-28 sm:w-52 border-r border-icloud-border">
              {h.name}
            </td>
            <td className="px-4 py-2 text-icloud-text-primary break-all font-mono">
              {h.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Recursively render a MIME tree */
function MimeNode({
  part,
  depth = 0,
}: {
  part: ParsedBodyPart;
  depth?: number;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren =
    part.subParts && Array.isArray(part.subParts) && part.subParts.length > 0;

  const handleToggle = () => {
    if (hasChildren) {
      setOpen((v) => !v);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (hasChildren && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen((v) => !v);
    }
  };

  return (
    <div style={{ paddingLeft: depth * 16 }} className="font-mono text-[12px]">
      <div
        role={hasChildren ? 'button' : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        aria-expanded={hasChildren ? open : undefined}
        onClick={hasChildren ? handleToggle : undefined}
        onKeyDown={hasChildren ? handleKeyDown : undefined}
        className={`flex items-start gap-1 py-1 px-2 rounded ${
          hasChildren ? 'cursor-pointer hover:bg-icloud-bg-layer1 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-icloud-accent/50' : ''
        }`}
      >
        {hasChildren && (
          <ChevronRight
            className={`w-3.5 h-3.5 text-icloud-text-secondary mt-0.5 transition-transform ${
              open ? 'rotate-90' : ''
            }`}
            strokeWidth={1.5}
          />
        )}
        {!hasChildren && (
          <span className="w-3.5 shrink-0" />
        )}
        <div className="min-w-0">
          <span className="text-icloud-accent font-semibold">
            {part.type ?? 'unknown'}
          </span>
          {part.charset && (
            <span className="text-icloud-text-secondary ml-2">charset={part.charset}</span>
          )}
          {part.name && (
            <span className="text-icloud-text-secondary ml-2">&quot;{part.name}&quot;</span>
          )}
          {part.size !== undefined && (
            <span className="text-icloud-text-tertiary ml-2">
              ({part.size.toLocaleString()} bytes)
            </span>
          )}
          {part.blobId && (
            <span className="text-icloud-green ml-2 text-[11px]">
              blob:{part.blobId.slice(0, 12)}…
            </span>
          )}
        </div>
      </div>

      {hasChildren && open && (
        <div>
          {part.subParts?.map((child, i) => (
            <MimeNode key={i} part={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RawEmailViewer({ blobId, onClose }: RawEmailViewerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('headers');
  const { data: email, isLoading, error } = useEmailParse(blobId);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(dialogRef, { initialFocusRef: closeButtonRef });

  // Escape key closes
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'headers', label: 'Headers' },
    { id: 'text', label: 'Text Body' },
    { id: 'html', label: 'HTML Source' },
    { id: 'structure', label: 'Structure' },
  ];

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();

    let nextIndex = index;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;
    else if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;

    setActiveTab(TABS[nextIndex].id);
    window.requestAnimationFrame(() => {
      document.getElementById(`raw-email-tab-${TABS[nextIndex].id}`)?.focus();
    });
  };

  // Extract text body
  const textBody = (() => {
    if (!email?.textBody?.length) return null;
    const partId = email.textBody[0]?.partId;
    return partId ? (email.bodyValues?.[partId]?.value ?? null) : null;
  })();

  // Extract html body
  const htmlSource = (() => {
    if (!email?.htmlBody?.length) return null;
    const partId = email.htmlBody[0]?.partId;
    return partId ? (email.bodyValues?.[partId]?.value ?? null) : null;
  })();

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="raw-email-title" tabIndex={-1} className="bg-icloud-bg-layer2 sm:rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden h-full sm:h-auto"
        style={{ maxHeight: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 'calc(100vh - 80px)' }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-icloud-border bg-icloud-bg-layer1/60 bg-icloud-card shrink-0">
          <div>
            <h2 id="raw-email-title" className="text-[15px] font-semibold text-icloud-text-primary">
              Raw Email
            </h2>
            <p className="text-[11px] text-icloud-text-secondary font-mono mt-0.5 truncate max-w-[60vw] sm:max-w-xs">
              {blobId}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-icloud-border bg-icloud-card hover:bg-icloud-divider   flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={14} strokeWidth={2} className="text-icloud-text-secondary" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-icloud-border bg-icloud-bg-layer2 shrink-0 overflow-x-auto" role="tablist" aria-label="Raw email sections">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              id={`raw-email-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`raw-email-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-icloud-accent text-white shadow-sm'
                  : 'text-icloud-text-secondary hover:bg-icloud-bg-layer1 dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto bg-icloud-bg-layer2" id={`raw-email-panel-${activeTab}`} role="tabpanel" aria-labelledby={`raw-email-tab-${activeTab}`}>
          {isLoading && (
            <div className="flex items-center justify-center h-full" role="status" aria-live="polite">
              <div className="w-6 h-6 border-2 border-icloud-accent border-t-transparent rounded-full animate-spin" />
              <span className="sr-only">Loading raw email</span>
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-8" role="alert">
              <p className="text-[15px] font-medium text-icloud-red">
                Failed to parse message
              </p>
              <p className="text-[13px] text-icloud-text-secondary">
                {(error as Error).message}
              </p>
            </div>
          )}

          {!isLoading && !error && email && (
            <>
              {/* HEADERS */}
              {activeTab === 'headers' && renderHeaders(email.headers)}

              {/* TEXT BODY */}
              {activeTab === 'text' && (
                <div className="p-4">
                  {textBody ? (
                    <pre className="text-[13px] font-mono text-icloud-text-primary whitespace-pre-wrap break-words leading-relaxed">
                      {textBody}
                    </pre>
                  ) : (
                    <p className="text-[13px] text-icloud-text-secondary italic text-center py-10">
                      No text body available
                    </p>
                  )}
                </div>
              )}

              {/* HTML SOURCE */}
              {activeTab === 'html' && (
                <div className="p-4">
                  {htmlSource ? (
                    <pre className="text-[13px] font-mono text-icloud-text-primary whitespace-pre-wrap break-words leading-relaxed">
                      {htmlSource}
                    </pre>
                  ) : (
                    <p className="text-[13px] text-icloud-text-secondary italic text-center py-10">
                      No HTML body available
                    </p>
                  )}
                </div>
              )}

              {/* STRUCTURE */}
              {activeTab === 'structure' && (
                <div className="p-4">
                  {email.bodyStructure ? (
                    <MimeNode part={email.bodyStructure} />
                  ) : email.htmlBody || email.textBody ? (
                    /* Fallback: flat list of body parts */
                    <div className="space-y-1">
                      {(email.htmlBody ?? []).map((p: any, i: number) => (
                        <MimeNode key={`html-${i}`} part={{ ...p, type: 'text/html' }} />
                      ))}
                      {(email.textBody ?? []).map((p: any, i: number) => (
                        <MimeNode key={`text-${i}`} part={{ ...p, type: 'text/plain' }} />
                      ))}
                      {(email.attachments ?? []).map((a: any, i: number) => (
                        <MimeNode key={`att-${i}`} part={a} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-icloud-text-secondary italic text-center py-10">
                      No MIME structure available
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {!isLoading && !error && !email && (
            <p className="text-[13px] text-icloud-text-secondary italic text-center py-10">
              No data returned for this blob.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
