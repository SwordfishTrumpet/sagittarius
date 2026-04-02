# Sagittarius

A beautiful, high-performance JMAP web client inspired by iCloud Mail.

**Server-agnostic. Standards-compliant. Privacy-first.**

[![JMAP RFC 8620/8621](https://img.shields.io/badge/JMAP-RFC%208620%20%2F%208621-4A90D9?style=flat-square)](https://jmap.io/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![License MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## ✨ What Makes Sagittarius Special?

Most webmail clients are either locked to a specific backend or stuck in 2005 design patterns. Sagittarius breaks both molds:

### 🌐 Universal JMAP Support
Works with **any** RFC 8620/8621-compliant server:
- [Stalwart](https://stalw.art/) — Modern Rust-based mail server
- [Cyrus](https://www.cyrusimap.org/) — Battle-tested at scale
- [Apache James](https://james.apache.org/) — Enterprise Java solution
- Or roll your own — if it speaks JMAP, Sagittarius understands it

### 🎨 Native-Grade Design
- **Glassmorphic three-pane layout** — Sidebar, message list, reading pane with draggable borders
- **Smooth animations** — Every interaction feels polished
- **iCloud-inspired aesthetic** — Familiar yet modern
- **Full keyboard navigation** — Power users rejoice

### ⚡ Performance Obsessed
- **Virtual scrolling** — Handle 10,000+ emails without breaking a sweat
- **Aggressive caching** — TanStack Query keeps data fresh and fast
- **Incremental sync** — Only fetch what changed, not entire mailboxes
- **Real-time push** — WebSocket + EventSource for instant updates

### 🔒 Privacy by Design
- **Remote images blocked** — Until you explicitly approve them
- **Sandboxed rendering** — Email CSS can't touch the app
- **Credential redaction** — Auth headers never leak into logs
- **No tracking, no analytics** — Your data stays yours

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- npm >= 9
- A JMAP server (or use the included proxy)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/SwordfishTrumpet/sagittarius.git
cd sagittarius

# Install dependencies
npm install

# Configure your JMAP server
cp .env.example .env
# Edit .env and set VITE_JMAP_SERVER=https://your-jmap-server.example.com

# Development
npm run dev

# Production build
npm run build
```

Open **http://localhost:8081** and log in with your JMAP credentials.

---

## 📋 Deployment Options

### Option 1: Built-in Production Server (Easiest)

Sagittarius includes a production-ready Node.js server that handles both static files and JMAP proxying:

```bash
# Build the app
npm run build

# Start production server
JMAP_SERVER=https://mail.example.com PORT=8081 node server.js
```

**Features:**
- Serves optimized static files with compression
- Proxies `/jmap` requests with auth injection
- Handles `Range` headers for attachment downloads
- Graceful shutdown on SIGTERM

### Option 2: Static Hosting + Separate Proxy

Build static files and host anywhere (Nginx, Apache, CDN):

```bash
npm run build
# Upload dist/ to your static host
```

Configure your web server to proxy `/jmap` to your JMAP backend. See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for Nginx/Apache configs.

### Option 3: Docker

```bash
# Build image
docker build -t sagittarius .

# Run with JMAP server
docker run -p 8081:8081 -e JMAP_SERVER=https://mail.example.com sagittarius
```

---

## 🎯 Feature Highlights

### Email Management
| Feature | Description |
|---------|-------------|
| **Threaded Conversations** | Messages grouped with per-message expand/collapse |
| **Rich Text Composer** | Tiptap-powered with formatting, attachments, identity selection |
| **Scheduled Send** | Queue emails for future delivery |
| **Draft Auto-Save** | Never lose a message — automatic server persistence |
| **Reply/Forward** | Smart recipient prefilling with quoted content |

### Organization
| Feature | Description |
|---------|-------------|
| **Folder Nesting** | Drag-and-drop folder organization |
| **Batch Operations** | Multi-select with Shift/Cmd+Click |
| **Advanced Search** | `from:`, `to:`, `has:attachment` with highlighted snippets |
| **Quick Filters** | One-click Unread, Flagged, To Me, Attachments |

### Security & Privacy
| Feature | Description |
|---------|-------------|
| **Image Blocking** | External images require approval |
| **HTML Sanitization** | DOMPurify cleans every message |
| **Sandboxed Iframes** | Email isolation prevents CSS leakage |
| **Read Receipts** | MDN support per RFC 8098 |

### Server Integration
| Feature | Description |
|---------|-------------|
| **Vacation Responder** | Auto-reply with date ranges |
| **Sieve Filters** | Visual rule editor + raw script mode |
| **Quota Display** | Storage usage in sidebar |
| **Identity Management** | Multiple sending addresses |

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
| `?` | Show shortcuts |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + N` | New message |

---

## 🏗️ Architecture

### Tech Stack
- **React 18** (Vite) — Modern framework with Fast HMR
- **TypeScript** (Strict) — Type safety throughout
- **Tailwind CSS** — Utility-first styling
- **TanStack Query** — Server state management
- **Tiptap** — Rich text editor
- **react-virtuoso** — Virtual scrolling

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
Sagittarius uses standard JMAP capabilities:
- `urn:ietf:params:jmap:core` — Session, requests
- `urn:ietf:params:jmap:mail` — Email, Mailbox, Thread
- `urn:ietf:params:jmap:submission` — Send, delivery status
- `urn:ietf:params:jmap:vacationresponse` — Out-of-office
- `urn:ietf:params:jmap:quota` — Storage limits
- `urn:ietf:params:jmap:sieve` — Server-side filters (optional)

---

## 📚 Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) — Production deployment options
- [Development Setup](docs/DEVELOPMENT.md) — Contributing, architecture
- [JMAP Server Setup](docs/JMAP_SERVER.md) — Configuring your mail server
- [Security](SECURITY.md) — Vulnerability reporting
- [Contributing](CONTRIBUTING.md) — PR guidelines

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📝 License

MIT License — use it, fork it, make it yours.

---

<p align="center">
  <sub>Built with ☕, curiosity, and an unhealthy obsession with email protocols.</sub>
</p>
