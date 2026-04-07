/**
 * Notification sound manager
 * Singleton module — imported by both Settings UI and useEventSource hook
 * Persists enabled state + volume to localStorage
 */

import { logger } from './logger';

const STORAGE_KEY = 'sagittarius:notification-sound';

interface NotificationSoundSettings {
  enabled: boolean;
  volume: number; // 0.0 – 1.0
}

const DEFAULTS: NotificationSoundSettings = {
  enabled: true,
  volume: 0.5,
};

// In-memory state (fast reads, no parse overhead per call)
let current: NotificationSoundSettings = load();

// Lazy audio element
let audio: HTMLAudioElement | null = null;

function load(): NotificationSoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch (err) {
    // corrupt or unavailable — use defaults
    logger.warn('[NotificationSound] Failed to load settings from localStorage:', err);
  }
  return { ...DEFAULTS };
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    // localStorage full or unavailable — ignore
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

// ---------- Public API ----------

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

/** Play the notification chime (respects enabled + volume settings) */
export function playNotificationSound() {
  if (!current.enabled) return;
  try {
    const el = getAudio();
    el.currentTime = 0;
    el.play().catch((err) => {
      // Browser autoplay policy — log but don't throw
      logger.debug('[NotificationSound] Playback prevented by browser policy:', err);
    });
  } catch (err) {
    // Audio not supported
    logger.warn('[NotificationSound] Audio playback failed:', err);
  }
}

/** Play a preview of the sound (always plays, ignores enabled toggle) */
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
