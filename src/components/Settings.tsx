import React, { useState, useEffect, useCallback } from 'react';
import { X, Sun, User, Filter, Settings as SettingsIcon, Volume2 } from 'lucide-react';
import { VacationSettings } from './settings/VacationSettings';
import { IdentitySettings } from './settings/IdentitySettings';
import { SieveSettings } from './settings/SieveSettings';
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

const CATEGORIES: { id: Category; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
  { id: 'general', label: 'General', Icon: SettingsIcon as any },
  { id: 'vacation', label: 'Vacation', Icon: Sun as any },
  { id: 'identities', label: 'Identities', Icon: User as any },
  { id: 'filters', label: 'Filters', Icon: Filter as any },
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
          <span className="text-[13px] text-[#8E8E93]">Sagittarius 1.0</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[15px] text-[#1C1C1E]">Protocol</span>
          <span className="text-[13px] text-[#8E8E93]">JMAP (RFC 8620 / 8621)</span>
        </div>
      </div>

      <h3 className="text-[15px] font-semibold text-[#1C1C1E] mt-6 mb-3">Notifications</h3>
      <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#E5E5EA]">
        {/* Sound toggle */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.5} />
            <span className="text-[15px] text-[#1C1C1E]">New mail sound</span>
          </div>
          <button
            onClick={handleToggleSound}
            className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 ${
              soundEnabled ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
            }`}
          >
            <span
              className={`absolute left-0 top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                soundEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
        </div>

        {/* Volume slider */}
        {soundEnabled && (
          <div className="px-4 py-3 flex items-center gap-4">
            <span className="text-[13px] text-[#8E8E93] shrink-0 w-14">Volume</span>
            <input
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
            <span className="text-[13px] text-[#8E8E93] w-10 text-right">{Math.round(volume * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Settings({ isOpen, onClose, isMobile = false }: SettingsProps) {
  const [selected, setSelected] = useState<Category>('general');

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
        className={`relative bg-white shadow-2xl w-full flex overflow-hidden ${
          isMobile 
            ? 'flex-col h-full max-w-full rounded-none' 
            : 'rounded-2xl max-w-4xl mx-4'
        }`}
        style={isMobile ? undefined : { height: 'calc(100vh - 64px)', maxHeight: 680 }}
      >
        {/* Category nav: horizontal tabs on mobile, left sidebar on desktop */}
        <nav className={`shrink-0 bg-[#F2F2F7] flex ${
          isMobile 
            ? 'flex-col border-b border-[#E5E5EA] py-3' 
            : 'flex-col w-[200px] border-r border-[#E5E5EA] py-4'
        }`}>
          <div className={`flex items-center justify-between ${isMobile ? 'px-4 pb-2' : 'px-4 pb-3'}`}>
            <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">
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
          <div className={isMobile ? 'flex gap-1 px-2 overflow-x-auto' : ''}>
            {CATEGORIES.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setSelected(id)}
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
        <div className="flex-1 overflow-y-auto">
          {selected === 'general' && <GeneralSettings />}
          {selected === 'vacation' && <VacationSettings />}
          {selected === 'identities' && <IdentitySettings />}
          {selected === 'filters' && <SieveSettings />}
        </div>

      </div>
    </div>
  );
}
