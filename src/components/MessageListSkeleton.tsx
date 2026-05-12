export function MessageListSkeleton() {
  return (
    <div className="px-5 py-3.5 border-b border-[#E5E5E5] dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] animate-pulse">
      <div className="flex justify-between items-baseline mb-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-[15px] h-[15px] bg-[#E5E5E5] rounded shrink-0" />
          <div className="h-4 bg-[#E5E5E5] rounded w-1/3" />
        </div>
        <div className="flex items-center gap-2 ml-4">
          <div className="h-3 bg-[#E5E5E5] rounded w-12" />
        </div>
      </div>
      <div className="flex items-start justify-between gap-2 mt-2">
        <div className="flex-1 min-w-0">
          <div className="h-3 bg-[#E5E5E5] rounded w-2/3 mb-2" />
          <div className="space-y-1">
            <div className="h-3 bg-[#E5E5E5] rounded w-full" />
            <div className="h-3 bg-[#E5E5E5] rounded w-4/5" />
          </div>
        </div>
        <div className="w-3.5 h-3.5 bg-[#E5E5E5] rounded shrink-0" />
      </div>
    </div>
  );
}
