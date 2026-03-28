/**
 * Notification sound manager
 * Singleton module — imported by both Settings UI and useEventSource hook
 * Persists enabled state + volume to localStorage
 */

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
  } catch {
    // corrupt or unavailable — use defaults
  }
  return { ...DEFAULTS };
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // localStorage full or unavailable — ignore
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
    el.play().catch(() => {
      // Browser autoplay policy — silently skip
    });
  } catch {
    // Audio not supported
  }
}

/** Play a preview of the sound (always plays, ignores enabled toggle) */
export function previewNotificationSound() {
  try {
    const el = getAudio();
    el.currentTime = 0;
    el.play().catch(() => {});
  } catch {}
}
