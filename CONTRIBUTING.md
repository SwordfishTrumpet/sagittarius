# Contributing to Sagittarius

Thank you for your interest in contributing to Sagittarius. This document provides guidelines and information to help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/sagittarius.git`
3. Install dependencies: `npm install`
4. Copy environment config: `cp .env.example .env`
5. Start the dev server: `npm run dev`

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Ensure the project builds without errors:
   ```bash
   npm run build
   ```
4. Run the TypeScript checker:
   ```bash
   npm run typecheck
   ```
5. Commit your changes with a clear message (see below)
6. Push to your fork and open a pull request

## Commit Messages

Use clear, descriptive commit messages:

- `feat: add attachment preview for PDF files`
- `fix: resolve thread collapse state not persisting`
- `refactor: extract search logic into useSearch hook`
- `docs: update JMAP capabilities table in README`
- `style: align sidebar icons with iCloud design spec`

Format: `<type>: <short description>`

Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`

## Code Style

- **TypeScript** -- Strict mode is enabled. All code must pass type checking.
- **Tailwind CSS** -- Use utility classes. Avoid custom CSS unless absolutely necessary.
- **Components** -- Keep components focused. Extract reusable logic into hooks under `src/hooks/`.
- **Icons** -- Use Lucide React with `strokeWidth={1.25}` for consistency with the design system.
- **Naming** -- Use PascalCase for components, camelCase for hooks and utilities.

## Architecture Guidelines

- **JMAP compliance** -- All server communication must use standard JMAP methods (RFC 8620/8621). Do not introduce proprietary API calls.
- **Performance** -- Avoid unnecessary re-renders. Use `useMemo` and `useCallback` where appropriate. Large lists must use virtual scrolling.
- **Security** -- Always sanitize HTML email content with DOMPurify. Never log credentials or sensitive data.
- **Error handling** -- Wrap component trees in `ErrorBoundary`. Use try-catch in async operations.
- **Shared patterns** -- Use the utilities documented in [docs/patterns-and-utilities.md](./docs/patterns-and-utilities.md) for JMAP hooks, optimistic updates, dialogs, and toast notifications. Avoid duplicating existing patterns.

## Pull Request Guidelines

- Keep PRs focused on a single concern
- Include a clear description of what changed and why
- Reference any related issues
- Ensure the build passes before requesting review
- Add screenshots for UI changes

## Reporting Issues

- Use the GitHub issue templates (bug report or feature request)
- Include steps to reproduce for bugs
- Include your JMAP server type/version if relevant

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this standard.
