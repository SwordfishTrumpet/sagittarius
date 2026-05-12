import React from 'react';
import { Type } from 'lucide-react';
import { MONOSPACE_FONTS, type MonospaceFontId } from '../../utils/monospaceFonts';
import { useFontPreference } from '../../hooks/useFontPreference';

/**
 * FontSelector — iOS-style monospace font selection component
 *
 * Displays a grid of font options with live preview.
 */
export function FontSelector() {
  const { fontId, setFontId, font } = useFontPreference();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Type className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.5} />
        <span className="text-[13px] font-medium text-[#1C1C1E] dark:text-white">
          Monospace Font
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {MONOSPACE_FONTS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFontId(f.id)}
            className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left ${
              fontId === f.id
                ? 'border-[#007AFF] bg-[#007AFF]/5 text-[#007AFF] dark:border-[#0A84FF] dark:bg-[#0A84FF]/10 dark:text-[#0A84FF]'
                : 'border-[#E5E5EA] hover:border-[#D1D1D6] dark:border-[#38383A] dark:hover:border-[#48484A]'
            }`}
            aria-pressed={fontId === f.id}
          >
            <span className="text-[14px] font-medium text-[#1C1C1E] dark:text-white">
              {f.name}
            </span>
            {f.ligatures && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#34C759]/10 text-[#34C759] font-medium">
                Ligatures
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Live preview */}
      <div className="p-3 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E]">
        <p className="text-[11px] text-[#8E8E93] mb-1">Preview</p>
        <code
          className="text-[14px] text-[#1C1C1E] dark:text-white block"
          style={{ fontFamily: font.family }}
        >
          {'=> hello_world() { return 42; }'}
        </code>
      </div>
    </div>
  );
}
