import { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BaseDialog } from './BaseDialog';

interface DeleteFolderDialogProps {
  isOpen: boolean;
  folderName: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteFolderDialog({
  isOpen,
  folderName,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteFolderDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Folder"
      titleId="delete-folder-dialog-title"
    >
      <div className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-6 h-6 text-icloud-red" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-icloud-text-primary">
              Are you sure you want to delete <span className="font-bold">"{folderName}"</span>?
            </p>
            <p className="text-[12px] text-icloud-text-secondary mt-2">
              This action cannot be undone. All emails in this folder will be moved to Trash.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-icloud-bg-layer1 text-icloud-text-primary rounded-lg font-medium text-[13px] hover:bg-icloud-border  transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-icloud-red text-white rounded-lg font-medium text-[13px] hover:bg-[#E61D0A] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </BaseDialog>
  );
}
