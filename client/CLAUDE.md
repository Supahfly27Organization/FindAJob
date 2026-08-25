# client/ — FindAJob UI

## Architecture
- React 19 + TypeScript 6, built with Vite 8. `react-router-dom` for client-side routing (`/titles`, `/settings`).
- `src/api/http.ts` — `apiFetch<T>()` wraps `fetch`, throws `ApiError` (carries `.status`) on non-2xx responses. All other `src/api/*.ts` modules are thin, typed wrappers around it — one file per backend resource. `apiUpload<T>(path, formData)` is the multipart counterpart: it sends `FormData` with no explicit `Content-Type` (the browser sets the multipart boundary), since `apiFetch` always forces `application/json`.
- `src/pages/*.tsx` — one page per route, each owning its own data fetching/state (no global state library; this app doesn't need one).
- In dev, Vite's dev server (port 5173) proxies `/api/*` to the Express server (port 4000) — see `vite.config.ts`. In production the built app is served by that same Express server, so `fetch('/api/...')` works unchanged in both modes.

## Key decisions
- No global state management (Redux/Zustand/etc.) — each page fetches what it needs on mount and re-fetches after mutations. Revisit only if cross-page shared state becomes a real need.
- Delete/status-change confirmations are inline in the row (not `window.confirm`) so they're testable with React Testing Library and match the stories' "I can cancel without deleting anything" acceptance criteria.
- "Search all" (Story 2.2) has no dedicated backend endpoint — `PositionTitlesPage` calls the single-title search endpoint once per title, sequentially, tracking per-title state (`idle | searching | done | error`) so failures are isolated and retryable per title without any new state-management library.
- The status `<select>` on `PostingsPage` only offers `New | In Progress | Rejected` — `Applied` requires the CV-upload flow (Plan 4) and isn't reachable from the UI yet; a posting already `Applied` (once Plan 4 ships) renders as plain text there instead of an editable control.
- The resume template file input on `SettingsPage` keeps `accept=".docx,.pdf,.txt,.md"` (a real UX affordance — it narrows the native OS file picker for real users). Format validation itself is enforced server-side (Task 5's `POST /api/settings/resume-template`). `@testing-library/user-event`'s `upload()` filters files against an input's `accept` attribute by default, which would make an unsupported-extension file untestable — the one test that needs to upload such a file (`'shows a validation error when the template upload fails'`) uses `userEvent.setup({ applyAccept: false })` to bypass the library's own accept-filtering, with no production behavior change.

## Playbook: adding a page
1. Add a typed API client function in `src/api/<resource>.ts` (using `apiFetch`).
2. Write `src/pages/<Page>.test.tsx` first — mock `global.fetch` via `vi.stubGlobal('fetch', ...)`, cover the happy path, empty state, and at least one error state.
3. Implement `src/pages/<Page>.tsx`.
4. Add a `<Route>` (and `<NavLink>` if it's top-level) in `src/App.tsx`.
5. Run `npx vitest run` from `client/`.
