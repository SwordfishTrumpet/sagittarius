# Sagittarius

A high-performance, server-agnostic **JMAP web client** with the aesthetic and user experience of iCloud Mail. Works with any [RFC 8620](https://datatracker.ietf.org/doc/html/rfc8620) / [RFC 8621](https://datatracker.ietf.org/doc/html/rfc8621) compliant JMAP server.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Overview

Sagittarius is a modern email client built entirely on the JMAP standard. It provides a polished three-pane mail interface with glassmorphic design, real-time push notifications, virtual scrolling for large mailboxes, and a rich-text composer -- all running in the browser with zero server-side rendering.

### Key Highlights

- **Standards-first** -- Pure JMAP (RFC 8620/8621) with no proprietary extensions required
- **Server-agnostic** -- Works with Stalwart, Cyrus, Apache James, or any compliant JMAP server
- **Real-time** -- EventSource and WebSocket push (RFC 8887) for instant updates
- **Performant** -- Virtual scrolling handles 10,000+ messages; aggressive caching via TanStack Query
- **Privacy-aware** -- Remote image blocking, credential redaction in logs, DOMPurify sanitization

---

## Features

| Category | Details |
|---|---|
| **Mail Operations** | Read, compose, reply, reply-all, forward, draft auto-save, scheduled send |
| **Organization** | Folders (CRUD), subfolder hierarchy, drag-and-drop reparenting, flagging, batch selection |
| **Search** | Real-time JMAP query, advanced filters (`from:`, `to:`, `has:attachment`), search snippets with highlighting |
| **Threads** | Conversation grouping via `Thread/get`, per-message expand/collapse, reply to specific message |
| **Composer** | Rich text (Tiptap), identity/alias selection, attachments, message quoting, MDN read receipts |
| **Sync** | Incremental sync via `Email/changes`, EventSource push, WebSocket push, state persistence |
| **Attachments** | Inline viewing, download, double-click open, drag-and-drop `.eml` import |
| **Settings** | Vacation/OOO responder, identity management, Sieve filter editor (visual + raw script) |
| **Advanced** | Email/parse (raw viewer + MIME tree), delivery status tracking, quota display |
| **UX** | Keyboard shortcuts, filter bar, loading skeletons, toast notifications with undo, responsive pane resizing |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 (Vite) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + Framer Motion |
| State | React Context + TanStack Query |
| Editor | Tiptap (rich text) |
| Virtualization | react-virtuoso |
| Icons | Lucide React (1.25px stroke) |
| Sanitization | DOMPurify |
| Drag & Drop | react-dnd |
| Notifications | sonner |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- A running JMAP server (RFC 8620/8621 compliant)

### Installation

```bash
git clone https://github.com/SwordfishTrumpet/sagittarius.git
cd sagittarius
npm install
```

### Configuration

Copy the example environment file and set your JMAP server URL:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_JMAP_SERVER=https://your-jmap-server.example.com
```

### Development

```bash
npm run dev
```

The app starts on **http://localhost:8081**. Vite proxies JMAP API requests to your configured server.

### Production Build

```bash
npm run build
npm run preview
```

---

## Project Structure

```
src/
  api/           # JMAP client, session management, EventSource & WebSocket push
  components/    # UI components (Sidebar, MessageList, EmailReader, Composer, ...)
    dialogs/     # Modal dialogs (create/rename/delete folder)
    settings/    # Settings panels (identities, vacation, sieve filters)
  hooks/         # Custom React hooks (useMailboxes, useEmails, useThreads, ...)
  types/         # TypeScript type definitions
  utils/         # Helpers (date formatting, HTML sanitization, search parsing, ...)
  App.tsx        # Main application shell (three-pane layout)
  main.tsx       # Entry point
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate messages |
| `r` | Reply |
| `R` | Reply All |
| `f` | Forward |
| `s` | Toggle star |
| `d` | Delete |
| `/` | Focus search |
| `?` | Show shortcut help |
| `Cmd+B` | Toggle sidebar |

---

## JMAP Capabilities Used

Sagittarius leverages the following JMAP capabilities:

- `urn:ietf:params:jmap:core` -- Session, request/response
- `urn:ietf:params:jmap:mail` -- Email, Mailbox, Thread, SearchSnippet
- `urn:ietf:params:jmap:submission` -- EmailSubmission with delivery status
- `urn:ietf:params:jmap:vacationresponse` -- Out-of-office
- `urn:ietf:params:jmap:quota` -- Quota display
- `urn:ietf:params:jmap:mdn` -- Read receipts
- `urn:ietf:params:jmap:blob` -- Attachment upload/download, email import
- `urn:ietf:params:jmap:websocket` -- Real-time push (RFC 8887)

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

---

## Security

If you discover a security vulnerability, please follow the instructions in [SECURITY.md](SECURITY.md). Do not open a public issue.

---

## License

This project is licensed under the [MIT License](LICENSE).
