import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['J', '↓'], desc: 'Next email' },
      { keys: ['K', '↑'], desc: 'Previous email' },
      { keys: ['Enter'], desc: 'Open email' },
      { keys: ['Esc'], desc: 'Close / Deselect' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['R'], desc: 'Reply' },
      { keys: ['⇧', 'R'], desc: 'Reply All' },
      { keys: ['F'], desc: 'Forward' },
      { keys: ['S'], desc: 'Toggle Star' },
      { keys: ['A'], desc: 'Archive' },
      { keys: ['D'], desc: 'Move to Trash' },
    ],
  },
  {
    title: 'Compose',
    shortcuts: [
      { keys: ['⌘', '⇧', 'N'], desc: 'New Message' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: ['⌘', 'A'], desc: 'Select All' },
      { keys: ['Esc'], desc: 'Clear Selection' },
    ],
  },
  {
    title: 'Interface',
    shortcuts: [
      { keys: ['⌘', 'B'], desc: 'Toggle Sidebar' },
      { keys: ['?'], desc: 'Keyboard Shortcuts' },
      { keys: ['/'], desc: 'Focus Search' },
    ],
  },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, { isActive: isOpen });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-white rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.15)] border border-[#E5E5EA] max-w-[560px] w-full max-h-[80vh] overflow-y-auto p-5 sm:p-8 mx-4 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-shortcuts-title"
            tabIndex={-1}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 id="keyboard-shortcuts-title" className="text-[20px] font-bold text-[#1C1C1E]">Keyboard Shortcuts</h2>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-[#E5E5EA] hover:bg-[#D1D1D6] flex items-center justify-center transition-colors"
                aria-label="Close keyboard shortcuts"
              >
                <X size={12} strokeWidth={2.5} className="text-[#636366]" />
              </button>
            </div>

            {/* Shortcut groups in responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-3">
                    {group.title}
                  </h3>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-[13px] text-[#3A3A3C]">{shortcut.desc}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {shortcut.keys.map((key, ki) => (
                            <kbd
                              key={ki}
                              className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-[#F2F2F7] border border-[#E5E5E5] rounded-md text-[12px] font-semibold text-[#1C1C1E] shadow-sm"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
