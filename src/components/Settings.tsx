import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sun, User, Filter, Settings as SettingsIcon, Volume2, Bell, BellOff, AlertCircle, LucideIcon, Moon } from 'lucide-react';
import { VacationSettings } from './settings/VacationSettings';
import { IdentitySettings } from './settings/IdentitySettings';
import { SieveSettings } from './settings/SieveSettings';
import { ThemeToggle } from './settings/ThemeToggle';
import { FontSelector } from './settings/FontSelector';
import { IOSToggle } from './ui/IOSToggle';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useHasVacationCapability } from '../hooks/useVacation';
import { useHasSieveCapability } from '../hooks/useSieve';
import { useHasIdentityCapability } from '../hooks/jmap/useIdentities';
import { useHasWebPushCapability, usePushSubscription } from '../hooks/usePushSubscription';
import {
  isNotificationSoundEnabled,
  getNotificationVolume,
  setNotificationSoundEnabled,
  setNotificationVolume,
  previewNotificationSound,
  isNotificationAPISupported,
  getNotificationPermission,
  requestNotificationPermission,
  canShowNotifications,
} from '../utils/notificationSound';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
}

type Category = 'general' | 'vacation' | 'identities' | 'filters';

const CATEGORIES: { id: Category; label: string; Icon: LucideIcon }[] = [
  { id: 'general', label: 'General', Icon: SettingsIcon },
  { id: 'vacation', label: 'Vacation', Icon: Sun },
  { id: 'identities', label: 'Identities', Icon: User },
  { id: 'filters', label: 'Filters', Icon: Filter },
];

function GeneralSettings() {
  const [soundEnabled, setSoundEnabled] = useState(isNotificationSoundEnabled);
  const [volume, setVolume] = useState(getNotificationVolume);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(getNotificationPermission);
  const [isRequesting, setIsRequesting] = useState(false);
  const hasWebPush = useHasWebPushCapability();
  const { existingSubs, subscribe, permission: webPushPermission } = usePushSubscription();
  const hasActiveSub = existingSubs && existingSubs.list && existingSubs.list.length > 0;
  const isWebPushGranted = webPushPermission === 'granted';

  // Refresh permission state when component mounts
  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setNotificationSoundEnabled(next);
    if (next) previewNotificationSound();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setNotificationVolume(v);
  };

  const handleVolumeCommit = () => {
    if (soundEnabled) previewNotificationSound();
  };

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestNotificationPermission();
      setPermission(getNotificationPermission());
      if (granted) {
        // Play a test sound to confirm it works
        previewNotificationSound();
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const isPermissionGranted = permission === 'granted';
  const isPermissionDenied = permission === 'denied';
  const isPermissionDefault = permission === 'default';
  const isSupported = permission !== 'unsupported';

  return (
    <div className="p-6">
      <h2 className="text-[17px] font-semibold text-icloud-text-primary mb-4">General</h2>
      <div className="bg-icloud-bg-layer2 rounded-2xl border border-icloud-border divide-y divide-icloud-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[15px] text-icloud-text-primary">App Version</span>
          <span className="text-[13px]  text-icloud-text-secondary">Sagittarius 1.0</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[15px] text-icloud-text-primary">Protocol</span>
          <span className="text-[13px]  text-icloud-text-secondary">JMAP (RFC 8620 / 8621)</span>
        </div>
      </div>

      <h3 className="text-[15px] font-semibold text-icloud-text-primary mt-6 mb-3">Appearance</h3>
      <div className="bg-icloud-bg-layer2 rounded-2xl border border-icloud-border p-4 space-y-6">
        <ThemeToggle />
        <div className="border-t border-icloud-border" />
        <FontSelector />
      </div>

      <h3 className="text-[15px] font-semibold text-icloud-text-primary mt-6 mb-3">Notifications</h3>
      <div className="bg-icloud-bg-layer2 rounded-2xl border border-icloud-border divide-y divide-icloud-border">
        {/* Notification permission status */}
        {isSupported && !isPermissionGranted && (
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BellOff className="w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} />
              <span className="text-[15px] text-icloud-text-primary">Desktop notifications</span>
            </div>
            <button
              onClick={handleRequestPermission}
              disabled={isPermissionDenied || isRequesting}
className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                 isPermissionDenied
                   ? 'bg-icloud-border dark:bg-icloud-gray5 text-icloud-text-secondary cursor-not-allowed'
                   : 'bg-icloud-accent text-white hover:bg-icloud-accent-hover'
               }`}
            >
              {isRequesting ? 'Requesting...' : isPermissionDenied ? 'Blocked' : 'Enable'}
            </button>
          </div>
        )}

        {/* Permission granted indicator */}
        {isPermissionGranted && (
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-icloud-green" strokeWidth={1.5} />
              <span className="text-[15px] text-icloud-text-primary">Desktop notifications</span>
            </div>
            <span className="text-[13px] text-icloud-green font-medium">Enabled</span>
          </div>
        )}

        {/* Permission denied warning */}
        {isPermissionDenied && (
          <div className="px-4 py-3 bg-icloud-red/5 dark:bg-icloud-red/15">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-icloud-red mt-0.5 shrink-0" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-[13px] text-icloud-text-primary font-medium">Notifications blocked</p>
                <p className="text-[12px]  text-icloud-text-secondary mt-1">
                  Enable notifications in your browser settings to receive new mail alerts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sound toggle - only show when notifications enabled or as fallback */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4  text-icloud-text-secondary" strokeWidth={1.5} />
            <span className="text-[15px] text-icloud-text-primary">New mail sound</span>
          </div>
          <IOSToggle
            checked={soundEnabled}
            onChange={handleToggleSound}
            ariaLabel="New mail sound"
          />
        </div>

        {/* Volume slider */}
        {soundEnabled && (
          <div className="px-4 py-3 flex items-center gap-4">
            <label htmlFor="settings-volume" className="text-[13px]  text-icloud-text-secondary shrink-0 w-14">Volume</label>
            <input
              id="settings-volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              onMouseUp={handleVolumeCommit}
              onTouchEnd={handleVolumeCommit}
              className="flex-1 h-1 accent-icloud-accent accent-icloud-accent rounded-full appearance-none bg-icloud-border dark:bg-icloud-gray4 cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white dark:[&::-webkit-slider-thumb]:bg-icloud-border [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-icloud-border dark:[&::-webkit-slider-thumb]:border-icloud-border
                [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-white dark:[&::-moz-range-thumb]:bg-icloud-border [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border
                [&::-moz-range-thumb]:border-icloud-border dark:[&::-moz-range-thumb]:border-icloud-border"
            />
            <span className="text-[13px]  text-icloud-text-secondary w-10 text-right">{Math.round(volume * 100)}%</span>
          </div>
        )}
      </div>

      {/* WebPush notification toggle (RFC 9749) */}
      {hasWebPush && (
        <div className="border-t border-icloud-border">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} />
              <span className="text-[15px] text-icloud-text-primary">Push notifications</span>
            </div>
            {hasActiveSub ? (
              <span className="text-[13px] text-icloud-green font-medium">Enabled</span>
            ) : isWebPushGranted ? (
              <button
                onClick={() => subscribe.mutate()}
                disabled={subscribe.isPending}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                  subscribe.isPending
                    ? 'bg-icloud-border text-icloud-text-secondary cursor-wait'
                    : 'bg-icloud-accent text-white hover:bg-icloud-accent-hover'
                }`}
              >
                {subscribe.isPending ? 'Enabling...' : 'Enable'}
              </button>
            ) : (
              <span className="text-[13px] text-icloud-text-tertiary">Allow notifications first</span>
            )}
          </div>
        </div>
      )}

      {/* Unsupported notice */}
      {!isSupported && (
        <div className="mt-4 px-4 py-3 bg-icloud-bg-layer1 rounded-xl">
          <p className="text-[13px]  text-icloud-text-secondary">
            Desktop notifications are not supported in this browser. Use the volume control for audio alerts.
          </p>
        </div>
      )}
    </div>
  );
}

export function Settings({ isOpen, onClose, isMobile = false }: SettingsProps) {
  const [selected, setSelected] = useState<Category>('general');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Capability checks to conditionally show settings sections
  const hasVacation = useHasVacationCapability();
  const hasIdentities = useHasIdentityCapability();
  const hasSieve = useHasSieveCapability();

  // Filter categories based on server capabilities
  const availableCategories = CATEGORIES.filter((cat) => {
    if (cat.id === 'vacation' && !hasVacation) return false;
    if (cat.id === 'identities' && !hasIdentities) return false;
    if (cat.id === 'filters' && !hasSieve) return false;
    return true;
  });

  useFocusTrap(dialogRef, { isActive: isOpen });

  const selectedIndex = availableCategories.findIndex(({ id }) => id === selected);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();

    let nextIndex = index;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = availableCategories.length - 1;
    else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % availableCategories.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + availableCategories.length) % availableCategories.length;

    setSelected(availableCategories[nextIndex].id);

    window.requestAnimationFrame(() => {
      document.getElementById(`settings-tab-${availableCategories[nextIndex].id}`)?.focus();
    });
  };

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, handleKey]);

  if (!isOpen) return null;

  return (
    /* Overlay */
    <div
      className={`fixed inset-0 z-[300] bg-icloud-bg-primary/30 backdrop-blur-sm flex items-start justify-center overflow-y-auto ${isMobile ? 'py-0' : 'py-8'}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal container */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        tabIndex={-1}
        className={`relative bg-icloud-bg-layer2 shadow-2xl w-full flex overflow-hidden ${
          isMobile 
            ? 'flex-col h-full max-w-full rounded-none' 
            : 'rounded-2xl max-w-4xl mx-4'
        }`}
        style={isMobile ? undefined : { height: 'calc(100vh - 64px)', maxHeight: 680 }}
      >
        {/* Category nav: horizontal tabs on mobile, left sidebar on desktop */}
        <nav aria-label="Settings categories" className={`shrink-0 bg-icloud-bg-layer1 bg-icloud-bg-primary flex ${
          isMobile 
            ? 'flex-col border-b border-icloud-border py-3' 
            : 'flex-col w-[200px] border-r border-icloud-border py-4'
        }`}>
          <div className={`flex items-center justify-between ${isMobile ? 'px-4 pb-2' : 'px-4 pb-3'}`}>
            <p id="settings-dialog-title" className="text-[11px] font-semibold text-icloud-text-secondary uppercase tracking-wide">
              Settings
            </p>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-icloud-border bg-icloud-card hover:bg-icloud-divider flex items-center justify-center transition-colors"
              aria-label="Close settings"
            >
              <X size={13} strokeWidth={2} className="text-icloud-text-secondary" />
            </button>
          </div>
          <div role="tablist" aria-orientation={isMobile ? 'horizontal' : 'vertical'} className={isMobile ? 'flex gap-1 px-2 overflow-x-auto' : ''}>
            {availableCategories.map(({ id, label, Icon }, index) => (
              <button
                key={id}
                id={`settings-tab-${id}`}
                role="tab"
                aria-selected={selected === id}
                aria-controls={`settings-panel-${id}`}
                tabIndex={selected === id ? 0 : -1}
                onClick={() => setSelected(id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`flex items-center gap-2.5 text-[14px] font-medium rounded-lg transition-colors ${
                  isMobile ? 'px-3 py-2 shrink-0' : 'px-4 py-2.5 mx-2'
                } ${
                  selected === id
                    ? 'bg-icloud-card text-icloud-accent shadow-sm'
                    : 'text-icloud-text-primary hover:bg-white/60 dark:hover:bg-icloud-text-primary/10'
                }`}
              >
                <Icon
                  width={16}
                  height={16}
                  strokeWidth={1.5}
                  className={selected === id ? 'text-icloud-accent' : 'text-icloud-text-secondary'}
                />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Right content area */}
        <div
          id={`settings-panel-${availableCategories[selectedIndex]?.id ?? 'general'}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${availableCategories[selectedIndex]?.id ?? 'general'}`}
          className="flex-1 overflow-y-auto"
        >
          {selected === 'general' && <GeneralSettings />}
          {selected === 'vacation' && <VacationSettings />}
          {selected === 'identities' && <IdentitySettings />}
          {selected === 'filters' && <SieveSettings />}
        </div>

      </div>
    </div>
  );
}
