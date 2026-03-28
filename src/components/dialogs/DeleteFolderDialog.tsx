import { AlertTriangle, X } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#E5E5E5] max-w-md w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <h2 className="text-[17px] font-bold text-[#1C1C1E]">Delete Folder</h2>
          <button
            onClick={onClose}
            className="p-1 text-[#8E8E93] hover:bg-black/5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6 text-[#FF3B30]" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium text-[#1C1C1E]">
                Are you sure you want to delete <span className="font-bold">"{folderName}"</span>?
              </p>
              <p className="text-[12px] text-[#8E8E93] mt-2">
                This action cannot be undone. All emails in this folder will be moved to Trash.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-[#F2F2F7] text-[#1C1C1E] rounded-lg font-medium text-[13px] hover:bg-[#E5E5E5] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-[#FF3B30] text-white rounded-lg font-medium text-[13px] hover:bg-[#E61D0A] transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
