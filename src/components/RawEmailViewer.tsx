import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { useEmailParse } from '../hooks/useEmailParse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'headers' | 'text' | 'html' | 'structure';

interface RawEmailViewerProps {
  blobId: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a flat header list from the JMAP headers array */
function renderHeaders(headers: { name: string; value: string }[] | undefined) {
  if (!headers || headers.length === 0) {
    return (
      <p className="text-[13px] text-[#8E8E93] italic px-4 py-6 text-center">
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
            className={i % 2 === 0 ? 'bg-white' : 'bg-[#F9F9FB]'}
          >
            <td className="px-4 py-2 font-semibold text-[#1C1C1E] align-top whitespace-nowrap w-52 border-r border-[#E5E5EA]">
              {h.name}
            </td>
            <td className="px-4 py-2 text-[#3A3A3C] break-all font-mono">
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
  part: any;
  depth?: number;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren =
    part.subParts && Array.isArray(part.subParts) && part.subParts.length > 0;

  return (
    <div style={{ paddingLeft: depth * 16 }} className="font-mono text-[12px]">
      <div
        className={`flex items-start gap-1 py-1 px-2 rounded ${
          hasChildren ? 'cursor-pointer hover:bg-[#F2F2F7]' : ''
        }`}
        onClick={hasChildren ? () => setOpen((v) => !v) : undefined}
      >
        {hasChildren && (
          <ChevronRight
            className={`w-3.5 h-3.5 text-[#8E8E93] mt-0.5 transition-transform ${
              open ? 'rotate-90' : ''
            }`}
            strokeWidth={1.5}
          />
        )}
        {!hasChildren && (
          <span className="w-3.5 shrink-0" />
        )}
        <div className="min-w-0">
          <span className="text-[#007AFF] font-semibold">
            {part.type ?? 'unknown'}
          </span>
          {part.charset && (
            <span className="text-[#8E8E93] ml-2">charset={part.charset}</span>
          )}
          {part.name && (
            <span className="text-[#636366] ml-2">&quot;{part.name}&quot;</span>
          )}
          {part.size !== undefined && (
            <span className="text-[#C7C7CC] ml-2">
              ({part.size.toLocaleString()} bytes)
            </span>
          )}
          {part.blobId && (
            <span className="text-[#34C759] ml-2 text-[11px]">
              blob:{part.blobId.slice(0, 12)}…
            </span>
          )}
        </div>
      </div>

      {hasChildren && open && (
        <div>
          {part.subParts.map((child: any, i: number) => (
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
      className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
        style={{ height: 'calc(100vh - 80px)', maxHeight: 780 }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5EA] bg-[#F2F2F7]/60 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1C1C1E]">
              Raw Email
            </h2>
            <p className="text-[11px] text-[#8E8E93] font-mono mt-0.5 truncate max-w-xs">
              {blobId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E5E5EA] hover:bg-[#D1D1D6] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={14} strokeWidth={2} className="text-[#636366]" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-[#E5E5EA] bg-white shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'text-[#636366] hover:bg-[#F2F2F7]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto bg-white">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-8">
              <p className="text-[15px] font-medium text-[#FF3B30]">
                Failed to parse message
              </p>
              <p className="text-[13px] text-[#8E8E93]">
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
                    <pre className="text-[13px] font-mono text-[#1C1C1E] whitespace-pre-wrap break-words leading-relaxed">
                      {textBody}
                    </pre>
                  ) : (
                    <p className="text-[13px] text-[#8E8E93] italic text-center py-10">
                      No text body available
                    </p>
                  )}
                </div>
              )}

              {/* HTML SOURCE */}
              {activeTab === 'html' && (
                <div className="p-4">
                  {htmlSource ? (
                    <pre className="text-[13px] font-mono text-[#1C1C1E] whitespace-pre-wrap break-words leading-relaxed">
                      {htmlSource}
                    </pre>
                  ) : (
                    <p className="text-[13px] text-[#8E8E93] italic text-center py-10">
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
                    <p className="text-[13px] text-[#8E8E93] italic text-center py-10">
                      No MIME structure available
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {!isLoading && !error && !email && (
            <p className="text-[13px] text-[#8E8E93] italic text-center py-10">
              No data returned for this blob.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
