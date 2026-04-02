# Sagittarius

A high-performance, server-agnostic JMAP web client with a modern interface inspired by iCloud Mail.

**Standards-compliant. Privacy-first. Built for power users.**

[![JMAP RFC 8620/8621](https://img.shields.io/badge/JMAP-RFC%208620%20%2F%208621-4A90D9?style=flat-square)](https://jmap.io/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![License MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## Why Sagittarius?

Sagittarius is a frontend-only JMAP client designed to work with any RFC 8620/8621-compliant mail server. Unlike proprietary webmail interfaces that lock you into a specific backend, Sagittarius gives you full control over your mail infrastructure while providing a polished, responsive user experience.

### Compatible JMAP Servers

- [Stalwart](https://stalw.art/) - Modern Rust-based mail server
- [Cyrus](https://www.cyrusimap.org/) - Battle-tested at enterprise scale
- [Apache James](https://james.apache.org/) - Enterprise Java solution
- Any server implementing RFC 8620/8621

### Design

- **Three-pane layout** with glassmorphic sidebar, message list, and reading pane
- **Draggable pane borders** for customizable workspace
- **Keyboard-first navigation** for efficient workflows
- **Smooth animations** via Framer Motion

### Performance

- **Virtual scrolling** handles 10,000+ emails without degradation
- **Aggressive caching** via TanStack Query with background refresh
- **Incremental sync** fetches only changed data, not entire mailboxes
- **Real-time push** via WebSocket (RFC 8887) and EventSource

### Privacy

- **Remote images blocked by default** until explicitly approved per-sender
- **Sandboxed HTML rendering** prevents CSS injection attacks
- **Credential redaction** ensures auth headers never appear in logs
- **No telemetry or analytics** - your data stays local

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
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

## Deployment

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

Build static files and deploy to any web server:

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

---

## Features

### Email Management

| Feature | Description |
|---------|-------------|
| Threaded Conversations | Messages grouped with per-message expand/collapse |
| Rich Text Composer | Tiptap-powered editor with formatting, attachments, identity selection |
| Scheduled Send | Queue emails for future delivery |
| Draft Auto-Save | Automatic server persistence prevents data loss |
| Reply/Forward | Smart recipient prefilling with quoted content |

### Organization

| Feature | Description |
|---------|-------------|
| Folder Nesting | Drag-and-drop folder hierarchy management |
| Batch Operations | Multi-select with Shift/Cmd+Click |
| Advanced Search | `from:`, `to:`, `has:attachment` syntax with highlighted snippets |
| Quick Filters | One-click filtering for Unread, Flagged, To Me, Attachments |

### Security

| Feature | Description |
|---------|-------------|
| Image Blocking | External images require explicit approval |
| HTML Sanitization | DOMPurify processes all message content |
| Sandboxed Iframes | Email isolation prevents style leakage |
| Read Receipts | MDN support per RFC 8098 |

### Server Integration

| Feature | Description |
|---------|-------------|
| Vacation Responder | Auto-reply configuration with date ranges |
| Sieve Filters | Visual rule editor and raw script mode |
| Quota Display | Storage usage indicator in sidebar |
| Identity Management | Multiple sending addresses per account |

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
| `?` | Show shortcuts |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + N` | New message |

---

## Architecture

### Tech Stack

- **React 18** (Vite) - Fast HMR and optimized builds
- **TypeScript** (Strict mode) - Full type safety
- **Tailwind CSS** - Utility-first styling
- **TanStack Query** - Server state management and caching
- **Tiptap** - Rich text editing
- **react-virtuoso** - Virtual scrolling

### Project Structure

```
src/
  api/           # JMAP client, WebSocket/EventSource push
  components/    # UI components (Sidebar, MessageList, Composer)
  hooks/         # JMAP hooks (useMailboxes, useEmails, useThreads)
  types/         # TypeScript definitions
  utils/         # Helpers (sanitization, search, formatting)
```

### JMAP Capabilities

Sagittarius implements standard JMAP capabilities:

- `urn:ietf:params:jmap:core` - Session management, request handling
- `urn:ietf:params:jmap:mail` - Email, Mailbox, Thread operations
- `urn:ietf:params:jmap:submission` - Send, delivery status tracking
- `urn:ietf:params:jmap:vacationresponse` - Out-of-office configuration
- `urn:ietf:params:jmap:quota` - Storage limit monitoring
- `urn:ietf:params:jmap:sieve` - Server-side filters (optional)

---

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment configurations
- [Development Setup](docs/DEVELOPMENT.md) - Contributing and architecture overview
- [JMAP Server Setup](docs/JMAP_SERVER.md) - Mail server configuration
- [Security](SECURITY.md) - Vulnerability reporting process
- [Contributing](CONTRIBUTING.md) - Pull request guidelines

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting issues and pull requests.

---

## License

MIT License - see [LICENSE](LICENSE) for details.
