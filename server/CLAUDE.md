# server/ — FindAJob API

## Architecture
- Node.js (ESM), Express 4, SQLite via `better-sqlite3` (synchronous — no async DB calls needed for this single-user local app).
- `src/app.js` — `createApp(db)` builds the Express app (no `listen()`, so it's testable via Supertest); `errorHandler` maps thrown errors to HTTP responses.
- `src/server.js` — the real entrypoint: opens/creates the SQLite DB, builds the app, registers all routes, serves the built client from `client/dist` when present, starts listening, and opens the user's browser.
- `src/db/schema.sql` — the entire schema, applied idempotently (`CREATE TABLE IF NOT EXISTS`) on every startup. No migration framework for v1 — schema changes are additive edits to this file.
- `src/services/*` — business logic and all DB access (one file per domain concept).
- `src/routes/*` — thin Express routers that call into services and translate results/errors to HTTP.

## Key decisions
- `ValidationError`/`NotFoundError` (`src/errors.js`) carry `.status`; the shared `errorHandler` in `app.js` reads that to respond, so route handlers just `try { ... } catch (error) { next(error); }`.
- Deleting a position title does **not** delete its postings — `postings.position_title_id` is nullable with `ON DELETE SET NULL`; the service explicitly unlinks in a transaction so nothing on disk (adapted resumes, applied CVs, once those exist) is ever silently lost.
- The OpenAI API key is stored in the `settings` table (not `.env`), so it's configurable from the running app's Settings page without restarting or editing files.
- `posting.status` is exactly `New | Applied | In Progress | Rejected` (a DB `CHECK` constraint enforces this); `viewed` is a separate boolean column, not a status value.
- Search (`searchService.js`) is a pure orchestrator: it validates the OpenAI key is configured, delegates the actual call to `openaiClient.js` (swappable via a `fetchPostings` param so tests never hit the network), then hands raw candidates to `postingService.saveSearchResults`, which enforces the 20-result cap, the 45-day freshness window, and URL-based dedup (existing rows/status are never touched on a re-find).
- `updatePostingStatus` only accepts `New | In Progress | Rejected` — moving a posting to `Applied` requires the CV-upload flow (Story 3.3, Plan 4) and is rejected with a `ValidationError` until that flow exists.

## Playbook: adding an endpoint
1. Add/extend a function in the relevant `src/services/*.js` file — pure business logic + DB access, throwing `ValidationError`/`NotFoundError` as needed. Write its unit test first (`test/<service>.test.js`), using `createDb(':memory:')`.
2. Add a route in `src/routes/*.js` that calls the service inside a `try/catch` → `next(error)`. Write its Supertest test (`test/<routes>.test.js`).
3. Wire the router into `src/server.js` (import + `registerXRoutes(app, db)` call), **before** the `app.use(errorHandler)` line and before the static-serving block.
4. Run `npx vitest run` from `server/`.
