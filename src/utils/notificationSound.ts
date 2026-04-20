/**
 * Notification sound manager using Web Notifications API
 * 
 * Primary method: Browser Notifications API (plays system sound, works
 * without prior user interaction after permission is granted once).
 * 
 * Fallback method: HTML5 Audio (blocked by autoplay policy until user
 * interacts with the page).
 * 
 * Cross-browser support: Chrome, Firefox, Safari, Edge (desktop & mobile)
 */

import { logger } from './logger';

const STORAGE_KEY = 'sagittarius:notification-sound';

interface NotificationSoundSettings {
  enabled: boolean;
  volume: number; // 0.0 – 1.0 (only used for HTML Audio fallback)
}

const DEFAULTS: NotificationSoundSettings = {
  enabled: true,
  volume: 0.5,
};

// In-memory state
let current: NotificationSoundSettings = load();

// Lazy audio element (fallback only)
let audio: HTMLAudioElement | null = null;

// Permission state cache
let permissionState: NotificationPermission | 'unsupported' = 'default';

function load(): NotificationSoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch (err) {
    logger.warn('[NotificationSound] Failed to load settings from localStorage:', err);
  }
  return { ...DEFAULTS };
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    logger.warn('[NotificationSound] Failed to persist settings to localStorage:', err);
  }
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/sounds/notify.wav');
  }
  audio.volume = current.volume;
  return audio;
}

// ---------- Permission Handling ----------

/**
 * Check if Notifications API is supported
 */
export function isNotificationAPISupported(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.Notification === 'function' &&
         'permission' in window.Notification;
}

/**
 * Get current notification permission state
 * Returns 'default' | 'granted' | 'denied' | 'unsupported'
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationAPISupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 * Returns true if granted, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationAPISupported()) {
    logger.warn('[NotificationSound] Notifications API not supported');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    permissionState = permission;
    logger.debug('[NotificationSound] Permission requested:', permission);
    return permission === 'granted';
  } catch (err) {
    logger.error('[NotificationSound] Error requesting permission:', err);
    return false;
  }
}

/**
 * Check if notifications are currently enabled and permitted
 */
export function canShowNotifications(): boolean {
  if (!current.enabled) return false;
  if (!isNotificationAPISupported()) return false;
  return Notification.permission === 'granted';
}

// ---------- Public Settings API ----------

export function isNotificationSoundEnabled(): boolean {
  return current.enabled;
}

export function getNotificationVolume(): number {
  return current.volume;
}

export function setNotificationSoundEnabled(enabled: boolean) {
  current.enabled = enabled;
  persist();
}

export function setNotificationVolume(volume: number) {
  current.volume = Math.max(0, Math.min(1, volume));
  persist();
}

// ---------- Sound Playback ----------

/**
 * Play notification using Notifications API (primary method)
 * Falls back to HTML Audio if notifications not available/permitted
 */
export function playNotificationSound(options?: {
  title?: string;
  body?: string;
  icon?: string;
  tag?: string;
}) {
  if (!current.enabled) return;

  // Try Notifications API first (works without user interaction after permission)
  if (isNotificationAPISupported() && Notification.permission === 'granted') {
    try {
      const title = options?.title ?? 'New Email';
      const notification = new Notification(title, {
        body: options?.body ?? 'You have received a new message',
        icon: options?.icon ?? '/favicon.svg',
        tag: options?.tag ?? 'new-mail',
        // Use system default sound - silent: false means use system sound
        silent: false,
        // Badge for mobile devices
        badge: '/favicon.svg',
        // Require user interaction on some platforms
        requireInteraction: false,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Handle click - focus the window
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      logger.debug('[NotificationSound] Notification displayed');
      return;
    } catch (err) {
      logger.warn('[NotificationSound] Notification failed, falling back to audio:', err);
    }
  }

  // Fallback: HTML5 Audio (may be blocked by autoplay policy)
  playAudioFallback();
}

/**
 * Play HTML5 Audio (fallback method)
 * Note: This may be blocked by browser autoplay policy
 */
function playAudioFallback() {
  try {
    const el = getAudio();
    el.currentTime = 0;
    el.play().catch((err) => {
      logger.debug('[NotificationSound] Audio playback prevented by browser policy:', err);
    });
  } catch (err) {
    logger.warn('[NotificationSound] Audio playback failed:', err);
  }
}

/**
 * Play a preview of the sound (always plays, ignores enabled toggle)
 * Uses HTML Audio since user just interacted with the toggle
 */
export function previewNotificationSound() {
  try {
    const el = getAudio();
    el.currentTime = 0;
    el.play().catch((err) => {
      logger.debug('[NotificationSound] Preview playback prevented:', err);
    });
  } catch (err) {
    logger.warn('[NotificationSound] Preview playback failed:', err);
  }
}

/**
 * Show a silent notification (visual only, no sound)
 * Used when user wants visual indicator but no audio
 */
export function showSilentNotification(options?: {
  title?: string;
  body?: string;
  icon?: string;
  tag?: string;
}) {
  if (!isNotificationAPISupported()) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(options?.title ?? 'New Email', {
      body: options?.body ?? 'You have received a new message',
      icon: options?.icon ?? '/favicon.svg',
      tag: options?.tag ?? 'new-mail',
      silent: true,
      badge: '/favicon.svg',
      requireInteraction: false,
    });

    setTimeout(() => notification.close(), 5000);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    logger.warn('[NotificationSound] Silent notification failed:', err);
  }
}
