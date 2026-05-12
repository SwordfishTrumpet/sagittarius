import { useRef, useState } from 'react';
import { BaseDialog } from './BaseDialog';

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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      onConfirm(folderName.trim());
      setFolderName('');
    }
  };

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title="New Folder"
      titleId="create-folder-dialog-title"
      initialFocusRef={inputRef}
    >
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
            disabled={!folderName.trim() || isLoading}
            className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-lg font-medium text-[13px] hover:bg-[#0051D5] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </BaseDialog>
  );
}
