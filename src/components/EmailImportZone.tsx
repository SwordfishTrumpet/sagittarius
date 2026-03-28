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
        } catch (err: any) {
          toast.dismiss(`upload-${file.name}`);
          toast.error(`Failed to import ${file.name}: ${err?.message ?? 'Unknown error'}`);
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

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-none"
      aria-hidden="true"
    >
      {/* Dashed border drop area */}
      <div
        className={`flex flex-col items-center justify-center gap-5 w-80 h-56 rounded-3xl border-2 border-dashed transition-all duration-200 ${
          isDragOver
            ? 'border-[#007AFF] bg-[#007AFF]/8 scale-105'
            : 'border-[#C7C7CC] bg-white/40'
        }`}
      >
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md transition-colors ${
            isDragOver ? 'bg-[#007AFF]' : 'bg-[#F2F2F7]'
          }`}
        >
          {isDragOver ? (
            <Upload className="w-8 h-8 text-white" strokeWidth={1.5} />
          ) : (
            <FileText className="w-8 h-8 text-[#8E8E93]" strokeWidth={1.5} />
          )}
        </div>

        <div className="text-center px-4">
          <p
            className={`text-[17px] font-semibold tracking-tight ${
              isDragOver ? 'text-[#007AFF]' : 'text-[#1C1C1E]'
            }`}
          >
            Drop .eml file to import
          </p>
          <p className="text-[13px] text-[#8E8E93] mt-1">
            The message will be added to this mailbox
          </p>
        </div>
      </div>
    </div>
  );
}
