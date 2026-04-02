<p align="center">
  <img src="https://img.shields.io/badge/JMAP-RFC%208620%20%2F%208621-4A90D9?style=for-the-badge" alt="JMAP RFC 8620/8621">
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript Strict">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

<h1 align="center">Sagittarius</h1>

<p align="center">
  <strong>A beautiful, high-performance JMAP web client inspired by iCloud Mail</strong>
</p>

<p align="center">
  Server-agnostic. Standards-compliant. Privacy-first.
</p>

---

## Why Sagittarius?

Most webmail clients are either tied to a specific backend or feel like they were designed in 2005. Sagittarius is different:

- **Pure JMAP** — No proprietary protocols. Works with [Stalwart](https://stalw.art/), [Cyrus](https://www.cyrusimap.org/), [Apache James](https://james.apache.org/), or any RFC 8620/8621-compliant server.
- **Feels Native** — Glassmorphic three-pane layout, smooth animations, and keyboard-driven workflows that rival desktop apps.
- **Blazing Fast** — Virtual scrolling handles 10,000+ messages. Aggressive caching and incremental sync keep everything snappy.
- **Privacy by Default** — Remote images blocked until you approve them. Credentials never leak into logs.

---

## Features at a Glance

### Core Email

| Feature | Description |
|---------|-------------|
| **Three-Pane Layout** | Collapsible sidebar, message list, and reading pane with draggable borders |
| **Threaded Conversations** | Messages grouped by thread with per-message expand/collapse |
| **Rich Text Composer** | Tiptap-powered editor with formatting, attachments, and identity selection |
| **Reply / Reply All / Forward** | Smart recipient and subject prefilling with quoted message content |
| **Scheduled Send** | Queue emails to send at a specific date and time |
| **Draft Auto-Save** | Never lose a message — drafts persist automatically |

### Organization & Search

| Feature | Description |
|---------|-------------|
| **Folder Management** | Create, rename, delete, and nest folders via drag-and-drop |
| **Batch Operations** | Multi-select with Shift/Cmd+Click, move, delete, or flag in bulk |
| **Advanced Search** | `from:`, `to:`, `subject:`, `has:attachment` filters with highlighted snippets |
| **Quick Filters** | One-click filtering for Unread, Flagged, To Me, and Attachments |
| **Drag & Drop** | Move messages between folders or nest folders visually |

### Real-Time Sync

| Feature | Description |
|---------|-------------|
| **Incremental Sync** | `Email/changes` keeps your mailbox current without full reloads |
| **EventSource Push** | Instant notifications via Server-Sent Events with auto-reconnect |
| **WebSocket Push** | RFC 8887 JMAP-over-WebSocket for lowest-latency updates |
| **State Persistence** | Sync state survives page reloads via sessionStorage |

### Privacy & Security

| Feature | Description |
|---------|-------------|
| **Remote Image Blocking** | External images and CSS backgrounds blocked by default |
| **HTML Sanitization** | DOMPurify cleans every message before rendering |
| **Sandboxed Rendering** | Email bodies render in isolated iframes |
| **Credential Redaction** | Auth headers scrubbed from all logs |
| **Trusted URL Validation** | CID blob fetches only send credentials to your JMAP server |

### Attachments & Import

| Feature | Description |
|---------|-------------|
| **View & Download** | Preview inline or download any attachment |
| **Double-Click Open** | Open attachments directly in a new tab |
| **Drag & Drop Import** | Drop `.eml` files to import via `Email/import` |
| **Raw Email Viewer** | Inspect headers, MIME structure, and source via `Email/parse` |

### Settings & Automation

| Feature | Description |
|---------|-------------|
| **Identity Management** | Create, edit, and delete sending identities |
| **Vacation Responder** | Configure out-of-office messages with date ranges |
| **Sieve Filters** | Visual rule editor plus raw script mode with server-side validation |
| **Quota Display** | See storage usage at a glance in the sidebar |

### Extras

| Feature | Description |
|---------|-------------|
| **Read Receipts (MDN)** | Request and send read receipts per RFC 8098 |
| **Delivery Status** | Track whether sent emails were delivered |
| **Keyboard Shortcuts** | Navigate, reply, forward, star, delete — all without touching the mouse |
| **Loading Skeletons** | Smooth shimmer animations during data fetches |
| **Toast Notifications** | Apple-style alerts with undo support |
| **WCAG 2.1 AA Accessibility** | Full keyboard navigation, ARIA landmarks, focus traps, and live regions |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Next / Previous message |
| `Enter` | Open selected message |
| `r` | Reply |
| `R` | Reply All |
| `f` | Forward |
| `s` | Toggle star |
| `d` | Delete |
| `e` | Archive |
| `/` | Focus search |
| `Escape` | Clear selection / Close composer |
| `?` | Show shortcut help |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + N` | New message |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 18 (Vite) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS + Framer Motion |
| **State** | React Context + TanStack Query |
| **Editor** | Tiptap |
| **Virtualization** | react-virtuoso |
| **Icons** | Lucide React |
| **Sanitization** | DOMPurify |
| **Drag & Drop** | react-dnd |
| **Notifications** | sonner |

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- A JMAP server (RFC 8620/8621 compliant)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/AnomalyInnovations/sagittarius.git
cd sagittarius

# Install dependencies
npm install

# Configure your JMAP server
cp .env.example .env
# Edit .env and set VITE_JMAP_SERVER=https://your-jmap-server.example.com

# Start development server
npm run dev
```

Open **http://localhost:8081** and log in with your JMAP credentials.

### Production Build

```bash
npm run build
npm run preview
```

---

## Project Structure

```
src/
  api/           # JMAP client, session, EventSource & WebSocket push
  components/    # UI components (Sidebar, MessageList, EmailReader, Composer, ...)
    dialogs/     # Modal dialogs (folder CRUD, email parse, etc.)
    settings/    # Settings panels (identities, vacation, sieve filters)
  hooks/         # Custom hooks (useMailboxes, useEmails, useThreads, ...)
  types/         # TypeScript definitions
  utils/         # Helpers (date formatting, sanitization, search parsing, ...)
  App.tsx        # Main application shell
  main.tsx       # Entry point
```

---

## JMAP Capabilities

Sagittarius uses the following JMAP capabilities:

| Capability | Purpose |
|------------|---------|
| `urn:ietf:params:jmap:core` | Session bootstrap, request/response |
| `urn:ietf:params:jmap:mail` | Email, Mailbox, Thread, SearchSnippet |
| `urn:ietf:params:jmap:submission` | Send email, delivery status |
| `urn:ietf:params:jmap:vacationresponse` | Out-of-office |
| `urn:ietf:params:jmap:quota` | Storage quota |
| `urn:ietf:params:jmap:mdn` | Read receipts |
| `urn:ietf:params:jmap:blob` | Attachments, email import |
| `urn:ietf:params:jmap:websocket` | Real-time push (RFC 8887) |

Optional/extended capabilities (when available):

| Capability | Purpose |
|------------|---------|
| `urn:ietf:params:jmap:sieve` | Server-side mail filtering |

---

## Rendering Philosophy

Sagittarius renders email faithfully **without compromising security**:

1. **Sanitize, don't rewrite** — DOMPurify removes dangerous content but preserves sender formatting
2. **Isolated rendering** — Sandboxed iframes prevent email CSS from affecting the app
3. **Plain text preserved** — Text emails are escaped and wrapped in `<pre>` to honor whitespace
4. **CID resolution first** — Inline images are resolved to blob URLs before sanitization
5. **Remote content blocked** — External images require explicit user approval
6. **Auth only to trusted URLs** — Credentials are only sent to your configured JMAP server

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## Security

Found a vulnerability? Please follow the instructions in [SECURITY.md](SECURITY.md). Do not open a public issue.

---

## License

[MIT License](LICENSE) — use it, fork it, make it yours.

---

<p align="center">
  <sub>Built with coffee, curiosity, and an unhealthy obsession with email protocols.</sub>
</p>
