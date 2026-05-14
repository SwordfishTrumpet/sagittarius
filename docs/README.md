# Sagittarius

> A high-performance, server-agnostic JMAP web client with iCloud Mail aesthetics

**[📖 Documentation](README.md)** • **[🚀 Get Started](#quick-start)** • **[🐛 Report Bug](../../issues)** • **[✨ Request Feature](../../issues)**

---

## What is Sagittarius?

Sagittarius is a **modern webmail client** that connects to any JMAP-compliant mail server. It brings the polish of iCloud Mail to your self-hosted infrastructure.

### The Problem with Webmail

| Proprietary Webmail | Traditional IMAP Clients | Sagittarius |
|---------------------|-------------------------|-------------|
| ❌ Locked to one vendor | ❌ Slow sync, polling | ✅ Any JMAP server |
| ❌ No privacy control | ❌ Outdated UI | ✅ Modern, fast UI |
| ❌ Limited features | ❌ Complex setup | ✅ Standards-based |

### Key Differentiators

🎨 **iCloud-Inspired Design** — Clean, glassmorphic UI with smooth animations  
⚡ **Blazing Fast** — Virtual scrolling handles 10,000+ emails  
🔒 **Privacy-First** — No telemetry, local-only data, image blocking  
📡 **Real-Time Sync** — WebSocket and EventSource push notifications  
⌨️ **Keyboard-First** — Vim-style shortcuts for power users  
📦 **Zero Lock-in** — Works with Stalwart, Cyrus, Apache James, any RFC 8620/8621 server

---

## Quick Start

### One-Command Setup

```bash
git clone https://github.com/SwordfishTrumpet/sagittarius.git
cd sagittarius && npm install
cp .env.example .env
# Edit .env: VITE_JMAP_SERVER=https://your-jmap-server.example.com
npm run dev
```

Then open `http://localhost:8081`

### Docker (One Line)

```bash
docker run -p 8081:8081 -e JMAP_SERVER=https://mail.example.com ghcr.io/swordfishtrumpet/sagittarius:latest
```

---

## Feature Highlights

### Email & Composition
- ✉️ **Threaded conversations** with expandable message stacks
- 📝 **Rich text composer** with formatting, attachments, templates
- ⏰ **Scheduled send** — queue emails for future delivery
- 💾 **Draft auto-save** — never lose work
- ↩️ **Smart reply/forward** — pre-filled recipients with quoted content

### Organization & Search
- 📁 **Nested folders** — drag-and-drop folder management
- 🔍 **Advanced search** — `from:`, `to:`, `has:attachment` syntax
- ✨ **Search snippets** — highlighted preview text
- 🏷️ **Quick filters** — one-click unread, flagged, to me, attachments
- ☑️ **Batch operations** — Shift/Cmd+Click multi-select

### Security & Privacy
- 🛡️ **Image blocking** — external images blocked until approved
- 🔐 **HTML sanitization** — DOMPurify processing
- 📦 **Sandboxed rendering** — isolated iframes prevent style leakage
- 👁️ **Read receipts** — MDN support (RFC 9007)
- 🔇 **Zero telemetry** — no analytics, tracking, or data collection

### Server Integration
- 🏖️ **Vacation responder** — auto-reply with date ranges
- 🧹 **Sieve filters** — visual rule editor + raw script mode
- 📊 **Quota display** — storage usage in sidebar
- 🎭 **Identity management** — multiple sending addresses
- 📈 **Delivery tracking** — submission status badges

---

## Tech Stack

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
</p>

- **Frontend:** React 18, TypeScript (Strict), Tailwind CSS
- **State Management:** TanStack Query (React Query), React Context
- **Editor:** Tiptap (ProseMirror-based rich text)
- **Virtualization:** react-virtuoso (10,000+ emails)
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Testing:** Vitest, React Testing Library, MSW

---

## Supported JMAP Servers

| Server | Compatibility | Notes |
|--------|---------------|-------|
| [Stalwart](https://stalw.art/) | ✅ Full | Modern Rust implementation |
| [Cyrus](https://www.cyrusimap.org/) | ✅ Full | Enterprise-scale, battle-tested |
| [Apache James](https://james.apache.org/) | ✅ Full | Java-based, enterprise features |
| Any RFC 8620/8621 | ✅ Core | Basic mail functionality |

---

## Performance Benchmarks

| Metric | Result |
|--------|--------|
| Initial Load | < 2s (gzip) |
| Message List | 60fps at 10,000 items |
| Search Response | < 100ms (cached) |
| Memory Usage | ~50MB for 1,000 threads |

See [`src/test/performance/`](src/test/performance/) for benchmark suite.

---

## Roadmap

### ✅ Complete (v1.0)
- Core JMAP Mail (RFC 8620/8621)
- Threaded conversations
- Rich text composer
- Search & filters
- Keyboard shortcuts
- Mobile responsive
- Accessibility (WCAG 2.2 AA)

### 🚧 In Progress
- Email templates
- Contact management (RFC 9610)
- Calendar integration (RFC 8984)

### 📋 Planned
- End-to-end encryption (OpenPGP)
- AI-powered sorting
- Mobile app (Capacitor)

---

## Community

- 💬 **Discussions:** [GitHub Discussions](../../discussions)
- 🐛 **Bug Reports:** [Open an Issue](../../issues/new?template=bug_report.md)
- ✨ **Feature Requests:** [Open an Issue](../../issues/new?template=feature_request.md)
- 🔒 **Security:** See [SECURITY.md](../SECURITY.md)

---

## License

MIT License — see [LICENSE](../LICENSE)

---

<p align="center">
  <sub>Made with ❤️ for the open email ecosystem</sub>
  <br>
  <sub>Not affiliated with Apple Inc. • iCloud is a trademark of Apple Inc.</sub>
</p>
