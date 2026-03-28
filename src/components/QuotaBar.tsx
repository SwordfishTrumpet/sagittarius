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
      <div className="h-[3px] w-full rounded-full bg-[#E5E5EA] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: critical ? '#FF3B30' : '#007AFF',
          }}
        />
      </div>

      {/* Label */}
      <p className="text-[10px] text-[#8E8E93] leading-none">
        {formatBytes(used)}{' '}
        <span className="text-[#C7C7CC]">of</span>{' '}
        {formatBytes(total)} used
        {critical && (
          <span className="ml-1 text-[#FF3B30] font-medium">— Almost full</span>
        )}
      </p>
    </div>
  );
}
