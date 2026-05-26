# Development Setup

Complete guide for setting up Sagittarius for local development and contribution.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Setup](#quick-setup)
3. [Development Server](#development-server)
4. [Testing](#testing)
5. [Code Style](#code-style)
6. [Architecture Overview](#architecture-overview)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** 9+ (comes with Node.js)
- **Git**

### Optional but Recommended

- **A JMAP-compliant mail server** for testing:
  - [Stalwart](https://stalw.art/) (easiest local setup)
  - Public JMAP test server (see below)
- **VS Code** with extensions:
  - ESLint
  - Tailwind CSS IntelliSense
  - TypeScript Importer

---

## Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/SwordfishTrumpet/sagittarius.git
cd sagittarius

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Edit .env file
# VITE_JMAP_SERVER=https://your-jmap-server.example.com

# 5. Start development
npm run dev
```

Open `http://localhost:8081` in your browser.

---

## Development Server

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Create production build |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | Run TypeScript compiler (no emit) |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

### Environment Variables

Create `.env` file from `.env.example`:

```bash
# Required: Your JMAP server URL
VITE_JMAP_SERVER=https://mail.example.com

# Optional: Development settings
VITE_DEV_PORT=8081
VITE_API_TIMEOUT=30000
```

### JMAP Server Options for Development

#### Option 1: Stalwart (Recommended)

```bash
# Run Stalwart locally with Docker
docker run -d \
  --name stalwart \
  -p 8080:8080 \
  -v stalwart-data:/opt/stalwart-mail \
  stalwartlabs/mail-server:latest
```

Then set `VITE_JMAP_SERVER=http://localhost:8080`

#### Option 2: JMAP Test Server

Use the public Fastmail JMAP test server:
- URL: `https://api.fastmail.com/jmap/session`
- Note: Requires Fastmail account

#### Option 3: Mock Mode (UI Development Only)

For pure UI work without a backend, you can mock JMAP responses:

```typescript
// In src/api/jmap.ts, temporarily override:
if (import.meta.env.DEV && import.meta.env.VITE_MOCK_JMAP === 'true') {
  // Return mock responses
}
```

---

## Testing

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run specific test file
npm test -- useEmailSelection

# Run with coverage
npm run test:coverage

# Run tests compatible with CI (faster, minimal output)
npm run test:ci
```

### Test Structure

```
src/
├── test/
│   ├── setup.ts           # Test environment setup
│   ├── testUtils.ts       # Test utilities and fixtures
│   ├── fixtures/          # Test data (emails, mailboxes)
│   └── mocks/             # Mock implementations
├── hooks/
│   └── __tests__/         # Hook tests
├── components/
│   └── __tests__/         # Component tests
└── utils/
    └── __tests__/         # Utility function tests
```

### Writing Tests

Use the provided test utilities:

```typescript
import { renderHook } from '@testing-library/react';
import { createTestEmail, createTestMailbox } from '../test/testUtils';
import { useEmailSelection } from './useEmailSelection';

describe('useEmailSelection', () => {
  const mockEmails = [
    createTestEmail({ id: 'email-1', subject: 'Test 1' }),
    createTestEmail({ id: 'email-2', subject: 'Test 2' }),
  ];

  it('should select single email on click', () => {
    const { result } = renderHook(() => useEmailSelection());
    
    result.current.handleSelect(mockEmails[0], false, false);
    
    expect(result.current.selectedIds).toContain('email-1');
  });
});
```

### Test Patterns

See [patterns-and-utilities.md](./patterns-and-utilities.md#testing-patterns) for:
- Mocking TanStack Query
- Testing hooks with `renderHook`
- Mocking Framer Motion
- Accessibility testing with `vitest-axe`

---

## Code Style

### TypeScript

- **Strict mode enabled** — All code must pass `tsc --noEmit`
- **No `any` types** — Use `unknown` with type guards instead
- **Explicit return types** on exported functions
- **Interface over Type** for object shapes

```typescript
// ✅ Good
interface Email {
  id: string;
  subject: string;
}

function getEmailById(id: string): Email | undefined {
  return emails.find(e => e.id === id);
}

// ❌ Avoid
function getEmailById(id: any): any {
  return emails.find(e => e.id === id);
}
```

### React Components

- **Functional components** with hooks
- **PascalCase** for component names
- **Props interface** with JSDoc for complex props
- **Default exports** for page components, **named exports** for reusable components

```typescript
interface SidebarProps {
  /** Currently selected mailbox ID */
  selectedMailboxId: string | null;
  /** Called when a mailbox is selected */
  onSelectMailbox: (id: string) => void;
}

export function Sidebar({ selectedMailboxId, onSelectMailbox }: SidebarProps) {
  // Component logic
}
```

### Styling (Tailwind CSS)

- **Utility-first** — Avoid custom CSS
- **Consistent ordering** — Use the Tailwind CSS IntelliSense extension
- **Extract patterns** — Use `@apply` only for repeated patterns in `index.css`
- **Design tokens** — Use the project's color palette

```typescript
// ✅ Good
<button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors">

// ❌ Avoid (unless repeated)
<button style={{ display: 'flex', padding: '8px 16px' }}>
```

### Custom Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `bg-icloud-accent` / `text-icloud-accent` | `#0071e3` / `#009aff` (dark) | Primary buttons, links, active states |
| `bg-icloud-bg-sidebar` | `#fbfbfd` / `#202023` (dark) | Sidebar background |
| `bg-icloud-bg-layer1` | `#f2f2f7` / `#323236` (dark) | Message list background |
| `bg-icloud-bg-layer2` | `#ffffff` / `#434349` (dark) | Reading pane, cards |
| `border-icloud-border` | `#d1d1d6` / `#343436` (dark) | Borders, dividers |
| `text-icloud-text-primary` | `rgba(0,0,0,0.88)` / `rgba(255,255,255,0.98)` (dark) | Primary text |
| `text-icloud-text-secondary` | `rgba(0,0,0,0.56)` / `rgba(255,255,255,0.66)` (dark) | Secondary text |

All colors auto-switch between light/dark via CSS custom properties. See `src/index.css` for full variable definitions.

### Icons

Always use **Lucide React** with consistent stroke width:

```typescript
import { Mail, Star, Trash } from 'lucide-react';

<Mail strokeWidth={1.25} className="w-5 h-5" />
<Star strokeWidth={1.25} className="w-4 h-4" />
```

---

## Architecture Overview

### Data Flow

```
User Action → React Component → Custom Hook → JMAP Client → Server
                                              ↓
                                         TanStack Query Cache
                                              ↓
                                   React Component Re-render
```

### Key Architectural Decisions

1. **TanStack Query for Server State**
   - Automatic caching
   - Background refetching
   - Optimistic updates
   - Request deduplication

2. **JMAP Client Abstraction**
   - `src/api/jmap.ts` — Singleton client
   - `src/types/jmap.ts` — RFC-compliant type definitions
   - All server communication goes through JMAP methods

3. **Hook-Based Data Access**
   - `useMailboxes()` — Fetch and cache mailboxes
   - `useEmails()` — Fetch email list with pagination
   - `useEmail(id)` — Fetch single email
   - `useThreads()` — Group emails into conversations

4. **Optimistic Updates**
   - UI updates immediately
   - Rolls back on error
   - Syncs with server state

### Directory Structure

```
src/
├── api/                    # JMAP communication
│   ├── jmap.ts            # Main client singleton
│   ├── websocket.ts       # WebSocket push (RFC 8887)
│   └── eventsource.ts     # EventSource push
├── components/            # React components
│   ├── dialogs/          # Modal dialogs
│   ├── settings/         # Settings panels
│   └── ui/               # Reusable UI primitives
├── hooks/                # Custom React hooks
│   ├── jmap/            # JMAP data hooks
│   └── ui/              # UI interaction hooks
├── types/               # TypeScript types
├── utils/               # Utility functions
│   ├── sanitization.ts  # DOMPurify HTML sanitization
│   ├── privacy.ts       # Remote image blocking
│   └── formatters.ts    # Date, size formatting
└── test/                # Test utilities and fixtures
```

---

## Troubleshooting

### Common Issues

#### `npm install` fails

```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript errors in node_modules

```bash
# Skip type checking for libraries
npm run typecheck -- --skipLibCheck
```

#### JMAP connection fails

1. Check `VITE_JMAP_SERVER` in `.env`
2. Verify server supports CORS or use Vite proxy
3. Check browser DevTools → Network for blocked requests

#### Tests fail with "act()" warnings

Wrap interactions in `act()`:

```typescript
import { act } from '@testing-library/react';

await act(async () => {
  await userEvent.click(button);
});
```

#### Hot Module Replacement (HMR) not working

1. Check browser console for WebSocket connection errors
2. Try hard refresh: `Cmd+Shift+R` (Mac) / `Ctrl+F5` (Windows)
3. Restart dev server: `Ctrl+C`, then `npm run dev`

### Getting Help

- **General questions:** [GitHub Discussions](../../discussions)
- **Bug reports:** [Open an issue](../../issues/new?template=bug_report.md)
- **Code questions:** Comment on relevant PR or issue

---

## Next Steps

- Review [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
- Read [patterns-and-utilities.md](./patterns-and-utilities.md) for reusable patterns
- Explore the codebase starting with `src/App.tsx`

Happy coding! 🚀
