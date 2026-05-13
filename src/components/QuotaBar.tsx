import React from 'react';

interface QuotaBarProps {
  used: number;
  total: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function QuotaBar({ used, total }: QuotaBarProps) {
  if (!total) return null;

  const pct = Math.min(100, (used / total) * 100);
  const critical = pct > 90;

  return (
    <div className="px-3 py-2 space-y-1.5">
      {/* Track */}
      <div
        className="h-[3px] w-full rounded-full bg-icloud-border  overflow-hidden"
        role="progressbar"
        aria-label={`Storage quota: ${formatBytes(used)} of ${formatBytes(total)} used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: critical ? 'var(--icloud-red)' : 'var(--icloud-accent)',
          }}
        />
      </div>

      {/* Label */}
      <p className="text-[10px]  leading-none">
        {formatBytes(used)}{' '}
        <span className="">of</span>{' '}
        {formatBytes(total)} used
        {critical && (
          <span className="ml-1 text-icloud-red font-medium">— Almost full</span>
        )}
      </p>
    </div>
  );
}
