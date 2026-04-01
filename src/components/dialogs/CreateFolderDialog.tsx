import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (folderName: string) => void;
  isLoading?: boolean;
}

export function CreateFolderDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(dialogRef, { isActive: isOpen, initialFocusRef: inputRef });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      onConfirm(folderName.trim());
      setFolderName('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="create-folder-dialog-title" tabIndex={-1} className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#E5E5E5] max-w-md w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <h2 id="create-folder-dialog-title" className="text-[17px] font-bold text-[#1C1C1E]">New Folder</h2>
          <button
            onClick={onClose}
            className="p-1 text-[#8E8E93] hover:bg-black/5 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#1C1C1E] mb-2">
              Folder Name
            </label>
            <input
              ref={inputRef}
              id="create-folder-name"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name"
              className="w-full px-3 py-2 bg-[#F2F2F7] border border-[#E5E5E5] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white transition-colors"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-[#F2F2F7] text-[#1C1C1E] rounded-lg font-medium text-[13px] hover:bg-[#E5E5E5] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!folderName.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-lg font-medium text-[13px] hover:bg-[#0051D5] transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
