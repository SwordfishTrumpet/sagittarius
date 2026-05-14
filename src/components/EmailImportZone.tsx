import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { jmapClient } from '../api/jmap';
import { useEmailImport } from '../hooks/useEmailImport';

interface EmailImportZoneProps {
  mailboxId: string;
}

/**
 * EmailImportZone — full-screen drop zone overlay for .eml files.
 * Shows when an .eml file is dragged over the window, then uploads
 * the blob and imports it into the given mailboxId.
 */
export function EmailImportZone({ mailboxId }: EmailImportZoneProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const importEmail = useEmailImport();
  const dragCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only activate for native file drags — ignore react-dnd internal drags
  const isNativeFileDrag = useCallback((e: DragEvent): boolean => {
    const types = Array.from(e.dataTransfer?.types ?? []);
    // Native file drags always include 'Files' in dataTransfer.types.
    // react-dnd internal drags do NOT set 'Files'.
    return types.includes('Files');
  }, []);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      if (!isNativeFileDrag(e)) return;
      dragCountRef.current++;
      e.preventDefault();
      setIsVisible(true);
      setIsDragOver(true);
    },
    [isNativeFileDrag],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    if (!isNativeFileDrag(e)) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [isNativeFileDrag]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!isNativeFileDrag(e)) return;
    dragCountRef.current = Math.max(0, dragCountRef.current - 1);
    if (dragCountRef.current === 0) {
      setIsVisible(false);
      setIsDragOver(false);
    }
  }, [isNativeFileDrag]);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      if (!isNativeFileDrag(e)) return;
      e.preventDefault();
      dragCountRef.current = 0;
      setIsVisible(false);
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer?.files ?? []);
      const emlFiles = files.filter(
        (f) =>
          f.name.toLowerCase().endsWith('.eml') ||
          f.type === 'message/rfc822',
      );

      if (emlFiles.length === 0) {
        toast.error('Please drop a .eml file to import');
        return;
      }

      for (const file of emlFiles) {
        try {
          toast.loading(`Uploading ${file.name}…`, { id: `upload-${file.name}` });
          const uploadResult = await jmapClient.uploadBlob(file);
          const blobId: string = uploadResult.blobId ?? uploadResult.id;
          if (!blobId) throw new Error('No blobId returned from upload');

          toast.dismiss(`upload-${file.name}`);

          await importEmail.mutateAsync({
            blobId,
            mailboxIds: { [mailboxId]: true },
          });
        } catch (err) {
          toast.dismiss(`upload-${file.name}`);
          const message = err instanceof Error ? err.message : 'Unknown error';
          toast.error(`Failed to import ${file.name}: ${message}`);
        }
      }
    },
    [mailboxId, importEmail, isNativeFileDrag],
  );

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.eml') && file.type !== 'message/rfc822') {
        toast.error(`${file.name} is not a .eml file`);
        continue;
      }
      try {
        toast.loading(`Uploading ${file.name}…`, { id: `import-${file.name}` });
        const uploadResult = await jmapClient.uploadBlob(file);
        const blobId: string = uploadResult.blobId ?? uploadResult.id;
        if (!blobId) throw new Error('No blobId returned from upload');
        toast.dismiss(`import-${file.name}`);
        await importEmail.mutateAsync({
          blobId,
          mailboxIds: { [mailboxId]: true },
        });
        toast.success(`Imported ${file.name}`);
      } catch (err) {
        toast.dismiss(`import-${file.name}`);
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to import ${file.name}: ${message}`);
      }
    }
    // Reset input so same file can be re-imported
    e.target.value = '';
  }, [mailboxId, importEmail]);

  return (
    <>
      {isVisible && (
        <div
          className="fixed inset-0 z-[60] bg-white/80 bg-icloud-bg-primary/80 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          {/* Dashed border drop area */}
          <div
            className={`flex flex-col items-center justify-center gap-5 w-80 h-56 rounded-3xl border-2 border-dashed transition-all duration-200 ${
              isDragOver
                ? 'border-icloud-accent dark:border-icloud-accent bg-icloud-accent/8'
                : 'border-[#C7C7CC] dark:border-[#636366] bg-white/40 bg-icloud-bg-primary/40'
            }`}
          >
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md transition-colors ${
                isDragOver ? 'bg-icloud-accent' : 'bg-icloud-bg-layer1'
              }`}
            >
              {isDragOver ? (
                <Upload className="w-8 h-8 text-white" strokeWidth={1.5} />
              ) : (
                <FileText className="w-8 h-8 text-icloud-text-secondary" strokeWidth={1.5} />
              )}
            </div>

            <div className="text-center px-4">
              <p
                className={`text-[17px] font-semibold tracking-tight ${
                  isDragOver ? 'text-icloud-accent' : 'text-icloud-text-primary'
                }`}
              >
                Drop .eml file to import
              </p>
              <p className="text-[13px] text-icloud-text-secondary mt-1">
                The message will be added to this mailbox
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Always-visible import button for keyboard users */}
      <div className="absolute bottom-4 right-4 z-[59]">
        <input
          ref={fileInputRef}
          type="file"
          accept=".eml,message/rfc822"
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
        />
        <button
          onClick={handleImportClick}
          className="flex items-center gap-2 px-3 py-2 bg-icloud-card border border-icloud-border rounded-xl text-[12px] font-medium text-icloud-text-primary hover:bg-icloud-bg-layer1 shadow-sm transition-colors"
          aria-label="Import email from .eml file"
        >
          <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
          Import Email
        </button>
      </div>
    </>
  );
}
