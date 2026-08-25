# Job Search Assistant — Foundation & Position Titles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the FindAJob app's foundation — a single-command local dev/run setup (React + TypeScript frontend, Node.js/Express backend, SQLite storage) — and deliver the Position Titles CRUD flow (Epic 1) and OpenAI API key configuration (Story 5.1) end-to-end, in the browser.

**Architecture:** An npm-workspaces monorepo with `server/` (Express API + SQLite via `better-sqlite3`, ESM) and `client/` (React + TypeScript SPA built with Vite). In production, the Express server serves the built client's static files *and* the `/api/*` routes from one process on one port (`npm start` builds then runs it, and auto-opens the browser). In dev, Vite's dev server proxies `/api` to the Express server so both run with hot reload. Business logic lives in `server/src/services/*`; thin Express routers in `server/src/routes/*` translate HTTP ↔ services; a shared `errorHandler` maps thrown `ValidationError`/`NotFoundError` to HTTP responses.

**Tech Stack:** Node.js (ESM) + Express 4 + better-sqlite3 (backend) · React 18 + TypeScript + Vite + react-router-dom (frontend) · Vitest + Supertest + React Testing Library + user-event (tests).

**Spec:**
- `docs/product-superpowers/prds/2026-08-25-job-search-assistant.md`
- `docs/product-superpowers/stories/2026-08-25-job-search-assistant-stories.md`

**Plan sequence:** This is **Plan 1 of 4** for the full feature. Plan 2 (Search & Results — Epic 2, Stories 3.1/3.2) builds on this plan's DB schema and route/service patterns; Plan 3 (Resume Adaptation — Epic 4) and Plan 4 (Applied CV Tracking & Packaging — Stories 3.3/3.4) follow. Each plan is independently working, testable software.

## Global Constraints

- Local-only app, no authentication (PRD Constraints).
- Posting `status` is exactly `New | Applied | In Progress | Rejected`; `viewed` is a separate boolean flag, never a status value (PRD/Stories revision note, 2026-08-25).
- Deleting a position title must keep its postings (and any generated files) — only unlink them from the title, never delete them (Story 1.3 edge case decision).
- Single Node process serves both the API and the built frontend so running the app is one command / one click (explicit user direction).
- Node.js >= 18 required (native `fetch`/ESM support assumed by tooling versions below).

---

## File Structure

```
FindAJob/
  package.json                 # root workspace: dev/build/start/test scripts
  .gitignore
  server/
    package.json
    src/
      app.js                   # createApp(db), errorHandler
      server.js                # entrypoint: db + app + static serving + listen + open browser
      config.js                # PORT, DB_PATH, CLIENT_DIST_PATH
      errors.js                # ValidationError, NotFoundError
      db/
        schema.sql
        index.js                # createDb(path)
      services/
        positionTitleService.js
        settingsService.js
      routes/
        positionTitles.js
        settings.js
    test/
      db.test.js
      app.test.js
      positionTitleService.test.js
      positionTitles.routes.test.js
      settingsService.test.js
      settings.routes.test.js
    data/                       # gitignored: sqlite db file
    CLAUDE.md
  client/
    package.json
    vite.config.ts
    vitest.setup.ts
    index.html
    src/
      main.tsx
      App.tsx
      App.css
      types.ts
      api/
        http.ts
        positionTitles.ts
        settings.ts
      pages/
        PositionTitlesPage.tsx
        PositionTitlesPage.test.tsx
        SettingsPage.tsx
        SettingsPage.test.tsx
      App.test.tsx
    CLAUDE.md
```

---

### Task 1: Monorepo & tooling scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `server/package.json`
- Create: `client/` (via Vite scaffold command below), then modify `client/package.json`, `client/vite.config.ts`, `client/vitest.setup.ts`

**Interfaces:**
- Produces: root npm scripts `dev`, `build`, `start`, `test` that later tasks rely on; `client` and `server` npm workspaces.

- [ ] **Step 1: Create the root `package.json`**

```json
{
  "name": "findajob",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"npm run start --workspace server\" \"npm run dev --workspace client\"",
    "build": "npm run build --workspace client",
    "start": "npm run build --workspace client && npm run start --workspace server",
    "test": "npm run test --workspace server && npm run test --workspace client"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Create the root `.gitignore`**

```
node_modules/
client/dist/
server/data/
*.log
.env
.env.local
```

- [ ] **Step 3: Create `server/package.json`**

```json
{
  "name": "findajob-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "open": "^10.1.0"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 4: Scaffold the client with Vite's React + TypeScript template**

Run from the repo root:

```bash
npm create vite@latest client -- --template react-ts
```

This creates `client/` with `package.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `tsconfig*.json`, `vite.config.ts`, etc. Leave the generated files as-is for now — later steps and Task 6 replace the demo content.

- [ ] **Step 5: Edit `client/package.json`** to set the name, add the `test` script, and add the extra dependencies this plan needs (react-router-dom, vitest, jsdom, React Testing Library, user-event). Keep whatever `react`/`vite`/`typescript` versions the scaffold generated; add:

```json
{
  "dependencies": {
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^24.1.1",
    "vitest": "^2.0.5"
  }
}
```

merged into the existing `dependencies`/`devDependencies` objects, and add `"test": "vitest run"` to `scripts`.

- [ ] **Step 6: Replace `client/vite.config.ts`** with:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts']
  }
});
```

- [ ] **Step 7: Create `client/vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 8: Install and verify**

Run from the repo root:

```bash
npm install
npm run build --workspace client
```

Expected: install succeeds (note: `better-sqlite3` downloads a prebuilt binary — if it fails to install on Windows, confirm you're on a supported Node LTS version (18/20/22) and retry; a full native rebuild should not be necessary), and `client/dist/` is produced with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add package.json .gitignore server/package.json client
git status
git commit -m "chore: scaffold npm workspaces monorepo (server + client)"
```

---

### Task 2: SQLite database module & schema

**Files:**
- Create: `server/src/db/schema.sql`
- Create: `server/src/db/index.js`
- Test: `server/test/db.test.js`

**Interfaces:**
- Produces: `createDb(filePath: string) => Database` (a `better-sqlite3` instance with the schema applied), used by every later server task.

- [ ] **Step 1: Write the failing test**

`server/test/db.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/index.js';

describe('createDb', () => {
  it('creates the expected tables', () => {
    const db = createDb(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);
    expect(tables).toEqual(['position_titles', 'postings', 'settings']);
    db.close();
  });

  it('enforces unique, case-insensitive position titles', () => {
    const db = createDb(':memory:');
    db.prepare('INSERT INTO position_titles (title) VALUES (?)').run('Product Manager');
    expect(() =>
      db.prepare('INSERT INTO position_titles (title) VALUES (?)').run('product manager')
    ).toThrow();
    db.close();
  });

  it('rejects an invalid posting status', () => {
    const db = createDb(':memory:');
    db.prepare('INSERT INTO position_titles (title) VALUES (?)').run('QA Engineer');
    expect(() =>
      db
        .prepare(
          `INSERT INTO postings (position_title_id, posting_title, url, status)
           VALUES (1, 'QA Engineer', 'https://example.com/job/1', 'Bogus')`
        )
        .run()
    ).toThrow();
    db.close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `server/`): `npx vitest run test/db.test.js`
Expected: FAIL — `Cannot find module '../src/db/index.js'`

- [ ] **Step 3: Create the schema**

`server/src/db/schema.sql`:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS position_titles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS postings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_title_id INTEGER REFERENCES position_titles(id) ON DELETE SET NULL,
  posting_title TEXT NOT NULL,
  description TEXT,
  company TEXT,
  url TEXT NOT NULL UNIQUE,
  location TEXT,
  published_date TEXT,
  found_at TEXT NOT NULL DEFAULT (datetime('now')),
  viewed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Applied', 'In Progress', 'Rejected')),
  adapted_resume_path TEXT,
  applied_cv_path TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

- [ ] **Step 4: Create the DB module**

`server/src/db/index.js`:

```js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export function createDb(filePath) {
  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  return db;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from `server/`): `npx vitest run test/db.test.js`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add server/src/db server/test/db.test.js
git commit -m "feat(server): add SQLite schema and createDb module"
```

---

### Task 3: Express app skeleton + error handler + server entrypoint

**Files:**
- Create: `server/src/app.js`
- Create: `server/src/config.js`
- Create: `server/src/errors.js`
- Create: `server/src/server.js`
- Test: `server/test/app.test.js`

**Interfaces:**
- Consumes: `createDb` from Task 2.
- Produces: `createApp(db) => express.Application`, `errorHandler(err, req, res, next)`, `ValidationError`/`NotFoundError` (both carry `.status`) — all relied on by every later route task.

- [ ] **Step 1: Write the failing tests**

`server/test/app.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';
import { createDb } from '../src/db/index.js';

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const db = createDb(':memory:');
    const app = createApp(db);
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

function mockResponse() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('uses the error status and message when present', () => {
    const res = mockResponse();
    errorHandler({ status: 404, message: 'Not found' }, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not found' });
  });

  it('falls back to 500 for unexpected errors', () => {
    const res = mockResponse();
    const originalError = console.error;
    console.error = vi.fn();
    errorHandler(new Error('boom'), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    console.error = originalError;
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/app.test.js`
Expected: FAIL — `Cannot find module '../src/app.js'`

- [ ] **Step 3: Create `server/src/errors.js`**

```js
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}
```

- [ ] **Step 4: Create `server/src/config.js`**

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
export const DB_PATH =
  process.env.FINDAJOB_DB_PATH || path.join(__dirname, '..', 'data', 'findajob.db');
export const CLIENT_DIST_PATH = path.join(__dirname, '..', '..', 'client', 'dist');
```

- [ ] **Step 5: Create `server/src/app.js`**

```js
import express from 'express';
import cors from 'cors';

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.locals.db = db;

  return app;
}

export function errorHandler(error, req, res, next) {
  if (error.status) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
}
```

- [ ] **Step 6: Create `server/src/server.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import open from 'open';
import { createApp, errorHandler } from './app.js';
import { createDb } from './db/index.js';
import { PORT, DB_PATH, CLIENT_DIST_PATH } from './config.js';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = createDb(DB_PATH);
const app = createApp(db);

if (fs.existsSync(CLIENT_DIST_PATH)) {
  app.use(express.static(CLIENT_DIST_PATH));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST_PATH, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`FindAJob running at ${url}`);
  open(url).catch(() => {});
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/app.test.js`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add server/src/app.js server/src/config.js server/src/errors.js server/src/server.js server/test/app.test.js
git commit -m "feat(server): add Express app skeleton, error handler, and entrypoint"
```

---

### Task 4: Position title service

**Files:**
- Create: `server/src/services/positionTitleService.js`
- Test: `server/test/positionTitleService.test.js`

**Interfaces:**
- Consumes: `createDb` (Task 2), `ValidationError`/`NotFoundError` (Task 3).
- Produces: `createPositionTitle(db, rawTitle)`, `listPositionTitles(db)`, `getPositionTitleById(db, id)`, `updatePositionTitle(db, id, rawTitle)`, `deletePositionTitle(db, id) => { unlinkedPostingsCount }` — all relied on by Task 5's routes.

- [ ] **Step 1: Write the failing tests**

`server/test/positionTitleService.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import {
  createPositionTitle,
  listPositionTitles,
  updatePositionTitle,
  deletePositionTitle
} from '../src/services/positionTitleService.js';
import { ValidationError, NotFoundError } from '../src/errors.js';

let db;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('createPositionTitle', () => {
  it('creates a title with no postings yet', () => {
    createPositionTitle(db, 'Product Manager');
    expect(listPositionTitles(db)).toEqual([
      expect.objectContaining({ title: 'Product Manager', postingCount: 0 })
    ]);
  });

  it('trims whitespace before saving', () => {
    const created = createPositionTitle(db, '  Product Manager  ');
    expect(created.title).toBe('Product Manager');
  });

  it('rejects an empty title', () => {
    expect(() => createPositionTitle(db, '   ')).toThrow(ValidationError);
  });

  it('rejects a duplicate title case-insensitively', () => {
    createPositionTitle(db, 'Product Manager');
    expect(() => createPositionTitle(db, 'product manager')).toThrow(
      'This title is already in your list'
    );
  });

  it('rejects a title longer than 200 characters', () => {
    expect(() => createPositionTitle(db, 'a'.repeat(201))).toThrow(ValidationError);
  });
});

describe('updatePositionTitle', () => {
  it('updates the title while keeping linked postings', () => {
    const created = createPositionTitle(db, 'Product Manger');
    db.prepare(
      'INSERT INTO postings (position_title_id, posting_title, url) VALUES (?, ?, ?)'
    ).run(created.id, 'Product Manger', 'https://example.com/job/1');

    const updated = updatePositionTitle(db, created.id, 'Product Manager');
    expect(updated.title).toBe('Product Manager');
    expect(listPositionTitles(db)[0].postingCount).toBe(1);
  });

  it('rejects updating to a title that already exists elsewhere', () => {
    createPositionTitle(db, 'Product Manager');
    const other = createPositionTitle(db, 'QA Engineer');
    expect(() => updatePositionTitle(db, other.id, 'Product Manager')).toThrow(
      'This title is already in your list'
    );
  });

  it('throws NotFoundError for a missing id', () => {
    expect(() => updatePositionTitle(db, 999, 'Anything')).toThrow(NotFoundError);
  });
});

describe('deletePositionTitle', () => {
  it('unlinks postings instead of deleting them', () => {
    const created = createPositionTitle(db, 'QA Engineer');
    db.prepare(
      'INSERT INTO postings (position_title_id, posting_title, url) VALUES (?, ?, ?)'
    ).run(created.id, 'QA Engineer', 'https://example.com/job/2');

    const result = deletePositionTitle(db, created.id);
    expect(result.unlinkedPostingsCount).toBe(1);

    const posting = db
      .prepare('SELECT position_title_id FROM postings WHERE url = ?')
      .get('https://example.com/job/2');
    expect(posting.position_title_id).toBeNull();
    expect(listPositionTitles(db)).toEqual([]);
  });

  it('throws NotFoundError for a missing id', () => {
    expect(() => deletePositionTitle(db, 999)).toThrow(NotFoundError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/positionTitleService.test.js`
Expected: FAIL — `Cannot find module '../src/services/positionTitleService.js'`

- [ ] **Step 3: Implement the service**

`server/src/services/positionTitleService.js`:

```js
import { ValidationError, NotFoundError } from '../errors.js';

const MAX_TITLE_LENGTH = 200;

function normalizeTitle(rawTitle) {
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (!title) {
    throw new ValidationError('Title is required');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }
  return title;
}

function isUniqueConstraintError(error) {
  return typeof error.message === 'string' && error.message.includes('UNIQUE constraint failed');
}

export function createPositionTitle(db, rawTitle) {
  const title = normalizeTitle(rawTitle);
  try {
    const result = db.prepare('INSERT INTO position_titles (title) VALUES (?)').run(title);
    return getPositionTitleById(db, result.lastInsertRowid);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ValidationError('This title is already in your list');
    }
    throw error;
  }
}

export function listPositionTitles(db) {
  return db
    .prepare(
      `SELECT pt.id, pt.title, pt.created_at AS createdAt,
              COUNT(p.id) AS postingCount
       FROM position_titles pt
       LEFT JOIN postings p ON p.position_title_id = pt.id
       GROUP BY pt.id
       ORDER BY pt.title COLLATE NOCASE`
    )
    .all();
}

export function getPositionTitleById(db, id) {
  const row = db
    .prepare('SELECT id, title, created_at AS createdAt FROM position_titles WHERE id = ?')
    .get(id);
  if (!row) {
    throw new NotFoundError(`Position title ${id} not found`);
  }
  return row;
}

export function updatePositionTitle(db, id, rawTitle) {
  getPositionTitleById(db, id);
  const title = normalizeTitle(rawTitle);
  try {
    db.prepare('UPDATE position_titles SET title = ? WHERE id = ?').run(title, id);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ValidationError('This title is already in your list');
    }
    throw error;
  }
  return getPositionTitleById(db, id);
}

export function deletePositionTitle(db, id) {
  getPositionTitleById(db, id);
  const unlink = db.prepare(
    'UPDATE postings SET position_title_id = NULL WHERE position_title_id = ?'
  );
  const remove = db.prepare('DELETE FROM position_titles WHERE id = ?');
  const runDelete = db.transaction((titleId) => {
    const { changes: unlinkedPostingsCount } = unlink.run(titleId);
    remove.run(titleId);
    return unlinkedPostingsCount;
  });
  return { unlinkedPostingsCount: runDelete(id) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/positionTitleService.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/positionTitleService.js server/test/positionTitleService.test.js
git commit -m "feat(server): add position title service with CRUD and dedupe rules"
```

---

### Task 5: Position title REST API routes

**Files:**
- Create: `server/src/routes/positionTitles.js`
- Modify: `server/src/server.js`
- Test: `server/test/positionTitles.routes.test.js`

**Interfaces:**
- Consumes: `positionTitleService` functions (Task 4), `createApp`/`errorHandler` (Task 3).
- Produces: `registerPositionTitleRoutes(app, db)` mounting `GET/POST /api/position-titles`, `PUT/DELETE /api/position-titles/:id`.

- [ ] **Step 1: Write the failing tests**

`server/test/positionTitles.routes.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import { registerPositionTitleRoutes } from '../src/routes/positionTitles.js';

let app;

beforeEach(() => {
  const db = createDb(':memory:');
  app = createApp(db);
  registerPositionTitleRoutes(app, db);
  app.use(errorHandler);
});

describe('POST /api/position-titles', () => {
  it('creates a title', async () => {
    const response = await request(app)
      .post('/api/position-titles')
      .send({ title: 'Product Manager' });
    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Product Manager');
  });

  it('rejects an empty title', async () => {
    const response = await request(app).post('/api/position-titles').send({ title: '  ' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Title is required');
  });

  it('rejects a duplicate title', async () => {
    await request(app).post('/api/position-titles').send({ title: 'Product Manager' });
    const response = await request(app)
      .post('/api/position-titles')
      .send({ title: 'product manager' });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/position-titles', () => {
  it('lists titles with posting counts', async () => {
    await request(app).post('/api/position-titles').send({ title: 'QA Engineer' });
    const response = await request(app).get('/api/position-titles');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ title: 'QA Engineer', postingCount: 0 })
    ]);
  });
});

describe('PUT /api/position-titles/:id', () => {
  it('updates a title', async () => {
    const created = await request(app)
      .post('/api/position-titles')
      .send({ title: 'Product Manger' });
    const response = await request(app)
      .put(`/api/position-titles/${created.body.id}`)
      .send({ title: 'Product Manager' });
    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Product Manager');
  });

  it('returns 404 for a missing title', async () => {
    const response = await request(app)
      .put('/api/position-titles/999')
      .send({ title: 'Anything' });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/position-titles/:id', () => {
  it('deletes a title and reports unlinked postings', async () => {
    const created = await request(app).post('/api/position-titles').send({ title: 'QA Engineer' });
    const response = await request(app).delete(`/api/position-titles/${created.body.id}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ unlinkedPostingsCount: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/positionTitles.routes.test.js`
Expected: FAIL — `Cannot find module '../src/routes/positionTitles.js'`

- [ ] **Step 3: Implement the routes**

`server/src/routes/positionTitles.js`:

```js
import { Router } from 'express';
import {
  createPositionTitle,
  listPositionTitles,
  updatePositionTitle,
  deletePositionTitle
} from '../services/positionTitleService.js';

export function registerPositionTitleRoutes(app, db) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(listPositionTitles(db));
  });

  router.post('/', (req, res, next) => {
    try {
      res.status(201).json(createPositionTitle(db, req.body.title));
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', (req, res, next) => {
    try {
      res.json(updatePositionTitle(db, Number(req.params.id), req.body.title));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', (req, res, next) => {
    try {
      res.json(deletePositionTitle(db, Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/position-titles', router);
}
```

- [ ] **Step 4: Wire the routes into the server entrypoint**

Modify `server/src/server.js` — add the import and the registration call right after `const app = createApp(db);` (before the static-serving block):

```js
import { registerPositionTitleRoutes } from './routes/positionTitles.js';
```

```js
const app = createApp(db);
registerPositionTitleRoutes(app, db);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/positionTitles.routes.test.js`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/positionTitles.js server/src/server.js server/test/positionTitles.routes.test.js
git commit -m "feat(server): add position titles REST API"
```

---

### Task 6: React app shell + Position Titles page

**Files:**
- Create: `client/src/types.ts`
- Create: `client/src/api/http.ts`
- Create: `client/src/api/positionTitles.ts`
- Create: `client/src/api/settings.ts` (interface stub used by Task 8; see Step 7)
- Create: `client/src/pages/PositionTitlesPage.tsx`
- Create: `client/src/pages/PositionTitlesPage.test.tsx`
- Create: `client/src/pages/SettingsPage.tsx` (minimal placeholder page, fleshed out in Task 8)
- Modify: `client/src/App.tsx`
- Modify: `client/src/main.tsx`
- Create: `client/src/App.test.tsx`
- Modify: `client/src/App.css`

**Interfaces:**
- Produces: `apiFetch<T>(path, init)` / `ApiError` (used by every later API module), `PositionTitle` type, `fetchPositionTitles`/`createPositionTitle`/`updatePositionTitle`/`deletePositionTitle` client functions, routed `App` with `/titles` and `/settings`.

- [ ] **Step 1: Write the failing tests**

`client/src/pages/PositionTitlesPage.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PositionTitlesPage from './PositionTitlesPage';

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  let call = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const response = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return {
        ok: response.status < 400,
        status: response.status,
        json: async () => response.body
      } as Response;
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PositionTitlesPage', () => {
  it('shows an empty state when there are no titles', async () => {
    mockFetchSequence([{ status: 200, body: [] }]);
    render(<PositionTitlesPage />);
    expect(await screen.findByText(/no position titles yet/i)).toBeInTheDocument();
  });

  it('lists titles with their posting counts', async () => {
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'Product Manager', createdAt: '', postingCount: 4 }] }
    ]);
    render(<PositionTitlesPage />);
    expect(await screen.findByText('Product Manager')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('adds a new title and refreshes the list', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [] },
      { status: 201, body: { id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 } },
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] }
    ]);
    render(<PositionTitlesPage />);
    await screen.findByText(/no position titles yet/i);

    await user.type(screen.getByLabelText(/new position title/i), 'QA Engineer');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('QA Engineer')).toBeInTheDocument();
  });

  it('shows a validation error from the server when adding fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [] },
      { status: 400, body: { message: 'This title is already in your list' } }
    ]);
    render(<PositionTitlesPage />);
    await screen.findByText(/no position titles yet/i);

    await user.type(screen.getByLabelText(/new position title/i), 'QA Engineer');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This title is already in your list'
    );
  });

  it('deletes a title after confirming', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] },
      { status: 200, body: { unlinkedPostingsCount: 0 } },
      { status: 200, body: [] }
    ]);
    render(<PositionTitlesPage />);
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(await screen.findByText(/no position titles yet/i)).toBeInTheDocument();
  });
});
```

`client/src/App.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('defaults to the Position Titles page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as Response)
    );
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /position titles/i })).toBeInTheDocument();
  });

  it('navigates to Settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as Response)
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/titles']}>
        <App />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('link', { name: /settings/i }));
    expect(await screen.findByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `client/`): `npx vitest run src/pages/PositionTitlesPage.test.tsx src/App.test.tsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Create `client/src/types.ts`**

```ts
export interface PositionTitle {
  id: number;
  title: string;
  createdAt: string;
  postingCount: number;
}
```

- [ ] **Step 4: Create `client/src/api/http.ts`**

```ts
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(body.message ?? 'Request failed', response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 5: Create `client/src/api/positionTitles.ts`**

```ts
import { apiFetch } from './http';
import type { PositionTitle } from '../types';

export function fetchPositionTitles(): Promise<PositionTitle[]> {
  return apiFetch<PositionTitle[]>('/api/position-titles');
}

export function createPositionTitle(title: string): Promise<PositionTitle> {
  return apiFetch<PositionTitle>('/api/position-titles', {
    method: 'POST',
    body: JSON.stringify({ title })
  });
}

export function updatePositionTitle(id: number, title: string): Promise<PositionTitle> {
  return apiFetch<PositionTitle>(`/api/position-titles/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title })
  });
}

export function deletePositionTitle(id: number): Promise<{ unlinkedPostingsCount: number }> {
  return apiFetch(`/api/position-titles/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 6: Create `client/src/pages/PositionTitlesPage.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import type { PositionTitle } from '../types';
import {
  createPositionTitle,
  deletePositionTitle,
  fetchPositionTitles,
  updatePositionTitle
} from '../api/positionTitles';
import { ApiError } from '../api/http';

export default function PositionTitlesPage() {
  const [titles, setTitles] = useState<PositionTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);

  async function loadTitles() {
    setLoading(true);
    setListError(null);
    try {
      setTitles(await fetchPositionTitles());
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : 'Failed to load position titles');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTitles();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setAddError(null);
    try {
      await createPositionTitle(newTitle);
      setNewTitle('');
      await loadTitles();
    } catch (error) {
      setAddError(error instanceof ApiError ? error.message : 'Failed to add title');
    }
  }

  function startEditing(title: PositionTitle) {
    setEditingId(title.id);
    setEditingValue(title.title);
    setEditError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingValue('');
    setEditError(null);
  }

  async function saveEditing(id: number) {
    setEditError(null);
    try {
      await updatePositionTitle(id, editingValue);
      cancelEditing();
      await loadTitles();
    } catch (error) {
      setEditError(error instanceof ApiError ? error.message : 'Failed to update title');
    }
  }

  async function confirmDelete(id: number) {
    await deletePositionTitle(id);
    setConfirmingDeleteId(null);
    await loadTitles();
  }

  if (loading) {
    return <p>Loading position titles…</p>;
  }

  return (
    <section>
      <h1>Position Titles</h1>

      <form onSubmit={handleAdd} aria-label="Add position title">
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="e.g. Product Manager"
          aria-label="New position title"
        />
        <button type="submit">Add</button>
        {addError && <p role="alert">{addError}</p>}
      </form>

      {listError && <p role="alert">{listError}</p>}

      {titles.length === 0 ? (
        <p>No position titles yet. Add one above to start searching.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Postings found</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {titles.map((title) => (
              <tr key={title.id}>
                <td>
                  {editingId === title.id ? (
                    <>
                      <input
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                        aria-label={`Edit ${title.title}`}
                      />
                      {editError && <p role="alert">{editError}</p>}
                    </>
                  ) : (
                    title.title
                  )}
                </td>
                <td>{title.postingCount}</td>
                <td>
                  {editingId === title.id ? (
                    <>
                      <button onClick={() => saveEditing(title.id)}>Save</button>
                      <button onClick={cancelEditing}>Cancel</button>
                    </>
                  ) : confirmingDeleteId === title.id ? (
                    <>
                      <span>
                        Delete "{title.title}"? Postings already found for it are kept, just
                        unlinked.
                      </span>
                      <button onClick={() => confirmDelete(title.id)}>Confirm</button>
                      <button onClick={() => setConfirmingDeleteId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditing(title)}>Edit</button>
                      <button onClick={() => setConfirmingDeleteId(title.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Create a minimal `client/src/pages/SettingsPage.tsx`** (Task 8 replaces the body with the real API-key form)

```tsx
export default function SettingsPage() {
  return (
    <section>
      <h1>Settings</h1>
      <p>Configuration options will appear here.</p>
    </section>
  );
}
```

- [ ] **Step 8: Replace `client/src/App.tsx`**

```tsx
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import PositionTitlesPage from './pages/PositionTitlesPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <nav className="app-nav">
        <NavLink to="/titles" className={({ isActive }) => (isActive ? 'active' : '')}>
          Position Titles
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          Settings
        </NavLink>
      </nav>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/titles" replace />} />
          <Route path="/titles" element={<PositionTitlesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 9: Replace `client/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 10: Replace `client/src/App.css`** with minimal nav styling

```css
.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
  text-align: left;
}

.app-nav {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #ddd;
  padding-bottom: 0.5rem;
}

.app-nav a.active {
  font-weight: 700;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}
```

- [ ] **Step 11: Run the tests to verify they pass**

Run (from `client/`): `npx vitest run src/pages/PositionTitlesPage.test.tsx src/App.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 12: Commit**

```bash
git add client/src
git commit -m "feat(client): add app shell, routing, and Position Titles page"
```

---

### Task 7: Settings service & REST routes (OpenAI API key)

**Files:**
- Create: `server/src/services/settingsService.js`
- Create: `server/src/routes/settings.js`
- Modify: `server/src/server.js`
- Test: `server/test/settingsService.test.js`
- Test: `server/test/settings.routes.test.js`

**Interfaces:**
- Consumes: `createDb` (Task 2), `ValidationError` (Task 3).
- Produces: `getOpenAiKeyStatus(db) => { hasKey, maskedKey }`, `saveOpenAiKey(db, rawKey) => { hasKey, maskedKey }`, `getOpenAiKey(db) => string | null` (the last one is unused in this plan but is what Plan 2/3's OpenAI calls will import), `registerSettingsRoutes(app, db)` mounting `GET/PUT /api/settings/openai-key`.

- [ ] **Step 1: Write the failing tests**

`server/test/settingsService.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { getOpenAiKey, getOpenAiKeyStatus, saveOpenAiKey } from '../src/services/settingsService.js';
import { ValidationError } from '../src/errors.js';

let db;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('getOpenAiKeyStatus', () => {
  it('reports no key configured initially', () => {
    expect(getOpenAiKeyStatus(db)).toEqual({ hasKey: false, maskedKey: null });
  });
});

describe('saveOpenAiKey', () => {
  it('saves a valid-looking key and masks it', () => {
    const result = saveOpenAiKey(db, 'sk-abcdefghijklmnop');
    expect(result).toEqual({ hasKey: true, maskedKey: '••••mnop' });
    expect(getOpenAiKey(db)).toBe('sk-abcdefghijklmnop');
  });

  it('rejects a key that does not look like an OpenAI key', () => {
    expect(() => saveOpenAiKey(db, 'not-a-key')).toThrow(ValidationError);
  });

  it('replaces a previously saved key', () => {
    saveOpenAiKey(db, 'sk-firstkey1234567');
    saveOpenAiKey(db, 'sk-secondkey123456');
    expect(getOpenAiKey(db)).toBe('sk-secondkey123456');
  });
});
```

`server/test/settings.routes.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import { registerSettingsRoutes } from '../src/routes/settings.js';

let app;

beforeEach(() => {
  const db = createDb(':memory:');
  app = createApp(db);
  registerSettingsRoutes(app, db);
  app.use(errorHandler);
});

describe('GET /api/settings/openai-key', () => {
  it('reports no key configured initially', async () => {
    const response = await request(app).get('/api/settings/openai-key');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasKey: false, maskedKey: null });
  });
});

describe('PUT /api/settings/openai-key', () => {
  it('saves a valid key', async () => {
    const response = await request(app)
      .put('/api/settings/openai-key')
      .send({ apiKey: 'sk-abcdefghijklmnop' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasKey: true, maskedKey: '••••mnop' });
  });

  it('rejects an invalid key', async () => {
    const response = await request(app)
      .put('/api/settings/openai-key')
      .send({ apiKey: 'nope' });
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/settingsService.test.js test/settings.routes.test.js`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement the service**

`server/src/services/settingsService.js`:

```js
import { ValidationError } from '../errors.js';

const OPENAI_KEY_SETTING = 'openaiApiKey';
const KEY_FORMAT = /^sk-[A-Za-z0-9_-]{10,}$/;

export function getOpenAiKeyStatus(db) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(OPENAI_KEY_SETTING);
  if (!row || !row.value) {
    return { hasKey: false, maskedKey: null };
  }
  return { hasKey: true, maskedKey: `••••${row.value.slice(-4)}` };
}

export function saveOpenAiKey(db, rawKey) {
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!KEY_FORMAT.test(key)) {
    throw new ValidationError('That does not look like a valid OpenAI API key');
  }
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(OPENAI_KEY_SETTING, key);
  return getOpenAiKeyStatus(db);
}

export function getOpenAiKey(db) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(OPENAI_KEY_SETTING);
  return row?.value ?? null;
}
```

- [ ] **Step 4: Implement the routes**

`server/src/routes/settings.js`:

```js
import { Router } from 'express';
import { getOpenAiKeyStatus, saveOpenAiKey } from '../services/settingsService.js';

export function registerSettingsRoutes(app, db) {
  const router = Router();

  router.get('/openai-key', (req, res) => {
    res.json(getOpenAiKeyStatus(db));
  });

  router.put('/openai-key', (req, res, next) => {
    try {
      res.json(saveOpenAiKey(db, req.body.apiKey));
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/settings', router);
}
```

- [ ] **Step 5: Wire the routes into the server entrypoint**

Modify `server/src/server.js` — add the import and registration call alongside the position titles one:

```js
import { registerSettingsRoutes } from './routes/settings.js';
```

```js
const app = createApp(db);
registerPositionTitleRoutes(app, db);
registerSettingsRoutes(app, db);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/settingsService.test.js test/settings.routes.test.js`
Expected: PASS (7 tests)

- [ ] **Step 7: Commit**

```bash
git add server/src/services/settingsService.js server/src/routes/settings.js server/src/server.js server/test/settingsService.test.js server/test/settings.routes.test.js
git commit -m "feat(server): add OpenAI API key settings storage and API"
```

---

### Task 8: Settings page (frontend)

**Files:**
- Create: `client/src/api/settings.ts`
- Modify: `client/src/pages/SettingsPage.tsx`
- Create: `client/src/pages/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`/`ApiError` (Task 6).
- Produces: `fetchOpenAiKeyStatus`, `saveOpenAiKey` client functions, `OpenAiKeyStatus` type.

- [ ] **Step 1: Write the failing test**

`client/src/pages/SettingsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './SettingsPage';

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  let call = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const response = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return {
        ok: response.status < 400,
        status: response.status,
        json: async () => response.body
      } as Response;
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SettingsPage', () => {
  it('shows that no key is configured initially', async () => {
    mockFetchSequence([{ status: 200, body: { hasKey: false, maskedKey: null } }]);
    render(<SettingsPage />);
    expect(await screen.findByText(/no api key configured/i)).toBeInTheDocument();
  });

  it('shows the masked key once one is saved', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      { status: 200, body: { hasKey: true, maskedKey: '••••mnop' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no api key configured/i);

    await user.type(screen.getByLabelText(/openai api key/i), 'sk-abcdefghijklmnop');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/••••mnop/)).toBeInTheDocument();
  });

  it('shows a validation error when saving fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      { status: 400, body: { message: 'That does not look like a valid OpenAI API key' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no api key configured/i);

    await user.type(screen.getByLabelText(/openai api key/i), 'nope');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That does not look like a valid OpenAI API key'
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `client/`): `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: FAIL — no "no api key configured" text yet (current stub page)

- [ ] **Step 3: Create `client/src/api/settings.ts`**

```ts
import { apiFetch } from './http';

export interface OpenAiKeyStatus {
  hasKey: boolean;
  maskedKey: string | null;
}

export function fetchOpenAiKeyStatus(): Promise<OpenAiKeyStatus> {
  return apiFetch<OpenAiKeyStatus>('/api/settings/openai-key');
}

export function saveOpenAiKey(apiKey: string): Promise<OpenAiKeyStatus> {
  return apiFetch<OpenAiKeyStatus>('/api/settings/openai-key', {
    method: 'PUT',
    body: JSON.stringify({ apiKey })
  });
}
```

- [ ] **Step 4: Replace `client/src/pages/SettingsPage.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { fetchOpenAiKeyStatus, saveOpenAiKey, type OpenAiKeyStatus } from '../api/settings';
import { ApiError } from '../api/http';

export default function SettingsPage() {
  const [status, setStatus] = useState<OpenAiKeyStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadStatus() {
    setStatus(await fetchOpenAiKeyStatus());
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await saveOpenAiKey(apiKey);
      setStatus(updated);
      setApiKey('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1>Settings</h1>

      <h2>OpenAI API key</h2>
      {status?.hasKey ? (
        <p>Current key on file: {status.maskedKey}</p>
      ) : (
        <p>No API key configured yet. Search and resume adaptation won't work until one is set.</p>
      )}

      <form onSubmit={handleSave} aria-label="Update OpenAI API key">
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-..."
          aria-label="OpenAI API key"
        />
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from `client/`): `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full client test suite to confirm nothing else broke**

Run (from `client/`): `npx vitest run`
Expected: PASS (all suites, including `App.test.tsx`'s Settings navigation test)

- [ ] **Step 7: Commit**

```bash
git add client/src/api/settings.ts client/src/pages/SettingsPage.tsx client/src/pages/SettingsPage.test.tsx
git commit -m "feat(client): add Settings page for OpenAI API key"
```

---

### Task 9: Production build integration, root scripts verification, and module docs

**Files:**
- Modify: `CLAUDE.md` (root)
- Create: `server/CLAUDE.md`
- Create: `client/CLAUDE.md`

**Interfaces:** none (integration/documentation only).

- [ ] **Step 1: Run the full test suite from the root**

```bash
npm test
```

Expected: PASS (server + client suites, ~29 tests total)

- [ ] **Step 2: Verify the one-command production run**

```bash
npm start
```

Expected: builds `client/dist/`, then starts the server, logs `FindAJob running at http://localhost:4000`, and opens that URL in the default browser. Confirm in the browser that:
- `/` redirects to `/titles` and the Position Titles page loads (empty state).
- Adding a title via the UI works and persists across a page refresh (stored in `server/data/findajob.db`).
- `/settings` lets you save an API key and shows it masked after saving.

Stop the server (Ctrl+C) once verified.

- [ ] **Step 3: Verify the dev workflow**

```bash
npm run dev
```

Expected: both the Express server (port 4000) and the Vite dev server (port 5173) start; opening `http://localhost:5173` shows the same app with hot reload, and `/api/*` calls succeed via the Vite proxy. Stop both (Ctrl+C).

- [ ] **Step 4: Create `server/CLAUDE.md`**

```markdown
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

## Playbook: adding an endpoint
1. Add/extend a function in the relevant `src/services/*.js` file — pure business logic + DB access, throwing `ValidationError`/`NotFoundError` as needed. Write its unit test first (`test/<service>.test.js`), using `createDb(':memory:')`.
2. Add a route in `src/routes/*.js` that calls the service inside a `try/catch` → `next(error)`. Write its Supertest test (`test/<routes>.test.js`).
3. Wire the router into `src/server.js` (import + `registerXRoutes(app, db)` call), **before** the `app.use(errorHandler)` line and before the static-serving block.
4. Run `npx vitest run` from `server/`.
```

- [ ] **Step 5: Create `client/CLAUDE.md`**

```markdown
# client/ — FindAJob UI

## Architecture
- React 18 + TypeScript, built with Vite. `react-router-dom` for client-side routing (`/titles`, `/settings`).
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
```

- [ ] **Step 6: Update the root `CLAUDE.md`**

Replace the `## Local DB Defaults` section:

```markdown
## Local DB Defaults

| DB | Connection String |
|---|---|
| SQLite (local file) | `server/data/findajob.db` (created automatically on first run; override with `FINDAJOB_DB_PATH`) |
```

Replace the `## Task → Read These First` table's rows with real pointers (keep the header row and any project-specific rows already added):

```markdown
| Task | Read These |
|------|-----------|
| Add/change a backend endpoint or service | `server/CLAUDE.md` |
| Add/change a frontend page or API client | `client/CLAUDE.md` |
| Security / quality review | `docs/claude/SCANNING_TOOLS.md` |
```

Replace `## Repo Rules` item 1 and item 3 (they reference a .NET-style project layout that doesn't apply here):

```markdown
## Repo Rules

1. There is no migrations folder — `server/src/db/schema.sql` is the single source of schema truth, applied idempotently on every startup.
2. Preserve existing project names and namespaces when refactoring.
3. Frontend commands run from `client/`, backend commands run from `server/`; use the root `npm run dev` / `npm start` / `npm test` scripts to operate on both at once.
```

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md server/CLAUDE.md client/CLAUDE.md
git commit -m "docs: add server/client module docs and correct root CLAUDE.md"
```

---

## What this plan does NOT cover (by design — see Plans 2–4)

- OpenAI-powered search, results table with description/viewed/status columns, and viewed/status transitions (Epic 2, Stories 3.1–3.2) → **Plan 2**.
- Resume template configuration and AI-adapted resume generation/retrieval (Epic 4) → **Plan 3**.
- Applied-CV upload modal and download link (Stories 3.3–3.4) → **Plan 4**, which also finalizes packaging.
