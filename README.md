# ♐ Sagittarius

A high-performance, server-agnostic JMAP web client with an interface inspired by iCloud Mail. Works with any RFC 8620/8621-compliant mail server.

**Standards-compliant. Privacy-first. Built for power users.**

[![Version](https://img.shields.io/badge/version-1.1.0-blue?style=flat-square)](CHANGELOG.md)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen?style=flat-square&logo=github-actions&logoColor=white)](.github/workflows/ci.yml)
[![JMAP RFC 8620/8621](https://img.shields.io/badge/JMAP-RFC%208620%20%2F%208621-4A90D9?style=flat-square)](https://jmap.io/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tests-1,303%20passing-6E9F18?style=flat-square&logo=vitest&logoColor=white)](package.json)
[![WCAG 2.2 AA](https://img.shields.io/badge/WCAG-2.2%20AA-1a73e8?style=flat-square)]()
[![License MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

## ✨ Why Sagittarius?

Sagittarius is a **frontend-only JMAP client** designed to work with any RFC 8620/8621-compliant mail server. Unlike proprietary webmail interfaces that lock you into a specific backend, Sagittarius gives you full control over your mail infrastructure while providing a polished, responsive user experience.

### 🖥️ Compatible JMAP Servers

- [Stalwart](https://stalw.art/) — Modern Rust-based mail server
- [Cyrus](https://www.cyrusimap.org/) — Battle-tested at enterprise scale
- [Apache James](https://james.apache.org/) — Enterprise Java solution
- Any server implementing **RFC 8620/8621**

---

## 📡 Full RFC Compliance

Sagittarius implements every major JMAP specification for a complete, standards-compliant experience:

| RFC / Draft | Specification | Feature |
|-------------|--------------|---------|
| **RFC 8620** | JMAP Core | Session management, request handling, push subscriptions, incremental sync, state tracking, `ifInState` conflict detection, `Email/changes` with `cannotCalculateChanges` fallback |
| **RFC 8621** | JMAP Mail | Email, Mailbox, Thread, Identity, EmailSubmission, SearchSnippet, VacationResponse, Email/query, Email/get, Thread/get, Mailbox/query, thread management, submission tracking, delivery status |
| **RFC 8887** | JMAP over WebSocket | Real-time push via WebSocket with auto-reconnect and exponential backoff |
| **RFC 9007** | MDN | Read receipt handling (`MDN/send`), in-reader banner for `Disposition-Notification-To` header |
| **RFC 9219** | S/MIME | Signature verification (`smimeStatus`/`smimeCertificate` on Email), `SmimeBadge` component, `Email/parseSmime` |
| **RFC 9404** | Blob Management | Blob/upload, Blob/get, Blob/lookup, Blob/copy, `maxDataSources` validation |
| **RFC 9425** | Quotas | Quota/query, Quota/get with sidebar progress bar |
| **RFC 9553** | JSContact | Contact card data format — individual, group, organization, location kinds |
| **RFC 9610** | JMAP for Contacts | AddressBook, ContactCard with JSContact format, AddressBook/get/set/query |
| **RFC 9661** | Sieve | SieveScript/get, /set, /validate, /activate — visual rule editor + raw script mode |
| **RFC 9670** | JMAP Sharing | Principal/get, Principal/query, ShareDialog, ShareIndicator — share calendars & address books |
| **RFC 9749** | WebPush with VAPID | PushSubscription/set, browser push notifications, service worker integration |
| **draft-ietf-jmap-calendars-26** | JMAP Calendars | Calendar, CalendarEvent (RFC 8984 JSCalendar), ParticipantIdentity, notifications, availability, recurrence |

### JMAP Capability Awareness

Sagittarius intelligently respects your server's JMAP capability limits for a better user experience:

| Capability | Limits Enforced |
|------------|-----------------|
| **Core (RFC 8620)** | `maxObjectsInGet/Set` — Chunked batch operations, `maxSizeUpload` — Per-file upload limit |
| **Mail (RFC 8621)** | `maxSizeAttachmentsPerEmail` — Total attachment size with live indicator, `maxMailboxDepth` — Folder nesting validation, `mayCreateTopLevelMailbox` — Controls root folder creation |
| **Sieve (RFC 9661)** | `maxNumberScripts` — Warns at filter limit, `maxSizeScript` — Rejects oversized scripts |
| **Calendar (draft-ietf-jmap-calendars-26)** | `maxCalendarsPerEvent` — Calendar limit per event, `maxParticipantsPerEvent` — Attendee limit warnings, `mayCreateCalendar` — Controls calendar creation, `minDateTime`/`maxDateTime` — Date range enforcement |
| **Contacts (RFC 9610)** | `mayCreateAddressBook` — Controls address book creation |
| **Blob (RFC 9404)** | `maxDataSources` — Validates blob upload data sources |
| **Sharing (RFC 9670)** | `maxPrincipals` — Limits sharing search results |
| **WebPush (RFC 9749)** | VAPID-based push subscription management |
| **S/MIME (RFC 9219)** | Signature verification via `Email/parseSmime` |

---

## ♿ WCAG 2.2 AA Accessibility

Every component meets WCAG 2.2 Level AA compliance through systematic implementation:

| Criterion | Requirement | Implementation |
|-----------|-------------|---------------|
| **1.1.1** | Non-text Content | `aria-label` on all icon-only controls |
| **1.3.1** | Info and Relationships | Semantic HTML landmarks, ARIA roles (`dialog`, `menu`, `tab`, `tree`, `switch`), tree semantics for folder hierarchy, menu semantics for context menus |
| **1.4.3** | Contrast (Minimum) | CSS custom properties (`text-icloud-text-primary/secondary/tertiary`) for proper dark mode contrast — no hardcoded hex colors |
| **2.1.1** | Keyboard | All actions keyboard-accessible, vim-style shortcuts, toggle switches operable via Space/Enter |
| **2.4.3** | Focus Order | Logical tab order throughout the application |
| **2.4.7** | Focus Visible | Visible focus ring on all interactive elements |
| **2.4.11** | Focus Not Obscured | Focus trapping in modals via shared `useFocusTrap` primitive with focus restoration |
| **2.5.7** | Dragging Gestures | "Move to…" context menu option for folders — keyboard-accessible alternative to drag-and-drop |
| **2.5.8** | Target Size (Minimum) | Interactive targets meet 24×24px minimum (Sign Out, attachment remove, minimized bar close, Cc/Bcc toggle) |
| **3.2.6** | Consistent Help | "Keyboard Shortcuts" menu item in toolbar "More" menu |
| **4.1.2** | Name, Role, Value | Proper ARIA roles, labels, live regions for screen reader announcements |
| | | `LiveRegion` component for polite app-level announcements |
| | | Automated accessibility testing with vitest-axe and `@axe-core/react` in dev mode |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- npm 10+
- A JMAP-compliant mail server

### Installation

```bash
git clone https://github.com/SwordfishTrumpet/sagittarius.git
cd sagittarius

npm install

cp .env.example .env
# Set VITE_JMAP_SERVER=https://your-jmap-server.example.com

npm run dev
```

Open `http://localhost:8081` and authenticate with your JMAP credentials.

---

## 🛠️ Deployment

### Option 1: Built-in Production Server

Sagittarius includes a production-ready Node.js server that serves static files and proxies JMAP requests:

```bash
npm run build

JMAP_SERVER=https://mail.example.com PORT=8081 node server.js
```

Features:
- Compressed static file serving
- JMAP proxy with auth injection
- Range header support for attachment downloads
- Graceful shutdown on SIGTERM

### Option 2: Static Hosting with Reverse Proxy

```bash
npm run build
# Deploy dist/ to Nginx, Apache, or CDN
```

Configure your web server to proxy `/jmap` to your JMAP backend. See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for server configurations.

### Option 3: Docker

```bash
docker build -t sagittarius .

docker run -p 8081:8081 -e JMAP_SERVER=https://mail.example.com sagittarius
```

### Nginx Reverse Proxy (HTTPS)

```nginx
server {
    listen 443 ssl;
    server_name mail.example.com;

    # Required for attachments (default nginx limit is 1MB)
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete configuration examples.

---

## 📋 Features

### ✉️ Email

| Feature | Description |
|---------|-------------|
| **Threaded Conversations** | Messages grouped by thread with per-message expand/collapse in list and stack view in reader |
| **Rich Text Composer** | Tiptap-powered editor (ProseMirror) with formatting, links, underline, placeholder text |
| **Reply / Reply All / Forward** | Smart recipient prefilling with quoted content via `quoteBuilder` |
| **Message Quoting** | Automatic previous message quoting with summary and header formatting |
| **Scheduled Send** | Queue emails for future delivery via `EmailSubmission/sendAt` with `ScheduleSendPicker` |
| **Draft Auto-Save / Recovery** | Automatic server-side persistence with debounced save timing |
| **Email Templates** | Save, edit, delete, duplicate reusable email formats stored per-account |
| **Batch Selection** | Multi-select with Shift/Cmd+Click and Select All |
| **Flagging (Starring)** | Toggle star (`\$flagged` keyword) on individual emails |
| **Conversation Snooze** | Temporarily remove emails from inbox with timed reappearance via `\$snoozed` keyword, `sessionStorage`-backed timers, and `SnoozePicker` time selection (Later Today, Tomorrow, Weekend, Next Week, Custom) |
| **Drag-and-Drop Organization** | Move emails between folders from the message list |
| **Email Import** | Drag & drop `.eml` files → blob upload → `Email/import` |
| **Email Parse (Raw Viewer)** | Raw email viewer with headers, text/html body, and MIME structure tree |
| **Attachment Handling** | View/Download in reader, upload in composer, double-click to open in new tab |
| **Attachment Deduplication** | Detect and prevent duplicate attachment uploads |
| **Blob Migration** | Migrate blobs between accounts |
| **Inline CID Images** | DOM-based CID image resolution for safe inline display |
| **Delivery Status** | `EmailSubmission/get` with `DeliveryStatus` badge for sent emails |
| **MDN Read Receipts** | `Disposition-Notification-To` detection with in-reader banner |
| **S/MIME Verification** | `smimeStatus`/`smimeCertificate` on Email with `SmimeBadge` component |
| **BIMI Sender Icons** | DNS-over-HTTPS lookup for Brand Indicators for Message Identification |
| **Identity/Alias Selection** | Select 'From' address in composer via `Identity/get` |
| **Connection Status** | Real-time push connection health badge in toolbar |

### 📁 Organization

| Feature | Description |
|---------|-------------|
| **Folder CRUD** | Create, Rename, Delete mailboxes via `Mailbox/set` |
| **Subfolder Hierarchy** | Recursive nested folders with expansion state and auto-classification of Inbox, Trash, Sent, etc. |
| **Folder Drag & Drop** | Reparent folders with visual drop zones (react-dnd) |
| **Custom Folder Tree** | Reorder, reparent, toggle expansion |
| **Folder Context Menu** | Right-click context menu for all folder actions |
| **Advanced Search** | `from:`, `to:`, `cc:`, `subject:`, `has:attachment`, `is:unread`, `is:flagged`, `is:draft`, `is:answered`, `before:`, `after:`, `header:Name`, `header:Name:value` |
| **Search Snippets** | Highlighted preview text in message list via `SearchSnippet/get` |
| **Search History** | Persistent search history with quick recall |
| **Quick Filters** | One-click filtering for Unread, Flagged, To Me, Attachments |
| **Filter Dialog** | Advanced filter dialog with checkbox and header filter sections |
| **Quota Display** | Storage usage indicator in sidebar with progress bar |
| **Sharing** | Share calendars and address books with other users (RFC 9670) |

### 📅 Calendar

| Feature | Description |
|---------|-------------|
| **Calendar View** | Full calendar component with month navigation |
| **Calendar CRUD** | Calendar/get, /set, /query operations |
| **Calendar Events** | CalendarEvent/get, /set with RFC 8984 JSCalendar recurrence support |
| **Participant Management** | ParticipantIdentity with RSVP support |
| **Event Notifications** | CalendarEventNotification support |
| **Availability** | Principal availability via `urn:ietf:params:jmap:principals:availability` |
| **Calendar Sharing** | Full calendar sharing with granular permissions (RFC 9670) |

### 👤 Contacts (RFC 9610)

| Feature | Description |
|---------|-------------|
| **Contacts View** | Full contacts list and detail view |
| **AddressBook CRUD** | AddressBook/get, /set, /query |
| **ContactCard Management** | ContactCard/get, /set with RFC 9553 JSContact format |
| **Group Contacts** | Support for individual, group, organization, location contact kinds |
| **Nested Name Filters** | Filter by name/given, name/surname |
| **AddressBook Sharing** | Share address books with granular permissions (RFC 9670) |

### 🔒 Security & Privacy

| Feature | Description |
|---------|-------------|
| **HTML Sanitization** | DOMPurify processes all email HTML content |
| **Remote Image Blocking** | External images and CSS backgrounds blocked until per-sender approval |
| **Sandboxed Email Rendering** | Isolated iframe prevents CSS/style leakage between email and UI |
| **CID Image Resolution** | DOM-based parsing (not regex) prevents XSS via malformed HTML |
| **XSS Prevention** | URL validation in composer link insertion prevents `javascript:` and dangerous protocols |
| **Credential Redaction** | Auth credentials never appear in JavaScript console or logs |
| **CSRF Protection** | `X-CSRF-Token` header on all JMAP requests |
| **Rate Limiting** | Auth rate limiting with account lockout after 5 failed attempts |
| **Timing Attack Prevention** | Consistent auth response times prevent username enumeration |
| **Content Security Policy** | Strict CSP: `default-src 'self'`, no `unsafe-inline`, no external `connect-src` |
| **Conflict Detection** | RFC 8620 `ifInState` validation prevents concurrent edit overwrites |
| **No Telemetry** | Zero analytics, tracking, or data collection — your data stays local |

### 📡 Real-Time & Push

| Feature | Description |
|---------|-------------|
| **EventSource Push** | Server-Sent Events for state change notifications with auto-reconnect |
| **WebSocket Push** | JMAP over WebSocket (RFC 8887) with auto-reconnect and exponential backoff |
| **WebPush** | Browser push notifications with VAPID (RFC 9749), service worker integration |
| **Connection Status Badge** | Live indicator: Live sync, Reconnecting, Manual sync, Offline, Pending sync |
| **New Mail Indicator** | Visual notification when new mail arrives via push |
| **Notification Sound** | Audio notification for new mail |
| **State Change Handling** | Unified handler for JMAP `StateChange` push notifications |

### 📴 Offline Support

| Feature | Description |
|---------|-------------|
| **Service Worker** | Offline caching and push notification handling via `sw.js` |
| **Web App Manifest** | PWA support with `manifest.webmanifest` |
| **IndexedDB Cache** | Dexie-based per-scope offline cache (mailboxes, emails, threads, etc.) |
| **Offline Sync Queue** | Deferred mutation queue replays when back online |
| **Network Status Detection** | `useNetworkStatus` hook with offline banner |
| **Cache Eviction** | TTL-based eviction with `maxAge`, `maxEntries`, `maxBytes` per scope |

### ⚙️ Settings & Configuration

| Feature | Description |
|---------|-------------|
| **Settings Pane** | Multi-tab settings modal (General, Vacation, Identities, Sieve Filters) |
| **Vacation Responder** | Out-of-office auto-reply with date range configuration |
| **Identity Management** | Create, edit, delete sending identities (aliases) |
| **Sieve Filters** | Visual rule editor with condition/action builder and raw script mode |
| **SieveScript Activate** | Dedicated activate method per RFC 9661 |
| **Theme Selection** | Light, Dark, and Auto (system preference) |
| **Interface Font Selection** | 6 font choices: JetBrains Mono, Inter, Oxanium, IBM Plex Sans, IBM Plex Serif, iCloud Default |
| **WebPush Toggle** | Enable/disable browser push notifications |
| **BIMI Toggle** | Enable/disable BIMI sender icons |

### 🎨 UI/UX

| Feature | Description |
|---------|-------------|
| **Three-Pane Layout** | Sidebar (250px) + Message List (350px) + Detail View (flexible) |
| **Responsive Pane Resizing** | Draggable borders with keyboard resize (Arrow keys + Home/End) |
| **Glassmorphic Design** | Translucent effects in both light and dark modes |
| **Light/Dark/Auto Theme** | Manual or system-preference-based theme selection |
| **Virtual Scrolling** | react-virtuoso for 10,000+ emails at 60fps |
| **Smooth Animations** | Framer Motion for animated email moves, transitions |
| **Skeleton Loaders** | Shimmer loading states with `animate-pulse` |
| **Toast Notifications** | Apple-style toasts with Undo support via sonner |
| **Mobile Responsive** | Three-pane collapses to single-pane with back navigation |
| **Mobile Gestures** | Pull-to-refresh and swipe-to-archive/delete on mobile |
| **Sidebar Toggle** | Cmd/Ctrl+B shortcut + ChevronRight expand button |
| **Dynamic Page Title** | Updates based on current view (mailbox, compose, settings) |
| **Live Region Announcements** | Screen reader announcements for loading states and selected emails |

### ⌨️ Keyboard Shortcuts

| `?` | Show shortcuts help modal |
|-----|--------|
| `j` / `↓` | Next message |
| `k` / `↑` | Previous message |
| `Enter` | Open selected message |
| `r` | Reply |
| `R` | Reply All |
| `f` | Forward |
| `s` | Toggle star |
| `a` / `e` | Archive |
| `d` / `#` | Delete |
| `/` | Focus search |
| `Escape` | Close modals, clear selection |
| `Cmd/Ctrl + A` | Select all |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + Shift + N` | New message |

---

## 🏗️ Architecture

<p align="left">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS"></a>
  <a href="https://tanstack.com/query/latest"><img src="https://img.shields.io/badge/TanStack_Query-FF4154?style=for-the-badge&logo=react&logoColor=white" alt="TanStack Query"></a>
  <a href="https://tiptap.dev/"><img src="https://img.shields.io/badge/Tiptap-563D7C?style=for-the-badge&logo=tiptap&logoColor=white" alt="Tiptap"></a>
  <a href="https://www.framer.com/motion/"><img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion"></a>
</p>

  - **[React 19](https://react.dev/)** — Vite 8-powered for fast HMR and optimized builds
- **[TypeScript 6](https://www.typescriptlang.org/)** — Strict mode for full type safety
- **[Tailwind CSS 4](https://tailwindcss.com/)** — Utility-first styling with iCloud-inspired design system
- **[TanStack Query](https://tanstack.com/query/latest)** — Server state management with aggressive caching and background sync
- **[Tiptap](https://tiptap.dev/)** — Rich text editing with extensible plugin system
- **[react-virtuoso](https://virtuoso.dev/)** — Virtual scrolling for 10,000+ emails
- **[Framer Motion](https://www.framer.com/motion/)** — Declarative animations
- **[react-dnd](https://react-dnd.github.io/)** — Drag and drop for folder management

### Project Structure

```
src/
├── api/              # JMAP client, WebSocket/EventSource push, session management
├── components/       # React UI components
│   ├── dialogs/      # Modal dialogs (Compose, Settings, Share, etc.)
│   ├── settings/     # Settings panels (General, Vacation, Filters, Identities)
│   └── ui/           # Reusable UI primitives (Button, Input, Card, Dialog, FocusTrap)
├── hooks/            # Custom React hooks
│   ├── jmap/         # JMAP data hooks (useMailboxes, useEmails, useThreads, etc.)
│   └── ui/           # UI interaction hooks
├── types/            # TypeScript type definitions (JMAP RFC types per specification)
└── utils/            # Helpers (sanitization, search, formatting, privacy, quotes)
```

---

## 📊 Stats

- **1,303 Tests** passing across 118 test files (all passing)
- **TypeScript 6 Strict Mode** — Full type safety (0 errors)
- **Full RFC Compliance** — JMAP 8620/8621, 8887, 9404, 9553, 9610, 9661, 9670, 9749, 9219, 9007, draft-ietf-jmap-calendars-26
- **WCAG 2.2 AA** accessibility compliant

---

## 📚 Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| [README.md](README.md) | Everyone | Overview, quick start, features |
| [CHANGELOG.md](CHANGELOG.md) | Users | Version history and breaking changes |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployers | Production deployment configurations (Docker, Nginx, etc.) |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Contributors | Development setup, architecture overview, testing |
| [JMAP_SERVER.md](docs/JMAP_SERVER.md) | Admins | Mail server configuration guide |
| [SECURITY.md](SECURITY.md) | Security researchers | Vulnerability reporting process |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributors | Pull request guidelines, code standards |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Contributors | Community standards |
| [REPOSITORY_GUIDE.md](REPOSITORY_GUIDE.md) | Developers | File structure, navigation guide |

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting issues and pull requests.

```bash
npm install       # Install dependencies
npm run dev       # Start development server
npm test          # Run tests
npm run typecheck # Type check
npm run build     # Production build
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built for the JMAP ecosystem. Not affiliated with Apple Inc.</sub>
</p>
