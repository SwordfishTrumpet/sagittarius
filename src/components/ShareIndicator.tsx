import { Users } from 'lucide-react';

interface ShareIndicatorProps {
  shareWithCount: number;
  isSharedWithMe?: boolean;
}

export function ShareIndicator({ shareWithCount, isSharedWithMe }: ShareIndicatorProps) {
  if (shareWithCount === 0 && !isSharedWithMe) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-icloud-text-tertiary"
      title={isSharedWithMe ? 'Shared with you' : `Shared with ${shareWithCount} ${shareWithCount === 1 ? 'person' : 'people'}`}
      role="status"
    >
      <Users size={12} strokeWidth={1.25} aria-hidden="true" />
      {isSharedWithMe ? (
        <span>Shared with you</span>
      ) : shareWithCount > 0 ? (
        <span>{shareWithCount}</span>
      ) : null}
    </span>
  );
}
