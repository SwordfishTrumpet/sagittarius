import React from 'react';
import { Mail } from 'lucide-react';

interface ReadReceiptBannerProps {
  sender: string;
  onSendReceipt: () => void;
  onIgnore: () => void;
}

/**
 * ReadReceiptBanner — an iCloud-style info banner shown when a sender
 * has requested a message disposition notification (MDN / read receipt).
 */
export function ReadReceiptBanner({
  sender,
  onSendReceipt,
  onIgnore,
}: ReadReceiptBannerProps) {
  return (
    <div className="mx-8 mt-6 mb-2 bg-icloud-accent/5 border border-icloud-accent/20 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between gap-4">
        {/* Icon + message */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-icloud-accent/10">
            <Mail className="w-4 h-4 text-icloud-accent" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-medium text-icloud-text-primary leading-snug">
            <span className="font-semibold">{sender}</span> has requested a read
            receipt.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onIgnore}
            className="px-3 py-1.5 text-[12px] font-medium text-icloud-text-secondary hover:bg-icloud-text-primary/5 rounded-lg transition-colors"
          >
            Ignore
          </button>
          <button
            onClick={onSendReceipt}
            className="px-3 py-1.5 text-[12px] font-semibold text-white bg-icloud-accent hover:bg-icloud-accent-hover rounded-lg transition-colors shadow-sm"
          >
            Send Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
