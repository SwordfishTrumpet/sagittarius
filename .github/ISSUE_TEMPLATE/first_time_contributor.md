# 🌟 Welcome, First-Time Contributor!

Thank you for considering contributing to Sagittarius! This guide will help you make your first contribution smoothly.

## Quick Start (5 Minutes)

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/sagittarius.git
cd sagittarius

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env and set VITE_JMAP_SERVER (can be a mock for UI work)

# 4. Start development
npm run dev
# Open http://localhost:8081
```

## 🎯 Good First Issues

Look for issues labeled:
- `good first issue` — Simple, well-defined tasks
- `documentation` — Doc improvements, typo fixes
- `ui-polish` — CSS/styling tweaks
- `accessibility` — A11y improvements

## 🧪 Making Your First Change

### Example: Adding a Keyboard Shortcut

Let's say you want to add a `g` key to "Go to inbox":

1. **Find the relevant code:**
   ```bash
   grep -r "keyboard" src/ --include="*.ts" --include="*.tsx"
   ```
   This points to `src/hooks/useKeyboardShortcuts.ts`

2. **Read the existing pattern:**
   - Open `src/hooks/useKeyboardShortcuts.ts`
   - Look at how `j`/`k` navigation is implemented

3. **Add your feature:**
   ```typescript
   case 'g':
     if (e.target === document.body) {
       navigateToInbox();
     }
     break;
   ```

4. **Test your change:**
   ```bash
   npm run typecheck  # Check TypeScript
   npm test -- useKeyboardShortcuts  # Run related tests
   ```

5. **Commit and push:**
   ```bash
   git checkout -b feat/goto-inbox-shortcut
   git add .
   git commit -m "feat: add 'g' shortcut to navigate to inbox"
   git push origin feat/goto-inbox-shortcut
   ```

6. **Open a Pull Request** on GitHub

## 📁 Codebase Tour

| Directory | What's Inside | Good For First PRs? |
|-----------|---------------|---------------------|
| `src/utils/` | Helper functions (formatting, sanitization) | ✅ Yes — add tests |
| `src/components/ui/` | Reusable UI primitives (Button, Card) | ✅ Yes — add stories/docs |
| `src/hooks/ui/` | UI interaction hooks | ✅ Yes — simple additions |
| `src/components/dialogs/` | Modal dialogs | ⚠️ Medium complexity |
| `src/api/` | JMAP client, WebSocket | ❌ No — needs deep knowledge |

## 🎨 UI Changes

If your PR changes the UI:

1. **Screenshots are required** — Add before/after images to your PR description
2. **Follow the iCloud aesthetic:**
   - Blue: `#0071e3` (iCloud Mail accent, CSS var `--icloud-accent`)
   - Sidebar: `#fbfbfd` (CSS var `--icloud-bg-sidebar`)
   - Text: `rgba(0,0,0,0.88)` primary, `rgba(0,0,0,0.56)` secondary
   - Icons: Lucide with `strokeWidth={1.25}`
   - All colors via `text-icloud-*` / `bg-icloud-*` / `border-icloud-*` Tailwind classes

### Example Screenshot Format

```markdown
## Screenshots

| Before | After |
|--------|-------|
| ![Before](before.png) | ![After](after.png) |
```

## 🧪 Testing Your Changes

```bash
# Run all tests
npm test

# Run specific test file
npm test -- useEmailSelection

# Run with coverage
npm run test:coverage

# Type check (required before PR)
npm run typecheck
```

## 🐛 Finding Something to Work On

1. Look at open issues with `good first issue` label
2. Try using Sagittarius yourself — what feels missing?

## 💬 Need Help?

- **General questions:** [GitHub Discussions](../../discussions)
- **Bug reports:** [Open an Issue](../../issues/new?template=bug_report.md)
- **Real-time chat:** (none yet — suggest in Discussions!)

## ✅ Pre-PR Checklist

- [ ] Code builds without errors (`npm run build`)
- [ ] TypeScript passes (`npm run typecheck`)
- [ ] Tests pass (`npm test`)
- [ ] UI changes have screenshots
- [ ] Commit messages follow format: `type: description`

## 🏆 Recognition

All contributors will be:
- Listed in release notes
- Added to the All Contributors table (when enabled)
- Thanked in the project README

---

**Remember:** No contribution is too small! Documentation fixes, typo corrections, and test additions are all valuable.

Ready? Pick an issue and dive in! 🚀
