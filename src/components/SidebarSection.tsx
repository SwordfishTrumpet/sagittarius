/**
 * SidebarSection Component
 * Renders a collapsible section with header, chevron toggle, and optional action button
 * Used for "MAILBOXES" and "FOLDERS" sections in iCloud Mail design
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarSectionProps {
  title: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  children: React.ReactNode;
  actionButton?: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  };
}

export function SidebarSection({
  title,
  isExpanded,
  onToggleExpand,
  children,
  actionButton,
}: SidebarSectionProps) {
  const contentId = `${title.toLowerCase().replace(/\s+/g, '-')}-section-panel`;

  return (
    <div className="space-y-1">
      {/* Section Header */}
      <div className="flex items-center justify-between px-3 py-1.5 group">
        {/* Chevron + Title */}
        <button
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          className="flex items-center gap-1.5 flex-1 hover:opacity-70 transition-opacity"
        >
          <span className="text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white transition-colors">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            )}
          </span>
          <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
            {title}
          </span>
        </button>

        {/* Action Button (e.g., "+" for Folders) */}
        {actionButton && (
          <button
            onClick={actionButton.onClick}
            className="p-1 text-[#007AFF] dark:text-[#0A84FF] hover:bg-black/[0.05] dark:hover:bg-white/[0.10] rounded transition-colors opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            title={actionButton.label}
            aria-label={actionButton.label}
          >
            {actionButton.icon}
          </button>
        )}
      </div>

      {/* Section Content */}
      <div
        id={contentId}
        role="group"
        hidden={!isExpanded}
        aria-hidden={!isExpanded}
        className={isExpanded ? 'space-y-0.5 animate-in fade-in duration-200' : 'hidden'}
      >
          {children}
      </div>
    </div>
  );
}
