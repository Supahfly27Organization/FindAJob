# client/ — FindAJob UI

## Architecture
- React 19 + TypeScript 6, built with Vite 8. `react-router-dom` for client-side routing (`/titles`, `/settings`).
- `src/api/http.ts` — `apiFetch<T>()` wraps `fetch`, throws `ApiError` (carries `.status`) on non-2xx responses. All other `src/api/*.ts` modules are thin, typed wrappers around it — one file per backend resource.
- `src/pages/*.tsx` — one page per route, each owning its own data fetching/state (no global state library; this app doesn't need one).
- In dev, Vite's dev server (port 5173) proxies `/api/*` to the Express server (port 4000) — see `vite.config.ts`. In production the built app is served by that same Express server, so `fetch('/api/...')` works unchanged in both modes.

## Key decisions
- No global state management (Redux/Zustand/etc.) — each page fetches what it needs on mount and re-fetches after mutations. Revisit only if cross-page shared state becomes a real need.
- Delete/status-change confirmations are inline in the row (not `window.confirm`) so they're testable with React Testing Library and match the stories' "I can cancel without deleting anything" acceptance criteria.

## Playbook: adding a page
1. Add a typed API client function in `src/api/<resource>.ts` (using `apiFetch`).
2. Write `src/pages/<Page>.test.tsx` first — mock `global.fetch` via `vi.stubGlobal('fetch', ...)`, cover the happy path, empty state, and at least one error state.
3. Implement `src/pages/<Page>.tsx`.
4. Add a `<Route>` (and `<NavLink>` if it's top-level) in `src/App.tsx`.
5. Run `npx vitest run` from `client/`.
