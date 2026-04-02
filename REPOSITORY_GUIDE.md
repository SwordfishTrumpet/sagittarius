# Repository Guide

This document explains the purpose of files and directories in the Sagittarius repository to help users and contributors navigate the codebase.

---

## 📁 Directory Structure

```
sagittarius/
├── .github/              # GitHub templates (issues, PRs, workflows)
├── docs/                 # Documentation
│   ├── DEPLOYMENT.md     # Production deployment guide
│   ├── DEVELOPMENT.md    # Development setup and contributing
│   ├── JMAP_SERVER.md    # JMAP server configuration
│   ├── accessibility.md  # Accessibility patterns
│   └── patterns-and-utilities.md  # Code patterns for developers
├── public/               # Static assets (favicon, sounds, manifest)
├── src/                  # Source code
│   ├── api/              # JMAP client implementation
│   ├── components/       # React UI components
│   │   ├── dialogs/      # Modal dialogs
│   │   ├── settings/     # Settings panels
│   │   └── ui/           # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── test/             # Test utilities and fixtures
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── dist/                 # Build output (created by npm run build)
└── node_modules/         # Dependencies (created by npm install)
```

---

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Node.js dependencies and npm scripts |
| `tsconfig.json` | TypeScript compiler configuration |
| `vite.config.ts` | Vite build tool configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration (used by Tailwind) |
| `.env.example` | Example environment variables |
| `.editorconfig` | Editor settings (indentation, etc.) |
| `.gitignore` | Files excluded from git |

---

## 🚀 Deployment Files

| File | Purpose |
|------|---------|
| `server.js` | Production Node.js server with JMAP proxy |
| `Dockerfile` | Docker image build instructions |
| `.dockerignore` | Files excluded from Docker build |
| `deploy.sh` | Deployment script for systemd setups |

### Which deployment option should I use?

1. **Built-in Server (`server.js`)** — Easiest option. Run `node server.js` after building.
2. **Docker** — Best for containerized environments (Kubernetes, etc.).
3. **Nginx Static** — Best if you already have Nginx infrastructure.

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

---

## 📚 Documentation Files

| File | Audience | Purpose |
|------|----------|---------|
| `README.md` | Users | Overview, quick start, features |
| `CHANGELOG.md` | Users | Version history and changes |
| `docs/DEPLOYMENT.md` | Deployers | Production deployment guides |
| `docs/DEVELOPMENT.md` | Contributors | Development setup, architecture |
| `CONTRIBUTING.md` | Contributors | How to contribute code |
| `CODE_OF_CONDUCT.md` | Contributors | Community standards |
| `SECURITY.md` | Security researchers | Vulnerability reporting |
| `LICENSE` | Everyone | MIT License terms |

### Internal Documentation

| File | Audience | Purpose |
|------|----------|---------|
| `AGENTS.md` | AI/ML agents | Instructions for code agents working on Sagittarius |
| `TODO.md` | Maintainers | Development roadmap and known issues |
| `docs/patterns-and-utilities.md` | Developers | Reusable code patterns and utilities |

---

## 🧪 Testing Files

| File/Directory | Purpose |
|----------------|---------|
| `src/test/` | Test utilities, fixtures, integration tests |
| `*.test.ts` / `*.test.tsx` | Unit and component tests |
| `*.spec.ts` | Specification tests (RFC compliance) |

---

## 🎯 Entry Points

| File | Purpose |
|------|---------|
| `index.html` | HTML entry point (loads Vite app) |
| `src/main.tsx` | JavaScript entry point (React app root) |
| `src/App.tsx` | Main application component |

---

## 🔒 Security & Privacy

Key security-related files:
- `src/utils/privacy.ts` — Remote image blocking, CID resolution
- `src/utils/toastHelpers.ts` — Standardized error messages (no sensitive data)
- `server.js` — Credential handling and proxy configuration

---

## 🗑️ Files Not Needed for Deployment

These files are development-only and not included in production builds:

- `AGENTS.md` — AI agent instructions
- `TODO.md` — Development tracking
- `docs/DEVELOPMENT.md` — Contributor guide
- `docs/accessibility.md` — Internal accessibility docs
- `docs/patterns-and-utilities.md` — Code patterns reference
- `deploy.sh` — Deployment convenience script
- All `.test.ts` and `.test.tsx` files

**Note:** These files are harmless in the repo but don't affect production builds.

---

## 📦 What's in Production Builds?

After running `npm run build`, the `dist/` directory contains only what's needed to run Sagittarius:

- Compiled JavaScript (minified)
- Optimized CSS
- Static assets from `public/`
- Source maps (optional, for debugging)

The production build does **not** include:
- Source TypeScript files
- Test files
- Documentation
- Development dependencies

---

## 🤔 Common Questions

### Do I need to keep server.cjs and server.js?

- `server.js` — Yes, if using the built-in production server (ES modules)
- `server.cjs` — Legacy CommonJS version (kept for compatibility, but `server.js` is preferred)

### What's the difference between .env and .env.example?

- `.env.example` — Template showing required environment variables (committed to repo)
- `.env` — Your actual local configuration (ignored by git, never committed)

### Can I delete AGENTS.md and TODO.md?

Yes, they're not required for running Sagittarius. However:
- `AGENTS.md` helps AI assistants understand the codebase
- `TODO.md` tracks known issues and planned improvements

Consider keeping them if you plan to contribute back or have others work on the code.

---

## 🚀 Quick Reference

**To deploy:**
1. Read `docs/DEPLOYMENT.md`
2. Use `Dockerfile` or `server.js`
3. Configure `.env` based on `.env.example`

**To develop:**
1. Read `docs/DEVELOPMENT.md`
2. Run `npm install` and `npm run dev`
3. See `AGENTS.md` for code patterns

**To contribute:**
1. Read `CONTRIBUTING.md`
2. Check `TODO.md` for open issues
3. Follow patterns in `docs/patterns-and-utilities.md`
