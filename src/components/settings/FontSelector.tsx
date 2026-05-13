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
        <Type className="w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} />
        <span className="text-[13px] font-medium text-icloud-text-primary">
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
                ? 'border-icloud-accent bg-icloud-accent/5 text-icloud-accent'
                : 'border-icloud-border hover:border-[#D1D1D6] border-icloud-border dark:hover:border-[#48484A]'
            }`}
            aria-pressed={fontId === f.id}
          >
            <span className="text-[14px] font-medium text-icloud-text-primary">
              {f.name}
            </span>
            {f.ligatures && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-icloud-green/10 text-icloud-green font-medium">
                Ligatures
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Live preview */}
      <div className="p-3 rounded-xl bg-icloud-bg-layer1">
        <p className="text-[11px] text-icloud-text-secondary mb-1">Preview</p>
        <code
          className="text-[14px] text-icloud-text-primary block"
          style={{ fontFamily: font.family }}
        >
          {'=> hello_world() { return 42; }'}
        </code>
      </div>
    </div>
  );
}
