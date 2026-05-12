import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface BaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  children: ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

/**
 * BaseDialog — A reusable modal dialog component with consistent styling,
 * focus trapping, and accessibility features.
 */
export function BaseDialog({
  isOpen,
  onClose,
  title,
  titleId,
  children,
  initialFocusRef,
}: BaseDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, { isActive: isOpen, initialFocusRef });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#E5E5E5] dark:border-[#38383A] max-w-md w-full mx-4"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] dark:border-[#38383A]">
          <h2 id={titleId} className="text-[17px] font-bold text-[#1C1C1E] dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[#8E8E93] dark:text-[#A1A1A6] hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
