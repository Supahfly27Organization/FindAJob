# client/ — FindAJob UI

## Architecture
- React 19 + TypeScript 6, built with Vite 8. `react-router-dom` for client-side routing (`/titles`, `/titles/:id/postings`; anything else redirects to `/titles`).
- `src/api/http.ts` — `apiFetch<T>()` wraps `fetch`, throws `ApiError` (carries `.status`) on non-2xx responses. All other `src/api/*.ts` modules are thin, typed wrappers around it — one file per backend resource. `apiUpload<T>(path, formData)` is the multipart counterpart: it sends `FormData` with no explicit `Content-Type` (the browser sets the multipart boundary), since `apiFetch` always forces `application/json`.
- `src/pages/*.tsx` — one page per route, each owning its own data fetching/state (no global state library; this app doesn't need one).
- In dev, Vite's dev server (port 5173) proxies `/api/*` to the Express server (port 4000) — see `vite.config.ts`. In production the built app is served by that same Express server, so `fetch('/api/...')` works unchanged in both modes.

## Key decisions
- No global state management (Redux/Zustand/etc.) — each page fetches what it needs on mount and re-fetches after mutations. Revisit only if cross-page shared state becomes a real need.
- Delete/status-change confirmations are inline in the row (not `window.confirm`) so they're testable with React Testing Library and match the stories' "I can cancel without deleting anything" acceptance criteria.
- "Search all" (Story 2.2) has no dedicated backend endpoint — `PositionTitlesPage` calls the single-title search endpoint once per title, sequentially, tracking per-title state (`idle | searching | done | error`) so failures are isolated and retryable per title without any new state-management library.
- The status `<select>` on `PostingsPage` offers all four statuses, but picking `Applied` opens an inline upload panel (`role="dialog"`, rendered in the status cell — not a real modal, same testability reasoning as the inline confirmations above) instead of calling the status endpoint. The select stays controlled by `posting.status`, so cancelling or a failed upload visually reverts it for free. Only a successful `POST /api/postings/:id/applied-cv` moves the row to Applied. An already-Applied posting keeps an editable select (she can move it to In Progress/Rejected directly).
- **There is no Settings page.** The OpenAI key (`OPENAI_API_KEY` in the repo-root `.env`) and the resume template (`Resume.docx` at the repo root) are edited as files, so the UI only ever *reports* when one is missing — the server's error text names the file to fix, and the client just renders it.
- The applied-CV file input keeps `accept=".docx,.pdf,.txt,.md"` (a real UX affordance — it narrows the native OS file picker). Format validation itself is enforced server-side. `@testing-library/user-event`'s `upload()` filters files against an input's `accept` attribute by default, which would make an unsupported-extension file untestable — the one test that uploads such a file uses `userEvent.setup({ applyAccept: false })` to bypass that, with no production behavior change.
- File uploads (resume template, applied CV) use a dedicated `apiUpload()` in `src/api/http.ts` instead of `apiFetch()` — it sends a `FormData` body with no explicit `Content-Type` header, letting the browser set the multipart boundary itself. `apiFetch()` always forces `Content-Type: application/json`, which would corrupt a multipart body.
- "Adapt my resume" on `PostingsPage` follows the same inline-confirmation pattern as delete/status-change: clicking it when a posting already has an adapted resume shows an inline "Replace existing adapted resume?" prompt (not `window.confirm`) instead of adapting immediately.

## Playbook: adding a page
1. Add a typed API client function in `src/api/<resource>.ts` (using `apiFetch`).
2. Write `src/pages/<Page>.test.tsx` first — mock `global.fetch` via `vi.stubGlobal('fetch', ...)`, cover the happy path, empty state, and at least one error state.
3. Implement `src/pages/<Page>.tsx`.
4. Add a `<Route>` (and `<NavLink>` if it's top-level) in `src/App.tsx`.
5. Run `npx vitest run` from `client/`.
