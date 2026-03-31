import { useRef, useState, useCallback } from 'react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<any>;
  enabled?: boolean;
}

const PULL_THRESHOLD = 60;
const MAX_PULL = 100;

/**
 * PullToRefresh — wraps a scrollable container to add pull-down-to-refresh.
 * Only activates when the inner container is scrolled to the top.
 * Shows a spinner while refreshing.
 */
export function PullToRefresh({ children, onRefresh, enabled = true }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isTracking = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || isRefreshing) return;
    // Only activate if scrolled to top
    const scrollContainer = containerRef.current?.querySelector('[data-virtuoso-scroller]') || containerRef.current;
    if (scrollContainer && scrollContainer.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    isTracking.current = true;
  }, [enabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTracking.current || !enabled || isRefreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    
    if (dy < 0) {
      // Scrolling up — don't interfere
      setPullDistance(0);
      return;
    }

    // Apply resistance
    const distance = Math.min(MAX_PULL, dy * 0.4);
    setPullDistance(distance);
  }, [enabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isTracking.current || !enabled) return;
    isTracking.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [enabled, pullDistance, isRefreshing, onRefresh]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center z-10 pointer-events-none transition-opacity"
        style={{
          top: 0,
          height: pullDistance,
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        {isRefreshing ? (
          <div className="w-5 h-5 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
        ) : (
          <div
            className="w-5 h-5 border-2 border-[#8E8E93] border-t-transparent rounded-full transition-transform"
            style={{
              transform: `rotate(${(pullDistance / PULL_THRESHOLD) * 360}deg)`,
              opacity: pullDistance / PULL_THRESHOLD,
            }}
          />
        )}
      </div>

      {/* Content with pull offset */}
      <div
        className="h-full"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isTracking.current ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
