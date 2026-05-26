/**
 * RecursiveSidebarItem Component - Renders hierarchical mailbox structure
 * Features:
 * - Recursive rendering for nested folders
 * - Expand/collapse chevrons for parent folders
 * - Indentation based on folder depth
 * - Drag & drop support for email organization AND folder nesting
 * - Drop zones: top/bottom edges = reorder, center = nest inside
 * - Unread count display with recursive totals option
 * - Inline edit/delete for custom folders (right-click context menu)
 */

import React, { useState, useRef, useEffect, memo } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { ChevronRight, ChevronDown, MinusCircle } from 'lucide-react';
import { MailboxNode, getUnreadCountRecursive } from '../utils/mailboxTree';
import { logger } from '../utils/logger';

/** Maximum nesting depth for folders to prevent potential infinite loops with circular references */
const MAX_FOLDER_DEPTH = 10;

type DropPosition = 'before' | 'inside' | 'after' | null;

/** Drag item shape for react-dnd in this component */
interface DragItem {
  id: string;
  ids?: string[];
  allNodes?: MailboxNode[];
  parentId?: string | null;
}

/** Minimal monitor interface for react-dnd callbacks (avoiding internal types) */
interface DragMonitor {
  isOver(options?: { shallow?: boolean }): boolean;
  getClientOffset(): { x: number; y: number } | null;
  getItemType(): string | symbol | null;
}

interface RecursiveSidebarItemProps {
  node: MailboxNode;
  icon: React.ReactNode;
  selectedMailboxId: string | null;
  onSelect: (mailboxId: string) => void;
  onToggleExpand: (mailboxId: string) => void;
  onDrop: (emailIds: string[], mailboxId: string) => void;
  getMailboxIcon: (mailbox: MailboxNode) => React.ReactNode;
  showRecursiveUnread?: boolean;
  onRename?: (mailboxId: string, newName: string) => void;
  onDelete?: (mailboxId: string) => void;
  isCustomFolder?: boolean;
  onReorder?: (draggedId: string, targetId: string) => void;
  onReparent?: (draggedId: string, newParentId: string | null) => void;
  siblingNodes?: MailboxNode[];
  onContextMenu?: (mailboxId: string, mailboxName: string, e: React.MouseEvent) => void;
  /** Maximum depth to render children (prevents infinite loops with circular refs) */
  maxDepth?: number;
}

function isDescendant(nodes: MailboxNode[], parentId: string, childId: string): boolean {
  const find = (items: MailboxNode[]): boolean => {
    for (const n of items) {
      if (n.id === parentId) {
        // Check if childId is anywhere in this subtree
        const checkChildren = (children: MailboxNode[]): boolean => {
          for (const c of children) {
            if (c.id === childId) return true;
            if (checkChildren(c.children)) return true;
          }
          return false;
        };
        return checkChildren(n.children);
      }
      if (find(n.children)) return true;
    }
    return false;
  };
  return find(nodes);
}

export function RecursiveSidebarItem({
  node,
  icon,
  selectedMailboxId,
  onSelect,
  onToggleExpand,
  onDrop,
  getMailboxIcon,
  showRecursiveUnread = false,
  onRename,
  onDelete,
  isCustomFolder = false,
  onReorder,
  onReparent,
  siblingNodes,
  onContextMenu: onContextMenuProp,
  maxDepth = MAX_FOLDER_DEPTH,
}: RecursiveSidebarItemProps) {
  // Safety check: stop rendering if we've exceeded max depth (prevents circular ref loops)
  if (maxDepth <= 0) {
    logger.warn(`[RecursiveSidebarItem] Max depth exceeded at folder "${node.name}" (${node.id}). Stopping recursion to prevent infinite loop.`);
    return null;
  }

  const active = selectedMailboxId === node.id;
  const itemRef = useRef<HTMLDivElement | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);

  // Determine drop position based on mouse Y within the element
  const getDropPosition = (monitor: DragMonitor): DropPosition => {
    if (!itemRef.current || !monitor.isOver({ shallow: true })) return null;
    const hoverBoundingRect = itemRef.current.getBoundingClientRect();
    const hoverHeight = hoverBoundingRect.bottom - hoverBoundingRect.top;
    const clientOffset = monitor.getClientOffset();
    if (!clientOffset) return null;
    const hoverClientY = clientOffset.y - hoverBoundingRect.top;

    // Top 25% = before, bottom 25% = after, center 50% = inside (nest)
    if (hoverClientY < hoverHeight * 0.25) return 'before';
    if (hoverClientY > hoverHeight * 0.75) return 'after';
    return 'inside';
  };

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: ['EMAIL', 'MAILBOX'],
      canDrop: (item: DragItem, monitor: DragMonitor) => {
        const type = monitor.getItemType();
        if (type === 'MAILBOX') {
          // Can't drop on self
          if (item.id === node.id) return false;
          // Can't drop a parent into its own descendant (would create circular ref)
          if (item.allNodes && isDescendant(item.allNodes, item.id, node.id)) return false;
          return true;
        }
        return true;
      },
      hover: (item: DragItem, monitor: DragMonitor) => {
        const type = monitor.getItemType();
        if (type === 'MAILBOX') {
          setDropPosition(getDropPosition(monitor));
        } else {
          setDropPosition('inside');
        }
      },
      drop: (item: DragItem, monitor: DragMonitor) => {
        const type = monitor.getItemType();
        if (type === 'MAILBOX') {
          const pos = getDropPosition(monitor);
          if (pos === 'inside' && onReparent && item.id !== node.id) {
            // Nest: set parentId to this node
            onReparent(item.id, node.id);
          } else if ((pos === 'before' || pos === 'after') && item.id !== node.id) {
            // Reparent to same parent as target (moves out of subfolder if needed)
            const targetParentId = node.parentId ?? null;
            if (onReparent && item.parentId !== targetParentId) {
              onReparent(item.id, targetParentId);
            }
            if (onReorder) {
              onReorder(item.id, node.id);
            }
          }
          setDropPosition(null);
          return;
        }
        onDrop(item.ids || [item.id], node.id);
        setDropPosition(null);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [node.id, onDrop, onReorder, onReparent]
  );

  // Clear drop position when not hovering
  useEffect(() => {
    if (!isOver) setDropPosition(null);
  }, [isOver]);

  // Drag source for mailbox reordering/nesting
  const [{ isDraggingMailbox }, drag] = useDrag(
    () => ({
      type: 'MAILBOX',
      item: { id: node.id, parentId: node.parentId ?? null, allNodes: siblingNodes },
      canDrag: () => isCustomFolder,
      collect: (monitor) => ({
        isDraggingMailbox: monitor.isDragging(),
      }),
    }),
    [node.id, isCustomFolder, siblingNodes]
  );

  const hasChildren = node.children.length > 0;
  const unreadCount = showRecursiveUnread
    ? getUnreadCountRecursive(node)
    : node.unreadEmails;

  // Calculate indentation: 12px base + 16px per level (inline style — Tailwind purges dynamic classes)
  const indentPx = 12 + node.depth * 16;

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    onSelect(node.id);
  };

  const handleSaveRename = () => {
    if (editValue.trim() && editValue !== node.name && onRename) {
      onRename(node.id, editValue.trim());
    }
    setIsEditing(false);
    setEditValue(node.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(node.name);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      if (confirm(`Delete folder "${node.name}"?`)) {
        onDelete(node.id);
      }
    }
  };

  // Determine visual state for drop indicator
  const showDropBefore = isOver && canDrop && dropPosition === 'before';
  const showDropAfter = isOver && canDrop && dropPosition === 'after';
  const showDropInside = isOver && canDrop && dropPosition === 'inside';

  return (
    <div ref={(el) => { drop(el); drag(el); itemRef.current = el; }} role="presentation" className={`relative ${isDraggingMailbox ? 'opacity-40' : ''}`}>
      {/* Drop indicator: before (reorder line at top) */}
      {showDropBefore && (
        <div className="absolute top-0 left-3 right-3 h-[2px] bg-icloud-accent rounded-full z-10 shadow-[0_0_4px_rgba(0,122,255,0.4)]" />
      )}
      {/* Main folder item */}
      <div
        role="treeitem"
        aria-selected={active}
        aria-level={node.depth + 1}
        aria-expanded={hasChildren ? node.isExpanded : undefined}
        aria-current={active ? 'page' : undefined}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
            return;
          }

          if (hasChildren && e.key === 'ArrowRight' && !node.isExpanded) {
            e.preventDefault();
            onToggleExpand(node.id);
            return;
          }

          if (hasChildren && e.key === 'ArrowLeft' && node.isExpanded) {
            e.preventDefault();
            onToggleExpand(node.id);
          }
        }}
        onContextMenu={isCustomFolder && onContextMenuProp ? (e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenuProp(node.id, node.name, e);
        } : undefined}
        style={{ paddingLeft: `${indentPx}px` }}
        className={`flex items-center justify-between transition-all relative group cursor-default rounded-lg focus:outline-none focus:ring-2 focus:ring-icloud-accent
          ${
            active && !showDropInside
              ? 'bg-icloud-accent text-white shadow-md'
              : showDropInside
                ? 'bg-icloud-accent/15 ring-2 ring-icloud-accent text-icloud-accent scale-[1.02]'
                : 'hover:bg-black/[0.04] text-icloud-text-primary'
          }
          px-2 py-1.5`}
      >
        {/* Chevron or spacer */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className={`flex items-center justify-center min-w-[24px] min-h-[24px] w-5 h-5 shrink-0 transition-transform ${
              active && !showDropInside ? 'text-white' : 'text-icloud-accent'
            } hover:opacity-70`}
          >
            {node.isExpanded ? (
              <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
            ) : (
              <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
            )}
          </button>
        ) : (
          <div className="w-5 h-5 shrink-0" />
        )}

        {/* Delete button (appears in edit mode) */}
        {isEditing && isCustomFolder && (
          <button
            onClick={handleDeleteClick}
            className="flex items-center justify-center min-w-[24px] min-h-[24px] w-5 h-5 shrink-0 text-icloud-red hover:opacity-70 transition-opacity"
            title="Delete folder"
          >
            <MinusCircle className="w-4 h-4" strokeWidth={2} />
          </button>
        )}

        {/* Icon & label or input */}
        <div className="flex items-center gap-2 flex-1 overflow-hidden min-w-0">
          <span
            className={`shrink-0 ${active && !showDropInside ? 'text-white' : 'text-icloud-accent'}`}
          >
            {icon}
          </span>
          {isEditing && isCustomFolder ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveRename}
              className={`text-[14px] leading-none font-medium flex-1 min-w-0 px-1 rounded border-0 outline-none ${
                active
                  ? 'bg-white/20 dark:bg-white/10 text-white text-icloud-text-primary placeholder-white/60'
                  : 'bg-white/10 dark:bg-white/5 text-icloud-text-primary placeholder-icloud-text-tertiary'
              }`}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={`text-[14px] truncate leading-none ${
                active && !showDropInside ? 'font-semibold' : 'font-medium'
              }`}
            >
              {node.name}
            </span>
          )}
        </div>

        {/* Unread badge */}
        {!isEditing && unreadCount !== undefined && unreadCount > 0 && (
          <span
            className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
              active && !showDropInside
                ? 'bg-white/20 dark:bg-white/10 text-white text-icloud-text-primary'
                : 'bg-icloud-border text-icloud-text-secondary'
            }`}
          >
            {unreadCount}
          </span>
        )}
      </div>
      {/* Drop indicator: after (reorder line at bottom) */}
      {showDropAfter && (
        <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-icloud-accent rounded-full z-10 shadow-[0_0_4px_rgba(0,122,255,0.4)]" />
      )}

      {/* Children (expanded) */}
        {hasChildren && node.isExpanded && (
         <div role="group" className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <RecursiveSidebarItem
              key={child.id}
              node={child}
              icon={getMailboxIcon(child)}
              selectedMailboxId={selectedMailboxId}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onDrop={onDrop}
              getMailboxIcon={getMailboxIcon}
              showRecursiveUnread={showRecursiveUnread}
              onRename={onRename}
              onDelete={onDelete}
              isCustomFolder={isCustomFolder}
              onReorder={onReorder}
              onReparent={onReparent}
              siblingNodes={node.children}
              onContextMenu={onContextMenuProp}
              maxDepth={maxDepth - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders an entire mailbox hierarchy tree
 */
interface MailboxTreeProps {
  nodes: MailboxNode[];
  selectedMailboxId: string | null;
  onSelect: (mailboxId: string) => void;
  onToggleExpand: (mailboxId: string) => void;
  onDrop: (emailIds: string[], mailboxId: string) => void;
  getMailboxIcon: (mailbox: MailboxNode) => React.ReactNode;
  showRecursiveUnread?: boolean;
  onRename?: (mailboxId: string, newName: string) => void;
  onDelete?: (mailboxId: string) => void;
  onReorder?: (draggedId: string, targetId: string) => void;
  onReparent?: (draggedId: string, newParentId: string | null) => void;
  onContextMenu?: (mailboxId: string, mailboxName: string, e: React.MouseEvent) => void;
}

/**
 * Root-level drop zone at the bottom of the folder list.
 * Allows dragging nested folders back to the top level.
 */
function RootDropZone({ onReparent }: { onReparent?: (draggedId: string, newParentId: string | null) => void }) {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: 'MAILBOX',
      canDrop: (item: DragItem) => {
        // Only accept folders that are currently nested (have a parentId)
        return item.parentId != null;
      },
      drop: (item: DragItem) => {
        if (onReparent) {
          onReparent(item.id, null);
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [onReparent]
  );

  return (
    <div
      ref={drop as unknown as React.Ref<HTMLDivElement>}
      className={`h-6 rounded-lg transition-all ${
        isOver && canDrop
          ? 'bg-icloud-accent/10 ring-1 ring-icloud-accent/30'
          : ''
      }`}
    />
  );
}

export const MemoizedRecursiveSidebarItem = memo(RecursiveSidebarItem);

export function MailboxTree({
  nodes,
  selectedMailboxId,
  onSelect,
  onToggleExpand,
  onDrop,
  getMailboxIcon,
  showRecursiveUnread = false,
  onRename,
  onDelete,
  onReorder,
  onReparent,
  onContextMenu,
}: MailboxTreeProps) {
  return (
    <div role="tree" aria-label="Folders" className="space-y-0.5">
      {nodes.map((node) => (
        <MemoizedRecursiveSidebarItem
          key={node.id}
          node={node}
          icon={getMailboxIcon(node)}
          selectedMailboxId={selectedMailboxId}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onDrop={onDrop}
          getMailboxIcon={getMailboxIcon}
          showRecursiveUnread={showRecursiveUnread}
          onRename={onRename}
          onDelete={onDelete}
          isCustomFolder={true}
          onReorder={onReorder}
          onReparent={onReparent}
          siblingNodes={nodes}
          onContextMenu={onContextMenu}
        />
      ))}
      <RootDropZone onReparent={onReparent} />
    </div>
  );
}
