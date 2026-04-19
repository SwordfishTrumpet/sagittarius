import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sun, User, Filter, Settings as SettingsIcon, Volume2, LucideIcon } from 'lucide-react';
import { VacationSettings } from './settings/VacationSettings';
import { IdentitySettings } from './settings/IdentitySettings';
import { SieveSettings } from './settings/SieveSettings';
import { IOSToggle } from './ui/IOSToggle';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useHasVacationCapability } from '../hooks/useVacation';
import { useHasSieveCapability } from '../hooks/useSieve';
import { useHasIdentityCapability } from '../hooks/jmap/useIdentities';
import {
  isNotificationSoundEnabled,
  getNotificationVolume,
  setNotificationSoundEnabled,
  setNotificationVolume,
  previewNotificationSound,
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

  return (
    <div className="p-6">
      <h2 className="text-[17px] font-semibold text-[#1C1C1E] mb-4">General</h2>
      <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#E5E5EA]">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[15px] text-[#1C1C1E]">App Version</span>
          <span className="text-[13px] text-[#6C6C70]">Sagittarius 1.0</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[15px] text-[#1C1C1E]">Protocol</span>
          <span className="text-[13px] text-[#6C6C70]">JMAP (RFC 8620 / 8621)</span>
        </div>
      </div>

      <h3 className="text-[15px] font-semibold text-[#1C1C1E] mt-6 mb-3">Notifications</h3>
      <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#E5E5EA]">
        {/* Sound toggle */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-[#6C6C70]" strokeWidth={1.5} />
            <span className="text-[15px] text-[#1C1C1E]">New mail sound</span>
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
            <label htmlFor="settings-volume" className="text-[13px] text-[#6C6C70] shrink-0 w-14">Volume</label>
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
              className="flex-1 h-1 accent-[#007AFF] rounded-full appearance-none bg-[#E5E5EA] cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#E5E5EA]
                [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border
                [&::-moz-range-thumb]:border-[#E5E5EA]"
            />
            <span className="text-[13px] text-[#6C6C70] w-10 text-right">{Math.round(volume * 100)}%</span>
          </div>
        )}
      </div>
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
      className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-center overflow-y-auto ${isMobile ? 'py-0' : 'py-8'}`}
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
        className={`relative bg-white shadow-2xl w-full flex overflow-hidden ${
          isMobile 
            ? 'flex-col h-full max-w-full rounded-none' 
            : 'rounded-2xl max-w-4xl mx-4'
        }`}
        style={isMobile ? undefined : { height: 'calc(100vh - 64px)', maxHeight: 680 }}
      >
        {/* Category nav: horizontal tabs on mobile, left sidebar on desktop */}
        <nav aria-label="Settings categories" className={`shrink-0 bg-[#F2F2F7] flex ${
          isMobile 
            ? 'flex-col border-b border-[#E5E5EA] py-3' 
            : 'flex-col w-[200px] border-r border-[#E5E5EA] py-4'
        }`}>
          <div className={`flex items-center justify-between ${isMobile ? 'px-4 pb-2' : 'px-4 pb-3'}`}>
            <p id="settings-dialog-title" className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">
              Settings
            </p>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-[#E5E5EA] hover:bg-[#D1D1D6] flex items-center justify-center transition-colors"
              aria-label="Close settings"
            >
              <X size={13} strokeWidth={2} className="text-[#636366]" />
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
                    ? 'bg-white text-[#007AFF] shadow-sm'
                    : 'text-[#1C1C1E] hover:bg-white/60'
                }`}
              >
                <Icon
                  width={16}
                  height={16}
                  strokeWidth={1.5}
                  className={selected === id ? 'text-[#007AFF]' : 'text-[#8E8E93]'}
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
