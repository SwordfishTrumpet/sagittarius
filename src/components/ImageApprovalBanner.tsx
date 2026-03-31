import { Shield, Eye } from 'lucide-react';

interface ImageApprovalBannerProps {
  blockedImageCount: number;
  onLoadImages: () => void;
  isDismissed?: boolean;
  onDismiss?: () => void;
}

/**
 * ImageApprovalBanner Component
 * 
 * Displays a subtle, glassmorphic banner when external images are blocked.
 * Allows users to load remote images if they choose to approve them.
 * 
 * Design: iCloud Mail-inspired with glassmorphic background and Apple blue accent.
 */
export function ImageApprovalBanner({
  blockedImageCount,
  onLoadImages,
  isDismissed = false,
  onDismiss,
}: ImageApprovalBannerProps) {
  if (isDismissed || blockedImageCount === 0) {
    return null;
  }

  return (
    <div className="mx-8 mt-8 mb-6 p-4 rounded-xl bg-white/60 backdrop-blur-md border border-[#E5E5E5] shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#007AFF]/10">
            <Shield className="w-4 h-4 text-[#007AFF]" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#1C1C1E]">
              This message contains {blockedImageCount} remote {blockedImageCount === 1 ? 'image' : 'images'}
            </p>
            <p className="text-[12px] text-[#8E8E93] mt-0.5">
              Remote images can be used to track your activity and location.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 text-[12px] font-medium text-[#8E8E93] hover:bg-black/5 rounded-lg transition-colors"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onLoadImages}
            className="px-3 py-1.5 text-[12px] font-semibold text-white bg-[#007AFF] hover:bg-[#0051D5] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Eye className="w-3.5 h-3.5" strokeWidth={2} />
            Load Images
          </button>
        </div>
      </div>
    </div>
  );
}
