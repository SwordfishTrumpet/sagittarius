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
          <label className="block text-[13px] font-medium text-icloud-text-primary mb-2">
            Folder Name
          </label>
          <input
            ref={inputRef}
            id="create-folder-name"
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Enter folder name"
            className="w-full px-3 py-2 bg-icloud-bg-layer1 border border-icloud-border rounded-lg text-[13px] text-icloud-text-primary focus:outline-none focus:ring-2 focus:ring-icloud-accent focus:bg-white dark:focus:bg-icloud-bg-primary transition-colors"
            disabled={isLoading}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-icloud-bg-layer1 text-icloud-text-primary rounded-lg font-medium text-[13px] hover:bg-icloud-border  transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!folderName.trim() || isLoading}
            className="flex-1 px-4 py-2 bg-icloud-accent text-white rounded-lg font-medium text-[13px] hover:bg-[#0051D5] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </BaseDialog>
  );
}
