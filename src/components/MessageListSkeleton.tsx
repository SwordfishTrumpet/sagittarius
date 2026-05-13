export function MessageListSkeleton() {
  return (
    <div className="px-5 py-3.5 border-b border-icloud-border bg-icloud-bg-layer2 animate-pulse">
      <div className="flex justify-between items-baseline mb-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-[15px] h-[15px] bg-icloud-border rounded shrink-0" />
          <div className="h-4 bg-icloud-border rounded w-1/3" />
        </div>
        <div className="flex items-center gap-2 ml-4">
          <div className="h-3 bg-icloud-border rounded w-12" />
        </div>
      </div>
      <div className="flex items-start justify-between gap-2 mt-2">
        <div className="flex-1 min-w-0">
          <div className="h-3 bg-icloud-border rounded w-2/3 mb-2" />
          <div className="space-y-1">
            <div className="h-3 bg-icloud-border rounded w-full" />
            <div className="h-3 bg-icloud-border rounded w-4/5" />
          </div>
        </div>
        <div className="w-3.5 h-3.5 bg-icloud-border rounded shrink-0" />
      </div>
    </div>
  );
}
