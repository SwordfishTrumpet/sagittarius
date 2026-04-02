# Changelog

All notable changes to Sagittarius will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-02

### Added
- Production-ready release with complete JMAP RFC 8620/8621 support
- Docker support with multi-stage build
- Comprehensive deployment documentation

### Security
- XSS prevention with DOMPurify HTML sanitization
- Credential redaction from all logs
- Sandboxed email rendering in isolated iframes
- Remote image blocking until user approval

### Performance
- Virtual scrolling for 10,000+ emails via react-virtuoso
- TanStack Query aggressive caching and background sync
- Incremental sync via Email/changes
- Memoization optimizations across components

### Type Safety
- Complete TypeScript strict mode compliance
- Eliminated all `any` type violations
- Comprehensive JMAP type definitions in `src/types/jmap.ts`
- Shared test utilities with `createTestEmail()` and `createTestMailbox()`

### Changed
- Extracted `buildEmailBody()` utility for DRY email body construction
- Created reusable `IOSToggle` component for settings
- Migrated all error handling to standardized `toastOperationError()`
- Refactored hooks to use proper Email/Mailbox types

### Fixed
- Memory leaks in SwipeableRow, MessageListItem, AttachmentItem, Composer
- Stale closure issues in useEmailSelection and Composer attachment state
- Race conditions in offline sync queue with proper rollback handling
- EventSource/WebSocket push notification handling

## [0.9.0] - 2026-03-31

### Added
- Sieve filter management (visual editor + raw script)
- Identity/alias management
- Vacation responder with date ranges
- Scheduled send functionality
- Email import via drag-and-drop (.eml files)
- Raw email viewer with MIME structure tree
- MDN read receipt support (RFC 8098)
- Delivery status tracking

### Changed
- Improved keyboard shortcut handling with proper input detection
- Enhanced error boundaries around Composer, Settings, Reading Pane

## [0.8.0] - 2026-03-28

### Added
- Threaded conversation view
- Batch selection with Shift/Cmd+Click
- Drag-and-drop folder nesting
- Advanced search with `from:`, `to:`, `has:attachment` syntax
- Search snippets with highlighted preview
- Quota display in sidebar
- Folder CRUD operations

### Fixed
- JMAP session resiliency with relative URL rewriting
- Graceful logout with connection cleanup

## [0.7.0] - 2026-03-25

### Added
- Three-pane layout with draggable borders
- Glassmorphic sidebar design
- Rich text composer with Tiptap editor
- Reply/Reply All/Forward with smart prefilling
- Draft auto-save and recovery
- Real-time push notifications (EventSource + WebSocket)

## [0.1.0] - 2026-03-20

### Added
- Initial project scaffolding (Vite + React + TypeScript + Tailwind)
- Basic JMAP authentication and session handling
- Mailbox and email fetching
- Reading pane with HTML sanitization

---

[1.0.0]: https://github.com/SwordfishTrumpet/sagittarius/releases/tag/v1.0.0
[0.9.0]: https://github.com/SwordfishTrumpet/sagittarius/releases/tag/v0.9.0
[0.8.0]: https://github.com/SwordfishTrumpet/sagittarius/releases/tag/v0.8.0
[0.7.0]: https://github.com/SwordfishTrumpet/sagittarius/releases/tag/v0.7.0
[0.1.0]: https://github.com/SwordfishTrumpet/sagittarius/releases/tag/v0.1.0
