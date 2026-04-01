# Accessibility

Sagittarius targets WCAG 2.1 AA for keyboard and assistive technology support.

Current accessibility contract:
- Use semantic landmarks and labels for the 3-pane layout.
- Every icon-only interactive control must have an `aria-label`.
- Dialogs must use `role="dialog"`, `aria-modal="true"`, and focus trapping.
- Menus, tabs, trees, switches, and separators must expose the correct ARIA roles and keyboard behavior.
- Loading and error states should be announced with `role="status"`, `aria-live`, or `role="alert"` as appropriate.
- Prefer accessible names and roles in tests over raw text-only selectors when the UI is composite.

Testing:
- Run all tests: `npm run test`
- Run accessibility renders: `npx vitest run src/test/a11y`
- Run a focused accessibility test: `npm run test -- src/test/a11y/settings.a11y.test.tsx`

Implementation notes:
- `src/hooks/useFocusTrap.ts` is the shared primitive for modal focus containment and restoration.
- `src/components/accessible/LiveRegion.tsx` is the shared primitive for polite app-level announcements.
- `@axe-core/react` is enabled in development and `vitest-axe` is used for automated render checks.

Review learnings / gotchas:
- Do not use `role="banner"` inside `aside`, `section`, `main`, or other nested landmarks; keep `banner` top-level only.
- For stateful keyboard interactions (especially menus/submenus), prefer React `onKeyDown` handlers or ensure native listeners include every state dependency to avoid stale-closure bugs.
- Every `role="treeitem"` must be keyboard focusable and operable (`tabIndex`, Enter/Space, and relevant arrow-key behavior).
- Only use `aria-controls` when the controlled element is actually present in the DOM, or keep the controlled panel mounted and hide it.
- Focus traps should usually land on the first useful control, not the dialog wrapper, unless the wrapper itself is the intended target.
- In tests, prefer role/name-based queries and split multi-key keyboard sequences when DOM state changes between keystrokes.
