import React from 'react';
import { Type, Code, TextQuote } from 'lucide-react';
import { THEME_FONTS, type ThemeFontId, type FontCategory } from '../../utils/monospaceFonts';
import { useFontPreference } from '../../hooks/useFontPreference';

const categoryIcons: Record<FontCategory, React.ReactNode> = {
  sans: <Type className="w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} />,
  serif: <TextQuote className="w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} />,
  mono: <Code className="w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} />,
};

const categoryLabels: Record<FontCategory, string> = {
  sans: 'Sans-serif',
  serif: 'Serif',
  mono: 'Monospace',
};

export function FontSelector() {
  const { fontId, setFontId, font } = useFontPreference();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Type className="w-4 h-4 text-icloud-text-secondary" strokeWidth={1.5} />
        <span className="text-[13px] font-medium text-icloud-text-primary">
          Interface Font
        </span>
      </div>

      {(['sans', 'serif', 'mono'] as FontCategory[]).map((category) => {
        const fontsInCategory = THEME_FONTS.filter((f) => f.category === category);
        if (fontsInCategory.length === 0) return null;
        return (
          <div key={category}>
            <div className="flex items-center gap-1.5 mb-2">
              {categoryIcons[category]}
              <span className="text-[11px] font-semibold text-icloud-text-secondary uppercase tracking-wider">
                {categoryLabels[category]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fontsInCategory.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFontId(f.id)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left ${
                    fontId === f.id
                      ? 'border-icloud-accent bg-icloud-accent/5 text-icloud-accent'
                      : 'border-icloud-border hover:border-icloud-gray2 dark:hover:border-icloud-scrollbar-thumb'
                  }`}
                  aria-pressed={fontId === f.id}
                  style={{ fontFamily: f.family }}
                >
                  <span className="text-[14px] font-medium text-icloud-text-primary">
                    {f.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Live preview */}
      <div className="p-3 rounded-xl bg-icloud-bg-layer1">
        <p className="text-[11px] text-icloud-text-secondary mb-1">Preview</p>
        <p
          className="text-[14px] text-icloud-text-primary block leading-relaxed"
          style={{ fontFamily: font.family }}
        >
          The quick brown fox jumps over the lazy dog. 1234567890
        </p>
      </div>
    </div>
  );
}
