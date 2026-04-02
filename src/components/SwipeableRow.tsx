import { useRef, useState, useCallback, useEffect } from 'react';
import { Archive, Trash2 } from 'lucide-react';

interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;   // Delete/Trash
  onSwipeRight?: () => void;  // Archive
  enabled?: boolean;
}

const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = 80;

/**
 * SwipeableRow — wraps a message list item with iOS-style swipe actions.
 * Swipe right reveals Archive (blue), swipe left reveals Trash (red).
 * Designed for mobile touch interactions only.
 */
export function SwipeableRow({ children, onSwipeLeft, onSwipeRight, enabled = true }: SwipeableRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isTracking = useRef(false);
  const directionLocked = useRef<'horizontal' | 'vertical' | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    currentX.current = 0;
    isTracking.current = true;
    directionLocked.current = null;
    setIsAnimating(false);
  }, [enabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTracking.current || !enabled) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    // Lock direction after 10px of movement
    if (!directionLocked.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        directionLocked.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      return;
    }

    // If vertical scroll, don't interfere
    if (directionLocked.current === 'vertical') {
      return;
    }

    // Horizontal swipe — prevent vertical scrolling
    e.preventDefault();

    // Apply resistance after threshold
    let clampedDx = dx;
    const maxSwipe = ACTION_WIDTH * 2;
    if (Math.abs(dx) > ACTION_WIDTH) {
      const excess = Math.abs(dx) - ACTION_WIDTH;
      clampedDx = (dx > 0 ? 1 : -1) * (ACTION_WIDTH + excess * 0.3);
    }
    clampedDx = Math.max(-maxSwipe, Math.min(maxSwipe, clampedDx));

    // Only allow right swipe if archive handler exists, left if delete handler exists
    if (clampedDx > 0 && !onSwipeRight) clampedDx = 0;
    if (clampedDx < 0 && !onSwipeLeft) clampedDx = 0;

    currentX.current = clampedDx;
    setOffsetX(clampedDx);
  }, [enabled, onSwipeLeft, onSwipeRight]);

  const handleTouchEnd = useCallback(() => {
    if (!isTracking.current || !enabled) return;
    isTracking.current = false;

    setIsAnimating(true);

    if (currentX.current > SWIPE_THRESHOLD && onSwipeRight) {
      // Swipe right confirmed — archive
      setOffsetX(300);
      setTimeout(() => {
        onSwipeRight();
        setOffsetX(0);
        setIsAnimating(false);
      }, 200);
    } else if (currentX.current < -SWIPE_THRESHOLD && onSwipeLeft) {
      // Swipe left confirmed — delete
      setOffsetX(-300);
      setTimeout(() => {
        onSwipeLeft();
        setOffsetX(0);
        setIsAnimating(false);
      }, 200);
    } else {
      // Snap back
      setOffsetX(0);
      setTimeout(() => setIsAnimating(false), 200);
    }
  }, [enabled, onSwipeLeft, onSwipeRight]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden">
      {/* Right-swipe background (Archive) */}
      {offsetX > 0 && (
        <div 
          className="absolute inset-y-0 left-0 flex items-center justify-start pl-5 bg-[#007AFF]"
          style={{ width: Math.max(offsetX, ACTION_WIDTH) }}
        >
          <Archive 
            className={`w-5 h-5 text-white transition-transform ${offsetX > SWIPE_THRESHOLD ? 'scale-110' : ''}`} 
            strokeWidth={1.75} 
          />
        </div>
      )}

      {/* Left-swipe background (Trash) */}
      {offsetX < 0 && (
        <div 
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 bg-[#FF3B30]"
          style={{ width: Math.max(Math.abs(offsetX), ACTION_WIDTH) }}
        >
          <Trash2 
            className={`w-5 h-5 text-white transition-transform ${offsetX < -SWIPE_THRESHOLD ? 'scale-110' : ''}`} 
            strokeWidth={1.75} 
          />
        </div>
      )}

      {/* Swipeable content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isAnimating ? 'transform 200ms ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
