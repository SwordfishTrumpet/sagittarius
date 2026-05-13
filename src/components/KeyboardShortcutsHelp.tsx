import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
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

export function KeyboardShortcutsHelp({ isOpen, onClose, isMobile = false }: KeyboardShortcutsHelpProps) {
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
          className="fixed inset-0 z-[300] flex items-center justify-center bg-icloud-bg-primary/30 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-icloud-bg-layer2 rounded-2xl border border-icloud-border max-w-[560px] w-full max-h-[80vh] overflow-y-auto p-5 sm:p-8 mx-4 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-shortcuts-title"
            tabIndex={-1}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 id="keyboard-shortcuts-title" className="text-[20px] font-bold text-icloud-text-primary">Keyboard Shortcuts</h2>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-icloud-border bg-icloud-card hover:bg-icloud-divider   flex items-center justify-center transition-colors"
                aria-label="Close keyboard shortcuts"
              >
                <X size={12} strokeWidth={2.5} className="text-[#636366]" />
              </button>
            </div>

            {/* Mobile notice */}
            {isMobile && (
              <div className="mb-6 p-3 bg-icloud-bg-layer1 rounded-lg flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-icloud-accent shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#636366]">
                  These shortcuts work when using an external keyboard with your mobile device. 
                  Tap on screen elements for touch-based navigation.
                </p>
              </div>
            )}

            {/* Shortcut groups in responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="text-[11px] font-bold text-icloud-text-secondary uppercase tracking-wider mb-3">
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
                              className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-icloud-bg-layer1 border border-icloud-border text-icloud-text-primary shadow-sm"
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
