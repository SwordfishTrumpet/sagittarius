import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuItemConfig {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  variant?: 'default' | 'destructive';
  submenu?: ContextMenuItemConfig[];
  divider?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItemConfig[];
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ items, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const submenuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [submenuPos, setSubmenuPos] = useState({ top: 0, left: 0 });
  const [adjustedPos, setAdjustedPos] = useState({ x, y });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeSubmenuIndex, setActiveSubmenuIndex] = useState(-1);

  const enabledItems = items.filter((item) => !item.disabled);

  const focusMainItem = useCallback((index: number) => {
    const target = itemRefs.current[index];
    if (target) {
      target.focus();
    }
    setActiveIndex(index);
  }, []);

  const focusSubmenuItem = (index: number) => {
    const target = submenuItemRefs.current[index];
    if (target) {
      target.focus();
    }
    setActiveSubmenuIndex(index);
  };

  const openSubmenu = (item: ContextMenuItemConfig, index: number, button?: HTMLButtonElement) => {
    if (!item.submenu || item.submenu.length === 0) return;

    const rect = (button || itemRefs.current[index])?.getBoundingClientRect();
    if (!rect) return;

    setSubmenuPos({
      top: rect.top - (menuRef.current?.getBoundingClientRect().top || 0),
      left: rect.right - (menuRef.current?.getBoundingClientRect().left || 0),
    });
    setActiveSubmenu(item.id);
    setActiveSubmenuIndex(0);
  };

  const closeSubmenu = () => {
    setActiveSubmenu(null);
    setActiveSubmenuIndex(-1);
  };

  useEffect(() => {
    // Adjust position to keep menu in viewport
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let newX = x;
      let newY = y;

      // Adjust X if menu goes off right edge
      if (x + rect.width > viewportWidth) {
        newX = viewportWidth - rect.width - 8;
      }

      // Adjust Y if menu goes off bottom edge
      if (y + rect.height > viewportHeight) {
        newY = viewportHeight - rect.height - 8;
      }

      setAdjustedPos({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    const firstEnabledIndex = items.findIndex((item) => !item.disabled);
    if (firstEnabledIndex >= 0) {
      window.requestAnimationFrame(() => focusMainItem(firstEnabledIndex));
    }
  }, [items, focusMainItem]);

  const handleItemClick = (item: ContextMenuItemConfig) => {
    if (!item.disabled && !item.submenu) {
      item.onSelect();
      onClose();
    }
  };

  const handleMouseEnter = (item: ContextMenuItemConfig, e: React.MouseEvent<HTMLButtonElement>) => {
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      setActiveIndex(index);
    }
    if (item.submenu && item.submenu.length > 0) {
      openSubmenu(item, index, e.currentTarget);
    } else {
      closeSubmenu();
    }
  };

  const handleMouseLeave = () => {
    closeSubmenu();
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Handle keyboard
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSubmenu) {
          closeSubmenu();
          focusMainItem(activeIndex);
          return;
        }
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, activeSubmenu, onClose]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (enabledItems.length === 0) return;

    const currentIndex = activeIndex >= 0 ? activeIndex : items.findIndex((item) => !item.disabled);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = items.findIndex((item, index) => index > currentIndex && !item.disabled);
      focusMainItem(next >= 0 ? next : items.findIndex((item) => !item.disabled));
      closeSubmenu();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const previous = [...items].map((item, index) => ({ item, index })).reverse().find(({ item, index }) => index < currentIndex && !item.disabled)?.index;
      const fallback = [...items].map((item, index) => ({ item, index })).reverse().find(({ item }) => !item.disabled)?.index ?? 0;
      focusMainItem(previous ?? fallback);
      closeSubmenu();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusMainItem(items.findIndex((item) => !item.disabled));
      closeSubmenu();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      const lastEnabled = [...items].map((item, index) => ({ item, index })).reverse().find(({ item }) => !item.disabled)?.index ?? 0;
      focusMainItem(lastEnabled);
      closeSubmenu();
      return;
    }

    const currentItem = items[currentIndex];
    if (!currentItem) return;

    if (event.key === 'ArrowRight' && currentItem.submenu?.length) {
      event.preventDefault();
      openSubmenu(currentItem, currentIndex);
      window.requestAnimationFrame(() => focusSubmenuItem(0));
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && !currentItem.disabled) {
      event.preventDefault();
      if (currentItem.submenu?.length) {
        openSubmenu(currentItem, currentIndex);
        window.requestAnimationFrame(() => focusSubmenuItem(0));
      } else {
        handleItemClick(currentItem);
      }
    }
  };

  const handleSubmenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, submenu: ContextMenuItemConfig[]) => {
    const enabledSubmenu = submenu.filter((item) => !item.disabled);
    if (enabledSubmenu.length === 0) return;

    const currentIndex = activeSubmenuIndex >= 0 ? activeSubmenuIndex : submenu.findIndex((item) => !item.disabled);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = submenu.findIndex((item, index) => index > currentIndex && !item.disabled);
      focusSubmenuItem(next >= 0 ? next : submenu.findIndex((item) => !item.disabled));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const previous = [...submenu].map((item, index) => ({ item, index })).reverse().find(({ item, index }) => index < currentIndex && !item.disabled)?.index;
      const fallback = [...submenu].map((item, index) => ({ item, index })).reverse().find(({ item }) => !item.disabled)?.index ?? 0;
      focusSubmenuItem(previous ?? fallback);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusSubmenuItem(submenu.findIndex((item) => !item.disabled));
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      const lastEnabled = [...submenu].map((item, index) => ({ item, index })).reverse().find(({ item }) => !item.disabled)?.index ?? 0;
      focusSubmenuItem(lastEnabled);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      closeSubmenu();
      focusMainItem(activeIndex);
      return;
    }

    const currentItem = submenu[currentIndex];
    if (!currentItem || currentItem.disabled) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      currentItem.onSelect();
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] py-1"
      style={{
        top: `${adjustedPos.y}px`,
        left: `${adjustedPos.x}px`,
      }}
    >
      <div className="bg-white/95 backdrop-blur-xl border border-[#E5E5E5] rounded-lg shadow-lg overflow-hidden" role="menu" aria-label="Context menu" onKeyDown={handleMenuKeyDown}>
        {items.map((item, index) => (
          <div key={item.id}>
            {item.divider && index > 0 && (
              <div className="h-[1px] bg-[#E5E5E5] my-1" role="separator" />
            )}
            <button
              ref={(element) => { itemRefs.current[index] = element; }}
              onClick={() => handleItemClick(item)}
              onMouseEnter={(e) => handleMouseEnter(item, e)}
              onMouseLeave={handleMouseLeave}
              disabled={item.disabled}
              role="menuitem"
              aria-haspopup={item.submenu?.length ? 'menu' : undefined}
              aria-expanded={item.submenu?.length ? activeSubmenu === item.id : undefined}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors relative ${
                item.variant === 'destructive'
                  ? 'text-[#FF3B30] hover:bg-[#FF3B30]/10 disabled:text-[#FF3B30]/40'
                  : 'text-[#1C1C1E] hover:bg-[#007AFF]/10 disabled:text-[#8E8E93]'
              } ${item.disabled ? 'cursor-not-allowed' : 'cursor-default'}`}
            >
              {item.icon && (
                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </span>
              )}
              <span className="flex-1 text-left">{item.label}</span>
              {item.submenu && item.submenu.length > 0 && (
                <ChevronRight className="w-3.5 h-3.5 opacity-50" strokeWidth={2} />
              )}
            </button>

            {/* Submenu */}
            {activeSubmenu === item.id && item.submenu && item.submenu.length > 0 && (
              <div
                className="fixed bg-white/95 backdrop-blur-xl border border-[#E5E5E5] rounded-lg shadow-lg overflow-hidden py-1"
                style={{
                  top: `${adjustedPos.y + submenuPos.top}px`,
                  left: `${adjustedPos.x + submenuPos.left + 4}px`,
                }}
                role="menu"
                aria-label={`${item.label} submenu`}
                onKeyDown={(event) => handleSubmenuKeyDown(event, item.submenu ?? [])}
              >
                {item.submenu.map((subitem, submenuIndex) => (
                  <button
                    ref={(element) => { submenuItemRefs.current[submenuIndex] = element; }}
                    key={subitem.id}
                    onClick={() => {
                      subitem.onSelect();
                      onClose();
                    }}
                    onMouseEnter={() => setActiveSubmenuIndex(submenuIndex)}
                    disabled={subitem.disabled}
                    role="menuitem"
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
                      subitem.variant === 'destructive'
                        ? 'text-[#FF3B30] hover:bg-[#FF3B30]/10 disabled:text-[#FF3B30]/40'
                        : 'text-[#1C1C1E] hover:bg-[#007AFF]/10 disabled:text-[#8E8E93]'
                    } ${subitem.disabled ? 'cursor-not-allowed' : 'cursor-default'}`}
                  >
                    {subitem.icon && (
                      <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                        {subitem.icon}
                      </span>
                    )}
                    <span>{subitem.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
