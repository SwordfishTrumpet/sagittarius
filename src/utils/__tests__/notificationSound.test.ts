import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('notificationSound', () => {
  // Mock localStorage
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    vi.resetModules();
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
    });

    // Mock console
    vi.stubGlobal('console', {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be testable after module reset', async () => {
    // Import fresh after reset
    const { isNotificationSoundEnabled, getNotificationVolume } = await import('../notificationSound');
    expect(isNotificationSoundEnabled()).toBe(true);
    expect(getNotificationVolume()).toBe(0.5);
  });

  it('should persist settings to localStorage', async () => {
    const { setNotificationSoundEnabled, setNotificationVolume } = await import('../notificationSound');
    setNotificationSoundEnabled(false);
    expect(localStorageMock['sagittarius:notification-sound']).toContain('"enabled":false');
    
    setNotificationVolume(0.8);
    expect(localStorageMock['sagittarius:notification-sound']).toContain('"volume":0.8');
  });

  it('should clamp volume between 0 and 1', async () => {
    const { setNotificationVolume, getNotificationVolume } = await import('../notificationSound');
    setNotificationVolume(1.5);
    expect(getNotificationVolume()).toBe(1.0);
    
    setNotificationVolume(-0.5);
    expect(getNotificationVolume()).toBe(0.0);
  });

  it('should load settings from localStorage', async () => {
    localStorageMock['sagittarius:notification-sound'] = JSON.stringify({ enabled: false, volume: 0.3 });
    
    // Need to re-import to pick up stored values
    vi.resetModules();
    const { isNotificationSoundEnabled, getNotificationVolume } = await import('../notificationSound');
    
    expect(isNotificationSoundEnabled()).toBe(false);
    expect(getNotificationVolume()).toBe(0.3);
  });
});
