# ♐ Sagittarius

A high-performance, server-agnostic JMAP web client with a modern interface inspired by iCloud Mail.

**Standards-compliant. Privacy-first. Built for power users.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)](CHANGELOG.md)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen?style=flat-square&logo=github-actions&logoColor=white)](.github/workflows/ci.yml)
[![JMAP RFC 8620/8621](https://img.shields.io/badge/JMAP-RFC%208620%20%2F%208621-4A90D9?style=flat-square)](https://jmap.io/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tests-989%20passing-6E9F18?style=flat-square&logo=vitest&logoColor=white)](package.json)
[![License MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

## ✨ Why Sagittarius?

Sagittarius is a **frontend-only JMAP client** designed to work with any RFC 8620/8621-compliant mail server. Unlike proprietary webmail interfaces that lock you into a specific backend, Sagittarius gives you full control over your mail infrastructure while providing a polished, responsive user experience.

### 🖥️ Compatible JMAP Servers

- [Stalwart](https://stalw.art/) — Modern Rust-based mail server
- [Cyrus](https://www.cyrusimap.org/) — Battle-tested at enterprise scale
- [Apache James](https://james.apache.org/) — Enterprise Java solution
- Any server implementing **RFC 8620/8621**

---

## 🚀 Quick Start

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

## 🛠️ Deployment

### Option 1: Built-in Production Server

Sagittarius includes a production-ready Node.js server that serves static files and proxies JMAP requests:

```bash
npm run build

JMAP_SERVER=https://mail.example.com PORT=8081 node server.js
```

Features:
- ✅ Compressed static file serving
- ✅ JMAP proxy with auth injection
- ✅ Range header support for attachment downloads
- ✅ Graceful shutdown on SIGTERM

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

### Nginx Reverse Proxy (HTTPS)

If using nginx as a reverse proxy for HTTPS, increase the upload size limit:

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

### ✉️ Email Management

| Feature | Description |
|---------|-------------|
| **Threaded Conversations** | Messages grouped with per-message expand/collapse |
| **Rich Text Composer** | Tiptap-powered editor with formatting, attachments, identity selection |
| **Scheduled Send** | Queue emails for future delivery via `EmailSubmission/sendAt` |
| **Draft Auto-Save** | Automatic server persistence prevents data loss |
| **Reply/Forward** | Smart recipient prefilling with quoted content |
| **Batch Operations** | Multi-select with Shift/Cmd+Click and Select All |

### 📁 Organization

| Feature | Description |
|---------|-------------|
| **Folder Nesting** | Drag-and-drop folder hierarchy management |
| **Advanced Search** | `from:`, `to:`, `has:attachment` syntax with highlighted snippets |
| **Quick Filters** | One-click filtering for Unread, Flagged, To Me, Attachments |
| **Quota Display** | Storage usage indicator in sidebar |

### 🔒 Security & Privacy

| Feature | Description |
|---------|-------------|
| **Image Blocking** | External images blocked until explicit per-sender approval |
| **HTML Sanitization** | DOMPurify processes all message content |
| **Sandboxed Iframes** | Email isolation prevents style leakage |
| **Read Receipts** | MDN support per RFC 8098 |
| **No Telemetry** | Zero analytics or tracking — your data stays local |

### 🎨 Appearance

| Feature | Description |
|---------|-------------|
| **Light/Dark/Auto Theme** | Manual or system-preference-based theme selection |
| **Monospaced Font Selection** | Choose from 6 coding fonts (Fira Code, JetBrains Mono, etc.) |
| **OLED-Optimized Dark Mode** | Pure black background for power-efficient displays |
| **Glassmorphic UI** | Translucent effects in both light and dark modes |

### ⚙️ Server Integration

| Feature | Description |
|---------|-------------|
| **Vacation Responder** | Auto-reply configuration with date ranges |
| **Sieve Filters** | Visual rule editor and raw script mode |
| **Identity Management** | Multiple sending addresses per account |
| **Delivery Status** | Track email submission status |
| **RFC-Compliant Limits** | Respects server limits (max attachment size, folder depth, etc.) |

### 🎯 JMAP Capability Awareness

Sagittarius intelligently respects your server's JMAP capability limits for a better user experience:

| Capability | Limits Enforced |
|------------|-----------------|
| **Core (RFC 8620)** | `maxObjectsInGet/Set` — Chunked batch operations, `maxSizeUpload` — Per-file upload limit |
| **Mail (RFC 8621)** | `maxSizeAttachmentsPerEmail` — Total attachment size with live indicator, `maxMailboxDepth` — Folder nesting validation, `mayCreateTopLevelMailbox` — Controls root folder creation |
| **Sieve (RFC 9266)** | `maxNumberScripts` — Warns at filter limit, `maxSizeScript` — Rejects oversized scripts |
| **Calendar (RFC 8984)** | `maxParticipantsPerEvent` — Attendee limit warnings, `mayCreateCalendar` — Controls calendar creation |
| **Contacts (RFC 9610)** | `mayCreateAddressBook` — Controls address book creation |
| **Blob (RFC 9404)** | `maxDataSources` — Validates blob upload data sources |

**Benefits:**
- Prevents operations that would fail server-side
- Shows real-time feedback (e.g., "Attachments: 12.5 MB of 50 MB")
- Automatically chunks bulk operations (e.g., moving 1000+ emails in batches)
- Gracefully disables features when server doesn't support them

---

## ⌨️ Keyboard Shortcuts

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
| `?` | Show shortcuts help |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + N` | New message |

---

## 🏗️ Architecture

### Built With

<p align="left">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS"></a>
  <a href="https://tanstack.com/query/latest"><img src="https://img.shields.io/badge/TanStack_Query-FF4154?style=for-the-badge&logo=react&logoColor=white" alt="TanStack Query"></a>
  <a href="https://tiptap.dev/"><img src="https://img.shields.io/badge/Tiptap-563D7C?style=for-the-badge&logo=tiptap&logoColor=white" alt="Tiptap"></a>
  <a href="https://www.framer.com/motion/"><img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion"></a>
</p>

- **[React 18](https://react.dev/)** — Vite-powered for fast HMR and optimized builds
- **[TypeScript](https://www.typescriptlang.org/)** — Strict mode for full type safety
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling with custom design system
- **[TanStack Query](https://tanstack.com/query/latest)** — Server state management and aggressive caching
- **[Tiptap](https://tiptap.dev/)** — Rich text editing with extensible plugin system
- **[react-virtuoso](https://virtuoso.dev/)** — Virtual scrolling for 10,000+ emails

### Project Structure

```
src/
├── api/              # JMAP client, WebSocket/EventSource push, session management
├── components/       # React UI components
│   ├── dialogs/      # Modal dialogs (Compose, Settings, etc.)
│   ├── settings/     # Settings panels (General, Vacation, Filters)
│   └── ui/           # Reusable UI primitives (Button, Input, Card)
├── hooks/            # Custom React hooks
│   ├── jmap/         # JMAP data hooks (useMailboxes, useEmails, useThreads)
│   └── ui/           # UI interaction hooks
├── types/            # TypeScript type definitions (JMAP RFC types)
└── utils/            # Helpers (sanitization, search, formatting, privacy)
```

### JMAP Capabilities

Sagittarius implements standard JMAP capabilities:

| Capability | Purpose |
|------------|---------|
| `urn:ietf:params:jmap:core` | Session management, request handling, push subscriptions |
| `urn:ietf:params:jmap:mail` | Email, Mailbox, Thread operations |
| `urn:ietf:params:jmap:submission` | Email submission, delivery status tracking |
| `urn:ietf:params:jmap:vacationresponse` | Out-of-office configuration |
| `urn:ietf:params:jmap:quota` | Storage limit monitoring |
| `urn:ietf:params:jmap:sieve` | Server-side mail filters (optional) |
| `urn:ietf:params:jmap:mdn` | Read receipt handling (RFC 8098) |
| `urn:ietf:params:jmap:blob` | Blob upload/download (RFC 9404) |

---

## 📚 Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| [README.md](README.md) | Everyone | You're reading it — overview, quick start, features |
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

### Development Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

---

## 📊 Stats

- **989+ Tests** passing across 96 test files
- **TypeScript Strict Mode** — Zero `any` types
- **Full RFC Compliance** — JMAP 8620/8621, 8887, 9404, 9553, 9610
- **WCAG 2.1 AA** accessibility compliant

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with ❤️ for the JMAP ecosystem. Not affiliated with Apple Inc.</sub>
</p>
