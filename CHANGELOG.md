# Changelog

All notable changes to Sagittarius will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Server-identity pinning (issue #1)** — the client now pins the identity of the configured JMAP backend (TLS certificate SHA-256 for https backends, resolved DNS addresses for http) via a new same-origin `GET /api/server-fingerprint` endpoint on `server.js`, `server.cjs`, and the Vite dev proxy. The fingerprint is stored with the session at first authentication and verified:
  - before any credential-bearing request is sent (a changed identity invalidates the stored session immediately);
  - at login (a changed identity requires explicit user confirmation before credentials are transmitted).
  Operators can allowlist trusted certificates with the `JMAP_TRUSTED_FINGERPRINTS` env var (comma-separated SHA-256 hashes, with or without the `sha256:` prefix).
- **JMAP error taxonomy** — new `ServerUnreachableError` / `AuthError` / `JMAPProtocolError` classes (`src/utils/jmapErrors.ts`) classify 401/403 (auth), 502/503/504 + network failures (server unreachable), and protocol errors across `authenticate()` and `request()`.
- **Server log credential redaction (issue #2)** — every `req.url` log site in `server.js` (EventSource, WebSocket upgrade, upload, proxy response lines) now passes through a shared `redactUrl()` (`scripts/serverUtils.cjs`), so live `access_token=` Basic-auth credentials never reach `server.log`. The shipped `nginx-webmail.conf` disables access logging on `/jmap` and `/jmap/ws` (where the query string carries credentials) and documents a no-query `log_format` for operators who want request logs.
- **Push reconnection circuit breaker (issue #3)** — `EventSourceManager` and `WebSocketManager` now classify never-connected failures as unreachable-class: after 3 consecutive failures with zero successful connections they stop retrying (terminal "Server unreachable" state in the connection badge, with a Retry affordance) instead of retrying forever against a dead backend. Once a connection has ever succeeded, failures keep the existing transient retry behavior. The SSE fallback in `usePushConnection` now starts only after WebSocket gives up — never while WS is still retrying — so only one push transport runs at a time.
- **Login outage classification (issue #4)** — the login card now shows the configured backend hostname (from `/api/server-fingerprint`, available even during an outage); server-unreachable errors display "Mail server unreachable (<host>)" instead of "check your credentials"; only genuine 401/403 auth failures count against the auth rate limiter — network/server/protocol failures never increment the counter and can never trigger the 15-minute lockout.

### Changed
- `server.js` logs the actual bound listen port (`server.address().port`) instead of the configured env value, enabling ephemeral-port boot (needed by the new boot test).

## [1.2.0] - 2026-08-05

### Added
- **Multi-account is now fully active** — `AccountProvider` is mounted and the
  active account is synced into the JMAP client, so account switching affects
  all data hooks (previously the provider existed but was never mounted).
- **Scheduled Send is capability-gated** — the schedule picker now appears only
  when the server advertises `maxDelayedSend`; previously it was hard-coded
  off even when the backend supported `EmailSubmission/sendAt`.
- **BIMI DNS hardening** — `/api/bimi-dns` now validates the domain with a
  strict regex and rate-limits per IP (anti-DNS-amplification).

### Changed
- **Security patch set** — upgraded `dompurify` (XSS sanitizer bypass fix),
  `http-proxy-middleware` (CRLF injection + Host-header routing bypass fix),
  `postcss`, `undici`, `body-parser`, `esbuild`. `npm audit` is now clean (0
  vulnerabilities).
- **CSP hardening** — `img-src` no longer allows insecure `http:` images
  (mixed-content prevention).
- **`JMAP_HOST` default derived** — when unset, the proxy Host header now
  comes from `JMAP_SERVER` instead of a hard-coded example domain. An explicit
  `JMAP_HOST` env var still overrides.
- **Reader multipart support** — the reading pane walks all body parts and
  picks the richest non-empty HTML/text part instead of only `[0]`.
- **Reader error recovery** — the error state Retry button refetches the detail
  query instead of reloading the page.
- **Unread filter note** — `is:unread`/Unread list filter continues to use the
  client-side fallback (see TODO.md BUG-2026-017 blocker).

### Fixed
- 51 runtime/semantic bugs from the full code-path audit (see TODO.md
  Completed — 2026-08-05 Bug Audit Fixes): auth case-insensitivity (RFC 7617),
  request timeout with external abort signals, offline replay `ifInState`
  refresh, folder cycle prevention, composer upload limits, draft retention on
  save failure, snooze past-date rejection, keyboard-shortcut input guards,
  and more.

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
- **draft-ietf-jmap-calendars-26 / RFC 8984 JSCalendar** — Calendar and event management
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
- Resolved remaining `any` type issues across codebase
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
