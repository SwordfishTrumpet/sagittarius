import { useState, useEffect } from 'react'
import { Download, ExternalLink, FileIcon } from 'lucide-react'
import { jmapClient } from '../api/jmap'

export function AttachmentItem({ attachment }: { attachment: any }) {
  const downloadUrl = jmapClient.getBlobUrl(attachment.blobId, attachment.type, attachment.name);
  const isImage = attachment.type.startsWith('image/');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  
  // Fetch image thumbnail with auth header
  useEffect(() => {
    if (!isImage || !downloadUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const authHeader = jmapClient.getAuthHeader();
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
      .catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [downloadUrl, isImage]);

  // Fetch blob with auth, then open/download
  const fetchBlob = async (action: 'open' | 'download') => {
    const authHeader = jmapClient.getAuthHeader();
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
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  const handleOpen = async () => {
    try {
      await fetchBlob('open');
    } catch {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetchBlob('download');
    } catch {
      window.open(downloadUrl, '_blank');
    }
  };
  
  return (
    <div 
      className="flex items-center gap-4 p-3 bg-[#F2F2F7]/50 rounded-xl border border-[#E5E5E5] group hover:bg-white hover:shadow-sm transition-all duration-200 cursor-pointer"
      onDoubleClick={handleOpen}
      title="Double-click to open"
    >
      <div className="w-10 h-10 rounded-lg bg-white border border-[#E5E5E5] flex items-center justify-center text-[#007AFF] shrink-0 overflow-hidden shadow-sm">
        {isImage && thumbnailUrl ? (
          <img src={thumbnailUrl} alt={attachment.name} className="w-full h-full object-cover" />
        ) : (
          <FileIcon className="w-5 h-5" strokeWidth={1.5} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[13px] text-[#1C1C1E] truncate">{attachment.name}</div>
        <div className="text-[11px] text-[#6C6C70] font-medium uppercase tracking-tight">
          {(attachment.size / 1024).toFixed(0)} KB · {attachment.type.split('/')[1]?.toUpperCase() || 'FILE'}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={handleDownload}
          className="p-2 text-[#007AFF] hover:bg-[#F2F2F7] rounded-full transition-colors"
          title="Download"
          aria-label={`Download ${attachment.name}`}
        >
          <Download className="w-4 h-4" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleOpen(); }}
          className="p-2 text-[#6C6C70] hover:bg-[#F2F2F7] rounded-full transition-colors"
          title="Open in New Tab"
          aria-label={`Open ${attachment.name} in new tab`}
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
