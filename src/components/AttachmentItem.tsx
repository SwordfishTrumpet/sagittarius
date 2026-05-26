import { useState, useEffect, useRef, memo } from 'react'
import { Download, ExternalLink, FileIcon } from 'lucide-react'
import { jmapClient } from '../api/jmap'
import { logger } from '../utils/logger'
import type { EmailBodyPart } from '../types/jmap'

function AttachmentItemComponent({ attachment }: { attachment: EmailBodyPart }) {
  const blobId = attachment.blobId ?? '';
  const name = attachment.name ?? 'unnamed';
  const size = attachment.size ?? 0;
  const downloadUrl = blobId ? jmapClient.getBlobUrl(blobId, attachment.type, name) : '';
  const isImage = attachment.type.startsWith('image/');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const revokeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (revokeTimeoutRef.current) {
        clearTimeout(revokeTimeoutRef.current);
      }
    };
  }, []);
  
  // Fetch image thumbnail with auth header
  useEffect(() => {
    if (!isImage || !downloadUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const authHeader = jmapClient.getAuthHeader();
    // Note: CSRF token is NOT included here - blob download uses Basic Auth only
    fetch(downloadUrl, {
      headers: authHeader ? { 'Authorization': authHeader } : {},
    })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.blob(); })
      .then(blob => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setThumbnailUrl(objectUrl);
        }
      })
      .catch((err) => { 
        logger.warn('[AttachmentItem] Failed to load thumbnail:', err);
        setThumbnailUrl(null); 
      });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [downloadUrl, isImage]);

  // Fetch blob with auth, then open/download
  const fetchBlob = async (action: 'open' | 'download') => {
    const authHeader = jmapClient.getAuthHeader();
    // Note: CSRF token is NOT included here - blob download uses Basic Auth only
    const response = await fetch(downloadUrl, {
      headers: authHeader ? { 'Authorization': authHeader } : {},
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    if (action === 'open') {
      window.open(blobUrl, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    revokeTimeoutRef.current = setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  const handleOpen = async () => {
    try {
      await fetchBlob('open');
    } catch (err) {
      logger.warn('[AttachmentItem] Failed to open attachment, falling back to direct URL:', err);
      window.open(downloadUrl, '_blank');
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetchBlob('download');
    } catch (err) {
      logger.warn('[AttachmentItem] Failed to download attachment, falling back to direct URL:', err);
      window.open(downloadUrl, '_blank');
    }
  };
  
  return (
    <div 
      className="flex items-center gap-4 p-3 bg-icloud-bg-layer1/50 bg-icloud-bg-primary/50 rounded-xl border border-icloud-border group hover:bg-icloud-card hover:shadow-sm transition-all duration-200 cursor-pointer"
      onDoubleClick={handleOpen}
      title="Double-click to open"
    >
      <div className="w-10 h-10 rounded-lg bg-icloud-card border border-icloud-border flex items-center justify-center text-icloud-accent shrink-0 overflow-hidden shadow-sm">
        {isImage && thumbnailUrl ? (
          <img src={thumbnailUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <FileIcon className="w-5 h-5" strokeWidth={1.5} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[13px] text-icloud-text-primary truncate">{name}</div>
        <div className="text-[11px]  font-medium uppercase tracking-tight">
          {(size / 1024).toFixed(0)} KB · {attachment.type.split('/')[1]?.toUpperCase() || 'FILE'}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity">
        <button 
          onClick={handleDownload}
          className="p-2 text-icloud-accent hover:bg-icloud-bg-layer1 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Download"
          aria-label={`Download ${name}`}
        >
          <Download className="w-4 h-4" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleOpen(); }}
          className="p-2  hover:bg-icloud-bg-layer1 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Open in New Tab"
          aria-label={`Open ${name} in new tab`}
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
 }

 export const AttachmentItem = memo(AttachmentItemComponent)
