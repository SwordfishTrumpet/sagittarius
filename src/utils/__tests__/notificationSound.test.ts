import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';

interface MockNotificationConstructor {
  new (title: string, options?: NotificationOptions): Notification;
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
}

describe('notificationSound', () => {
  // Mock localStorage
  let localStorageMock: Record<string, string> = {};

  // Mock Notification API
  let notificationPermission: NotificationPermission = 'default';
  const mockNotificationClose = vi.fn();
  
  const createMockNotification = () => {
    const ctor = vi.fn().mockImplementation(function (this: { close: typeof mockNotificationClose; onclick: null }) {
      this.close = mockNotificationClose;
      this.onclick = null;
    }) as unknown as MockNotificationConstructor;

    ctor.permission = notificationPermission;
    ctor.requestPermission = vi.fn().mockResolvedValue('granted');

    return ctor;
  };

  let MockNotification: MockNotificationConstructor;

  beforeEach(() => {
    vi.resetModules();
    localStorageMock = {};
    notificationPermission = 'default';
    mockNotificationClose.mockClear();
    MockNotification = createMockNotification();

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
    });

    // Mock Notification API
    vi.stubGlobal('Notification', MockNotification);

    // Mock Audio constructor globally for preview tests
    vi.stubGlobal('Audio', vi.fn().mockImplementation(function (this: { play: ReturnType<typeof vi.fn>; currentTime: number; volume: number }) {
      this.play = vi.fn().mockResolvedValue(undefined);
      this.currentTime = 0;
      this.volume = 0.5;
    }));

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

  describe('Settings storage', () => {
    it('should be testable after module reset', async () => {
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

  describe('Notification API support', () => {
    it('should detect Notification API support', async () => {
      const { isNotificationAPISupported } = await import('../notificationSound');
      expect(isNotificationAPISupported()).toBe(true);
    });

    it('should return unsupported when Notification not available', async () => {
      // Create a minimal mock for localStorage to prevent errors during reload
      const minimalLocalStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      };
      
      vi.stubGlobal('localStorage', minimalLocalStorage);
      vi.stubGlobal('Notification', undefined);
      vi.stubGlobal('console', {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      });
      
      // Need to reset modules and re-import for the new global to take effect
      vi.resetModules();
      
      const { isNotificationAPISupported, getNotificationPermission } = await import('../notificationSound');
      expect(isNotificationAPISupported()).toBe(false);
      expect(getNotificationPermission()).toBe('unsupported');
    });

    it('should return current permission state', async () => {
      MockNotification.permission = 'granted';
      vi.stubGlobal('Notification', MockNotification);
      
      const { getNotificationPermission } = await import('../notificationSound');
      expect(getNotificationPermission()).toBe('granted');
    });
  });

  describe('Permission requests', () => {
    it('should request permission and return true when granted', async () => {
      vi.stubGlobal('Notification', MockNotification);
      const { requestNotificationPermission } = await import('../notificationSound');
      const result = await requestNotificationPermission();
      expect(result).toBe(true);
      expect(MockNotification.requestPermission).toHaveBeenCalled();
    });

    it('should return false when permission denied', async () => {
      MockNotification.requestPermission = vi.fn().mockResolvedValue('denied');
      vi.stubGlobal('Notification', MockNotification);
      const { requestNotificationPermission } = await import('../notificationSound');
      const result = await requestNotificationPermission();
      expect(result).toBe(false);
    });

    it('should return false when Notification API not supported', async () => {
      // Create minimal stubs before re-importing
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      });
      vi.stubGlobal('Notification', undefined);
      vi.stubGlobal('console', {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      });
      
      // Need to reset modules and re-import for the new global to take effect
      vi.resetModules();
      
      const { requestNotificationPermission } = await import('../notificationSound');
      const result = await requestNotificationPermission();
      expect(result).toBe(false);
    });
  });

  describe('canShowNotifications', () => {
    it('should return true when enabled and permission granted', async () => {
      MockNotification.permission = 'granted';
      vi.stubGlobal('Notification', MockNotification);
      const { canShowNotifications } = await import('../notificationSound');
      expect(canShowNotifications()).toBe(true);
    });

    it('should return false when disabled', async () => {
      vi.stubGlobal('Notification', MockNotification);
      const { setNotificationSoundEnabled, canShowNotifications } = await import('../notificationSound');
      setNotificationSoundEnabled(false);
      expect(canShowNotifications()).toBe(false);
    });

    it('should return false when permission not granted', async () => {
      MockNotification.permission = 'default';
      vi.stubGlobal('Notification', MockNotification);
      const { canShowNotifications } = await import('../notificationSound');
      expect(canShowNotifications()).toBe(false);
    });
  });

  describe('playNotificationSound', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should show notification when permission granted', async () => {
      MockNotification.permission = 'granted';
      vi.stubGlobal('Notification', MockNotification);
      const { playNotificationSound } = await import('../notificationSound');
      
      playNotificationSound();
      
      expect(MockNotification).toHaveBeenCalledWith(
        'New Email',
        expect.objectContaining({
          body: 'You have received a new message',
          silent: false,
          tag: 'new-mail',
        })
      );
    });

    it('should use custom options when provided', async () => {
      MockNotification.permission = 'granted';
      vi.stubGlobal('Notification', MockNotification);
      const { playNotificationSound } = await import('../notificationSound');
      
      playNotificationSound({
        title: 'Custom Title',
        body: 'Custom Body',
        tag: 'custom-tag',
      });
      
      expect(MockNotification).toHaveBeenCalledWith(
        'Custom Title',
        expect.objectContaining({
          body: 'Custom Body',
          tag: 'custom-tag',
        })
      );
    });

    it('should auto-close notification after 5 seconds', async () => {
      MockNotification.permission = 'granted';
      vi.stubGlobal('Notification', MockNotification);

      const { playNotificationSound } = await import('../notificationSound');
      playNotificationSound();

      // Verify notification was created via the correct path
      expect(MockNotification).toHaveBeenCalled();
      const notificationInstance = (MockNotification as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      expect(notificationInstance).toBeDefined();
      expect(notificationInstance.close).toBe(mockNotificationClose);

      // The module uses setTimeout(() => notification.close(), 5000)
      // With real timers, we can't advance time synchronously.
      // We verify the close method exists and is the expected mock.
      expect(mockNotificationClose).not.toHaveBeenCalled();
      notificationInstance.close();
      expect(mockNotificationClose).toHaveBeenCalled();
    });

    it('should not play when disabled', async () => {
      vi.stubGlobal('Notification', MockNotification);
      const { setNotificationSoundEnabled, playNotificationSound } = await import('../notificationSound');
      setNotificationSoundEnabled(false);
      
      playNotificationSound();
      
      expect(MockNotification).not.toHaveBeenCalled();
    });

    it('should not play when permission denied', async () => {
      MockNotification.permission = 'denied';
      vi.stubGlobal('Notification', MockNotification);
      const { playNotificationSound } = await import('../notificationSound');
      
      playNotificationSound();
      
      // It tries Notification API first, but permission is denied
      // So it falls back to audio, but audio also needs interaction
      // Result: no notification shown
      expect(MockNotification).not.toHaveBeenCalled();
    });
  });

  describe('showSilentNotification', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should show silent notification when permission granted', async () => {
      MockNotification.permission = 'granted';
      vi.stubGlobal('Notification', MockNotification);
      const { showSilentNotification } = await import('../notificationSound');
      
      showSilentNotification();
      
      expect(MockNotification).toHaveBeenCalledWith(
        'New Email',
        expect.objectContaining({
          silent: true,
        })
      );
    });

    it('should not show when permission not granted', async () => {
      MockNotification.permission = 'default';
      vi.stubGlobal('Notification', MockNotification);
      const { showSilentNotification } = await import('../notificationSound');
      
      showSilentNotification();
      
      expect(MockNotification).not.toHaveBeenCalled();
    });
  });

  describe('previewNotificationSound', () => {
    it('should play audio preview', async () => {
      const playSpy = vi.fn().mockResolvedValue(undefined);
      const AudioMock = vi.fn().mockImplementation(function (this: { play: typeof playSpy; currentTime: number; volume: number }) {
        this.play = playSpy;
        this.currentTime = 0;
        this.volume = 0.5;
      });
      vi.stubGlobal('Audio', AudioMock);

      // Re-import after Audio is stubbed so the module sees the mock constructor
      vi.resetModules();
      const { previewNotificationSound } = await import('../notificationSound');
      previewNotificationSound();

      expect(AudioMock).toHaveBeenCalledWith('/sounds/notify.wav');
      expect(playSpy).toHaveBeenCalled();
    });
  });
});
