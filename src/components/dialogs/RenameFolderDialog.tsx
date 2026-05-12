import { useState, useEffect, useRef } from 'react';
import { BaseDialog } from './BaseDialog';

interface RenameFolderDialogProps {
  isOpen: boolean;
  folderName: string;
  onClose: () => void;
  onConfirm: (newName: string) => void;
  isLoading?: boolean;
}

export function RenameFolderDialog({
  isOpen,
  folderName,
  onClose,
  onConfirm,
  isLoading = false,
}: RenameFolderDialogProps) {
  const [newName, setNewName] = useState(folderName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input with the current folder name whenever the dialog opens
  useEffect(() => {
    if (isOpen) {
      setNewName(folderName);
    }
  }, [isOpen, folderName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newName !== folderName) {
      onConfirm(newName.trim());
    }
  };

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Rename Folder"
      titleId="rename-folder-dialog-title"
      initialFocusRef={inputRef}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-[#1C1C1E] mb-2">
            Folder Name
          </label>
          <input
            ref={inputRef}
            id="rename-folder-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new folder name"
            className="w-full px-3 py-2 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-[#E5E5E5] dark:border-[#38383A] rounded-lg text-[13px] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF] dark:focus:ring-[#0A84FF] focus:bg-white dark:focus:bg-[#1C1C1E] transition-colors"
            disabled={isLoading}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#1C1C1E] dark:text-white rounded-lg font-medium text-[13px] hover:bg-[#E5E5E5] dark:hover:bg-[#38383A] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!newName.trim() || newName === folderName || isLoading}
            className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-lg font-medium text-[13px] hover:bg-[#0051D5] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </form>
    </BaseDialog>
  );
}
