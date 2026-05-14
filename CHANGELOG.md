# Changelog

All notable changes to Sagittarius will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Nothing yet.

## [1.1.0] - 2026-05-14

### Added
- Email templates feature — Save and reuse common email formats
  - Create, edit, delete, and duplicate templates
  - Templates stored per-account in localStorage
  - Quick template insertion from composer toolbar
  - Templates include name, subject, body, and optional default recipients
- **RFC 9610 JMAP for Contacts** — Complete implementation
  - Type definitions for AddressBook and ContactCard (RFC 9553 JSContact)
  - Hooks: `useAddressBooks`, `useContactCards`, `useContactSearch`, `useContactCardQuery`
  - CRUD operations via `useAddressBookActions` and `useContactCardActions`
  - Sharing support (RFC 9670) with `AddressBookRights`
  - 21 new tests for full coverage
- **RFC 8984 JSCalendar** — Calendar and event management
  - Calendar, CalendarEvent, and recurrence support
  - Participant and alert handling
- **Monospaced font selection** — Choose from 6 coding fonts in Settings → Appearance
- **Email mutation conflict detection** — RFC 8620 `ifInState` validation on `Email/set`
  - Prevents silent overwrites when server state changes between read and write
  - State manager integration with automatic `newState` extraction after successful mutations

### Fixed
- **BUG 9 (P0):** Calendar event creation now properly initializes with default calendar
  - Fixed `handleSelectDate()` and `handleNewEvent()` to set `calendarId` from available calendars
  - Event form now properly initializes start/end times when creating new events
- **BUG 11 (P1):** FilterBar filtering now triggers immediate refetch
  - Added query invalidation in `useListFilters` when filters change
  - Ensures fresh data is fetched when toggling filters (unread, flagged, to me, attachments)
- Search functionality caching safeguards verified and enhanced
  - Confirmed `staleTime: 0` ensures refetch on search term changes
  - Query key properly includes search term for cache isolation

### Security
- Resolved `npm audit` vulnerabilities (`lodash-es`, `follow-redirects`, `postcss`)
- Added `esbuild` override to fix moderate severity transitive dependency

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
- MDN read receipt support (RFC 9007)
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
