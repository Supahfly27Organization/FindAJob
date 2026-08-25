# Job Search Assistant — Search & Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver OpenAI-powered job search (Epic 2: Stories 2.1, 2.2, 2.3) and initial posting status tracking (Story 3.1 "open → viewed", and the non-Applied part of Story 3.2) end-to-end, in the browser, on top of the Plan 1 foundation.

**Architecture:** New backend services (`openaiClient.js`, `postingService.js`, `searchService.js`) and one new router (`routes/postings.js`) follow the exact layering already established in Plan 1 (`server/CLAUDE.md`'s "adding an endpoint" playbook): thin routes → services (business logic + DB access) → shared `ValidationError`/`NotFoundError`/`UpstreamError` → `errorHandler`. The `postings` table already exists in `schema.sql` from Plan 1 (created ahead of need), so **no schema changes are required**. On the client, a new `PostingsPage` (route `/titles/:id/postings`) shows one title's results table, and `PositionTitlesPage` gains "Search now" (per row) and "Search all" actions. "Search all" (Story 2.2) is implemented as **sequential client-side calls** to the same single-title search endpoint used by "Search now" — this gives per-title progress, isolated failures, and per-title retry (all required by Story 2.2's acceptance criteria) without a second backend endpoint or any new state-management library.

**Tech Stack:** Adds the `openai` npm package (OpenAI Node SDK, Responses API with the `web_search` tool) to `server/`. Everything else reuses Plan 1's stack: Express 4 + better-sqlite3 (backend), React 19 + TypeScript + Vite + react-router-dom (frontend), Vitest + Supertest + React Testing Library + user-event (tests).

**Spec:**
- `docs/product-superpowers/prds/2026-08-25-job-search-assistant.md`
- `docs/product-superpowers/stories/2026-08-25-job-search-assistant-stories.md`

**Plan sequence:** This is **Plan 2 of 4**. It builds on Plan 1's DB schema, service/route/error patterns, and `settingsService.getOpenAiKey`. Plan 3 (Resume Adaptation — Epic 4) and Plan 4 (Applied CV Tracking & Packaging — Stories 3.3/3.4, plus deferred Plan 1 cleanup) follow. Plan 4 will add the "Applied" status transition (via its CV-upload modal) to the status control this plan intentionally leaves out — see Global Constraints.

## Global Constraints

- Search is capped at 20 results per title per run, and only postings published within the last 45 days are kept (PRD "Search for postings"; Stories 2.1/2.2).
- Results are deduplicated against existing postings **by URL**: if a URL was already found, the existing row (and its status) is left unchanged and no duplicate is created (Story 2.1).
- A new posting is saved with `viewed = false` and `status = 'New'` (PRD data model; already the DB defaults from Plan 1's schema).
- Opening a posting (Story 3.1) sets `viewed = true` and must **never** change `status`.
- `posting.status` is exactly `New | Applied | In Progress | Rejected` (DB `CHECK` constraint, Plan 1); this plan's status-update endpoint and UI **only** allow `New | In Progress | Rejected`. Transitioning to `Applied` requires the CV-upload modal from Story 3.3, which is out of scope until Plan 4 — attempting `Applied` through this plan's endpoint is rejected with a `ValidationError` (Story 3.2's own AC requires the modal to gate this transition, so it cannot be done correctly before Plan 4).
- No scheduled/automatic search — every search is a manual, on-demand trigger (PRD Scope / Key Risk 4, cost control).
- A search cannot be run without a configured OpenAI API key; the user is blocked with a message pointing to Settings, not a generic error (Story 2.1/5.1).
- Search runs must never save partial/malformed postings — a candidate missing `postingTitle` or `url` is silently discarded, not saved with blank data (Story 2.1 edge case).
- Local-only app, no authentication (carried over from Plan 1).

---

## File Structure

```
FindAJob/
  server/
    src/
      config.js                       # MODIFY: add OPENAI_SEARCH_MODEL
      errors.js                       # MODIFY: add UpstreamError
      services/
        openaiClient.js                # NEW: buildSearchPrompt, parseSearchResponse, searchJobPostings
        postingService.js              # NEW: saveSearchResults, listPostingsForTitle, getPostingById, markPostingViewed, updatePostingStatus
        searchService.js               # NEW: searchPostingsForTitle (orchestrates the above)
      routes/
        postings.js                    # NEW: registerPostingRoutes(app, db)
      server.js                        # MODIFY: register the new router
    package.json                       # MODIFY: adds `openai` dependency
    test/
      openaiClient.test.js             # NEW
      postingService.test.js           # NEW
      searchService.test.js            # NEW
      postings.routes.test.js          # NEW
    CLAUDE.md                          # MODIFY: document the new services/routes
  client/
    src/
      types.ts                        # MODIFY: add PostingStatus, Posting
      api/
        postings.ts                    # NEW: searchPostingsForTitle, fetchPostingsForTitle, markPostingViewed, updatePostingStatus
      pages/
        PostingsPage.tsx               # NEW
        PostingsPage.test.tsx          # NEW
        PositionTitlesPage.tsx         # MODIFY: add Search now / Search all / View postings
        PositionTitlesPage.test.tsx    # MODIFY: wrap in MemoryRouter, add search tests
      App.tsx                          # MODIFY: add /titles/:id/postings route
    CLAUDE.md                          # MODIFY: note the new page/route
  docs/claude/DOMAIN_MODEL.md          # MODIFY: document PositionTitle + Posting entities
```

---

### Task 1: OpenAI search client (prompt, response parsing, live call) + `UpstreamError`

**Files:**
- Modify: `server/package.json` (new dependency)
- Modify: `server/src/config.js`
- Modify: `server/src/errors.js`
- Create: `server/src/services/openaiClient.js`
- Test: `server/test/openaiClient.test.js`

**Interfaces:**
- Consumes: `OPENAI_SEARCH_MODEL` (this task, from `config.js`).
- Produces: `buildSearchPrompt(title) => string`, `parseSearchResponse(rawText) => unknown[]`, `searchJobPostings(apiKey, title) => Promise<unknown[]>`, `UpstreamError` (from `errors.js`) — all relied on by Task 3's `searchService.js`.

Note: `searchJobPostings` itself is a thin network adapter (real OpenAI Responses API call with the `web_search` tool) — it is not unit tested here (that would require live network access); it's exercised via Task 3's dependency-injected tests and via manual verification once a real API key is available (PRD Key Risk 2). Only the pure helper functions are unit tested in this task.

- [ ] **Step 1: Add the OpenAI SDK dependency**

Run (from `server/`):
```bash
npm install openai
```

Expected: `server/package.json`'s `dependencies` gains an `"openai"` entry.

- [ ] **Step 2: Add `OPENAI_SEARCH_MODEL` to config**

Modify `server/src/config.js`, adding this line after the existing exports:

```js
export const OPENAI_SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || 'gpt-4.1';
```

- [ ] **Step 3: Add `UpstreamError` to `server/src/errors.js`**

Add to the end of the file:

```js
export class UpstreamError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UpstreamError';
    this.status = 502;
  }
}
```

- [ ] **Step 4: Write the failing tests for the pure helpers**

`server/test/openaiClient.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildSearchPrompt, parseSearchResponse } from '../src/services/openaiClient.js';

describe('buildSearchPrompt', () => {
  it('includes the title, Israel, the result cap, and the freshness window', () => {
    const prompt = buildSearchPrompt('Product Manager');
    expect(prompt).toContain('Product Manager');
    expect(prompt).toContain('Israel');
    expect(prompt).toContain('20');
    expect(prompt).toContain('45');
  });
});

describe('parseSearchResponse', () => {
  it('parses a plain JSON array', () => {
    const result = parseSearchResponse('[{"postingTitle":"PM","url":"https://example.com/1"}]');
    expect(result).toEqual([{ postingTitle: 'PM', url: 'https://example.com/1' }]);
  });

  it('parses a JSON array wrapped in a markdown code fence', () => {
    const result = parseSearchResponse('```json\n[{"postingTitle":"PM","url":"https://example.com/1"}]\n```');
    expect(result).toEqual([{ postingTitle: 'PM', url: 'https://example.com/1' }]);
  });

  it('parses an explicit empty array', () => {
    expect(parseSearchResponse('[]')).toEqual([]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSearchResponse('not json')).toThrow('not valid JSON');
  });

  it('throws when the JSON is valid but not an array', () => {
    expect(() => parseSearchResponse('{"postingTitle":"PM"}')).toThrow('not a JSON array');
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/openaiClient.test.js`
Expected: FAIL — `Cannot find module '../src/services/openaiClient.js'`

- [ ] **Step 6: Implement `server/src/services/openaiClient.js`**

```js
import OpenAI from 'openai';
import { OPENAI_SEARCH_MODEL } from '../config.js';

export const MAX_RESULTS = 20;
export const MAX_AGE_DAYS = 45;

export function buildSearchPrompt(title) {
  return `You are searching for current, real job postings in Israel for the title "${title}" (including reasonably equivalent/synonymous titles).

Use web search to find real, currently open job postings. Return at most ${MAX_RESULTS} postings, each published within the last ${MAX_AGE_DAYS} days.

Respond with ONLY a JSON array (no markdown, no commentary, no code fences) where each element has exactly these fields:
{
  "postingTitle": string,
  "description": string,
  "company": string,
  "url": string,
  "location": string,
  "publishedDate": string (ISO 8601 date, e.g. "2026-08-01")
}

If you find no matching postings, respond with exactly: []`;
}

export function parseSearchResponse(rawText) {
  const cleaned = String(rawText ?? '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('OpenAI returned a response that was not valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('OpenAI response was not a JSON array');
  }
  return parsed;
}

export async function searchJobPostings(apiKey, title) {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: OPENAI_SEARCH_MODEL,
    tools: [{ type: 'web_search' }],
    input: buildSearchPrompt(title)
  });
  return parseSearchResponse(response.output_text);
}
```

**Verify against current docs:** the exact Responses API shape for the `web_search` tool (model name, tool type, and whether `output_text` is the right accessor) is PRD Open Question #2 — confirm it against the OpenAI Node SDK's current docs when a real API key is available, and adjust `OPENAI_SEARCH_MODEL`/the `tools` array here if the API has moved on. `parseSearchResponse` and `buildSearchPrompt` are independent of that detail and don't need to change.

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/openaiClient.test.js`
Expected: PASS (5 tests)

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/package-lock.json server/src/config.js server/src/errors.js server/src/services/openaiClient.js server/test/openaiClient.test.js
git commit -m "feat(server): add OpenAI search client, config, and UpstreamError"
```

---

### Task 2: Posting service (query, dedupe/cap/freshness, viewed/status updates)

**Files:**
- Create: `server/src/services/postingService.js`
- Test: `server/test/postingService.test.js`

**Interfaces:**
- Consumes: `createDb` (Plan 1), `getPositionTitleById` (Plan 1's `positionTitleService.js`), `ValidationError`/`NotFoundError` (Plan 1's `errors.js`).
- Produces: `saveSearchResults(db, positionTitleId, candidates) => { totalFound, savedCount }`, `listPostingsForTitle(db, positionTitleId, { status } = {}) => Posting[]`, `getPostingById(db, id) => Posting`, `markPostingViewed(db, id) => Posting`, `updatePostingStatus(db, id, status) => Posting` — all relied on by Task 3 (`searchService.js`) and Task 4 (`routes/postings.js`). A `Posting` row here is `{ id, positionTitleId, postingTitle, description, company, url, location, publishedDate, foundAt, viewed (boolean), status, adaptedResumePath, appliedCvPath }`.

- [ ] **Step 1: Write the failing tests**

`server/test/postingService.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { createPositionTitle } from '../src/services/positionTitleService.js';
import {
  saveSearchResults,
  listPostingsForTitle,
  getPostingById,
  markPostingViewed,
  updatePostingStatus
} from '../src/services/postingService.js';
import { ValidationError, NotFoundError } from '../src/errors.js';

let db;
let title;

beforeEach(() => {
  db = createDb(':memory:');
  title = createPositionTitle(db, 'Product Manager');
});

describe('saveSearchResults', () => {
  it('saves valid candidates', () => {
    const result = saveSearchResults(db, title.id, [
      {
        postingTitle: 'Senior Product Manager',
        description: 'Great role',
        company: 'Acme',
        url: 'https://example.com/job/1',
        location: 'Tel Aviv',
        publishedDate: '2026-08-01'
      }
    ]);
    expect(result).toEqual({ totalFound: 1, savedCount: 1 });
    expect(listPostingsForTitle(db, title.id)).toHaveLength(1);
  });

  it('discards candidates missing a url', () => {
    const result = saveSearchResults(db, title.id, [
      { postingTitle: 'No URL Role', publishedDate: '2026-08-01' }
    ]);
    expect(result.savedCount).toBe(0);
    expect(listPostingsForTitle(db, title.id)).toHaveLength(0);
  });

  it('discards candidates missing a posting title', () => {
    const result = saveSearchResults(db, title.id, [
      { url: 'https://example.com/job/no-title', publishedDate: '2026-08-01' }
    ]);
    expect(result.savedCount).toBe(0);
  });

  it('discards candidates published more than 45 days ago', () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = saveSearchResults(db, title.id, [
      { postingTitle: 'Old Role', url: 'https://example.com/job/old', publishedDate: oldDate }
    ]);
    expect(result.savedCount).toBe(0);
  });

  it('keeps candidates with an unparseable published date', () => {
    const result = saveSearchResults(db, title.id, [
      { postingTitle: 'Undated Role', url: 'https://example.com/job/undated', publishedDate: 'unknown' }
    ]);
    expect(result.savedCount).toBe(1);
  });

  it('caps saved candidates at 20 per run', () => {
    const candidates = Array.from({ length: 25 }, (_, i) => ({
      postingTitle: `Role ${i}`,
      url: `https://example.com/job/${i}`,
      publishedDate: '2026-08-01'
    }));
    const result = saveSearchResults(db, title.id, candidates);
    expect(result.savedCount).toBe(20);
    expect(result.totalFound).toBe(25);
  });

  it('dedupes against an existing posting by url without resetting its status', () => {
    saveSearchResults(db, title.id, [
      { postingTitle: 'Role', url: 'https://example.com/job/dup', publishedDate: '2026-08-01' }
    ]);
    const [existing] = listPostingsForTitle(db, title.id);
    updatePostingStatus(db, existing.id, 'In Progress');

    const result = saveSearchResults(db, title.id, [
      { postingTitle: 'Role (again)', url: 'https://example.com/job/dup', publishedDate: '2026-08-02' }
    ]);
    expect(result.savedCount).toBe(0);
    const [unchanged] = listPostingsForTitle(db, title.id);
    expect(unchanged.status).toBe('In Progress');
  });

  it('throws NotFoundError for a missing position title', () => {
    expect(() => saveSearchResults(db, 999, [])).toThrow(NotFoundError);
  });
});

describe('listPostingsForTitle', () => {
  it('filters by status', () => {
    saveSearchResults(db, title.id, [
      { postingTitle: 'A', url: 'https://example.com/a' },
      { postingTitle: 'B', url: 'https://example.com/b' }
    ]);
    const [a] = listPostingsForTitle(db, title.id);
    updatePostingStatus(db, a.id, 'Rejected');

    expect(listPostingsForTitle(db, title.id, { status: 'Rejected' })).toHaveLength(1);
    expect(listPostingsForTitle(db, title.id, { status: 'New' })).toHaveLength(1);
  });

  it('throws NotFoundError for a missing position title', () => {
    expect(() => listPostingsForTitle(db, 999)).toThrow(NotFoundError);
  });
});

describe('markPostingViewed', () => {
  it('sets viewed to true without changing status', () => {
    saveSearchResults(db, title.id, [{ postingTitle: 'A', url: 'https://example.com/a' }]);
    const [posting] = listPostingsForTitle(db, title.id);
    expect(posting.viewed).toBe(false);

    const updated = markPostingViewed(db, posting.id);
    expect(updated.viewed).toBe(true);
    expect(updated.status).toBe('New');
  });

  it('throws NotFoundError for a missing posting', () => {
    expect(() => markPostingViewed(db, 999)).toThrow(NotFoundError);
  });
});

describe('updatePostingStatus', () => {
  it('updates to a valid status', () => {
    saveSearchResults(db, title.id, [{ postingTitle: 'A', url: 'https://example.com/a' }]);
    const [posting] = listPostingsForTitle(db, title.id);
    const updated = updatePostingStatus(db, posting.id, 'In Progress');
    expect(updated.status).toBe('In Progress');
  });

  it('rejects "Applied" (requires the Plan 4 CV-upload flow)', () => {
    saveSearchResults(db, title.id, [{ postingTitle: 'A', url: 'https://example.com/a' }]);
    const [posting] = listPostingsForTitle(db, title.id);
    expect(() => updatePostingStatus(db, posting.id, 'Applied')).toThrow(ValidationError);
  });

  it('rejects an unrecognized status', () => {
    saveSearchResults(db, title.id, [{ postingTitle: 'A', url: 'https://example.com/a' }]);
    const [posting] = listPostingsForTitle(db, title.id);
    expect(() => updatePostingStatus(db, posting.id, 'Bogus')).toThrow(ValidationError);
  });

  it('throws NotFoundError for a missing posting', () => {
    expect(() => updatePostingStatus(db, 999, 'Rejected')).toThrow(NotFoundError);
  });
});

describe('getPostingById', () => {
  it('throws NotFoundError for a missing posting', () => {
    expect(() => getPostingById(db, 999)).toThrow(NotFoundError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/postingService.test.js`
Expected: FAIL — `Cannot find module '../src/services/postingService.js'`

- [ ] **Step 3: Implement `server/src/services/postingService.js`**

```js
import { NotFoundError, ValidationError } from '../errors.js';
import { getPositionTitleById } from './positionTitleService.js';
import { MAX_RESULTS, MAX_AGE_DAYS } from './openaiClient.js';

const EDITABLE_STATUSES = ['New', 'In Progress', 'Rejected'];

const SELECT_COLUMNS = `id, position_title_id AS positionTitleId, posting_title AS postingTitle,
  description, company, url, location, published_date AS publishedDate, found_at AS foundAt,
  viewed, status, adapted_resume_path AS adaptedResumePath, applied_cv_path AS appliedCvPath`;

function toPosting(row) {
  return { ...row, viewed: Boolean(row.viewed) };
}

function isRecentEnough(publishedDate) {
  if (!publishedDate) {
    return true;
  }
  const parsed = new Date(publishedDate);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }
  const ageMs = Date.now() - parsed.getTime();
  return ageMs <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function isValidCandidate(candidate) {
  return (
    candidate &&
    typeof candidate.url === 'string' &&
    candidate.url.trim() &&
    typeof candidate.postingTitle === 'string' &&
    candidate.postingTitle.trim()
  );
}

export function saveSearchResults(db, positionTitleId, candidates) {
  getPositionTitleById(db, positionTitleId);

  const toSave = candidates
    .filter(isValidCandidate)
    .filter((candidate) => isRecentEnough(candidate.publishedDate))
    .slice(0, MAX_RESULTS);

  const insert = db.prepare(
    `INSERT INTO postings (position_title_id, posting_title, description, company, url, location, published_date)
     VALUES (@positionTitleId, @postingTitle, @description, @company, @url, @location, @publishedDate)
     ON CONFLICT(url) DO NOTHING`
  );

  const runAll = db.transaction((rows) => {
    let savedCount = 0;
    for (const row of rows) {
      const result = insert.run({
        positionTitleId,
        postingTitle: row.postingTitle.trim(),
        description: row.description ?? null,
        company: row.company ?? null,
        url: row.url.trim(),
        location: row.location ?? null,
        publishedDate: row.publishedDate ?? null
      });
      if (result.changes > 0) {
        savedCount += 1;
      }
    }
    return savedCount;
  });

  return { totalFound: candidates.length, savedCount: runAll(toSave) };
}

export function listPostingsForTitle(db, positionTitleId, { status } = {}) {
  getPositionTitleById(db, positionTitleId);
  const rows = status
    ? db
        .prepare(
          `SELECT ${SELECT_COLUMNS} FROM postings WHERE position_title_id = ? AND status = ? ORDER BY found_at DESC`
        )
        .all(positionTitleId, status)
    : db
        .prepare(`SELECT ${SELECT_COLUMNS} FROM postings WHERE position_title_id = ? ORDER BY found_at DESC`)
        .all(positionTitleId);
  return rows.map(toPosting);
}

export function getPostingById(db, id) {
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM postings WHERE id = ?`).get(id);
  if (!row) {
    throw new NotFoundError(`Posting ${id} not found`);
  }
  return toPosting(row);
}

export function markPostingViewed(db, id) {
  getPostingById(db, id);
  db.prepare('UPDATE postings SET viewed = 1 WHERE id = ?').run(id);
  return getPostingById(db, id);
}

export function updatePostingStatus(db, id, status) {
  getPostingById(db, id);
  if (!EDITABLE_STATUSES.includes(status)) {
    throw new ValidationError(
      `Status must be one of: ${EDITABLE_STATUSES.join(', ')}. Marking a posting Applied requires uploading the CV you used (coming soon).`
    );
  }
  db.prepare('UPDATE postings SET status = ? WHERE id = ?').run(status, id);
  return getPostingById(db, id);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/postingService.test.js`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/postingService.js server/test/postingService.test.js
git commit -m "feat(server): add posting service with search-result cap/freshness/dedupe and status rules"
```

---

### Task 3: Search service (orchestration)

**Files:**
- Create: `server/src/services/searchService.js`
- Test: `server/test/searchService.test.js`

**Interfaces:**
- Consumes: `getOpenAiKey` (Plan 1's `settingsService.js`), `getPositionTitleById` (Plan 1's `positionTitleService.js`), `saveSearchResults` (Task 2), `searchJobPostings` (Task 1), `ValidationError`/`UpstreamError` (`errors.js`).
- Produces: `searchPostingsForTitle(db, positionTitleId, { fetchPostings = searchJobPostings } = {}) => Promise<{ totalFound, savedCount }>` — relied on by Task 4's route. The `fetchPostings` override exists purely so tests (and the route's own tests) never make a real network call.

- [ ] **Step 1: Write the failing tests**

`server/test/searchService.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDb } from '../src/db/index.js';
import { createPositionTitle } from '../src/services/positionTitleService.js';
import { saveOpenAiKey } from '../src/services/settingsService.js';
import { searchPostingsForTitle } from '../src/services/searchService.js';
import { listPostingsForTitle } from '../src/services/postingService.js';
import { ValidationError, UpstreamError, NotFoundError } from '../src/errors.js';

let db;
let title;

beforeEach(() => {
  db = createDb(':memory:');
  title = createPositionTitle(db, 'Product Manager');
});

describe('searchPostingsForTitle', () => {
  it('throws ValidationError when no API key is configured', async () => {
    await expect(searchPostingsForTitle(db, title.id)).rejects.toThrow(ValidationError);
  });

  it('saves postings returned by the injected search function', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    const fetchPostings = vi.fn().mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1', publishedDate: '2026-08-01' }
    ]);

    const result = await searchPostingsForTitle(db, title.id, { fetchPostings });

    expect(fetchPostings).toHaveBeenCalledWith('sk-test1234567890', 'Product Manager');
    expect(result).toEqual({ totalFound: 1, savedCount: 1 });
    expect(listPostingsForTitle(db, title.id)).toHaveLength(1);
  });

  it('wraps a failed search call in an UpstreamError', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    const fetchPostings = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(searchPostingsForTitle(db, title.id, { fetchPostings })).rejects.toThrow(UpstreamError);
  });

  it('throws NotFoundError for a missing position title', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    await expect(searchPostingsForTitle(db, 999, { fetchPostings: vi.fn() })).rejects.toThrow(
      NotFoundError
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/searchService.test.js`
Expected: FAIL — `Cannot find module '../src/services/searchService.js'`

- [ ] **Step 3: Implement `server/src/services/searchService.js`**

```js
import { ValidationError, UpstreamError } from '../errors.js';
import { getOpenAiKey } from './settingsService.js';
import { getPositionTitleById } from './positionTitleService.js';
import { saveSearchResults } from './postingService.js';
import { searchJobPostings } from './openaiClient.js';

export async function searchPostingsForTitle(db, positionTitleId, { fetchPostings = searchJobPostings } = {}) {
  const title = getPositionTitleById(db, positionTitleId);

  const apiKey = getOpenAiKey(db);
  if (!apiKey) {
    throw new ValidationError('Configure your OpenAI API key in Settings before searching.');
  }

  let candidates;
  try {
    candidates = await fetchPostings(apiKey, title.title);
  } catch {
    throw new UpstreamError('Search failed. Please try again.');
  }

  return saveSearchResults(db, positionTitleId, candidates);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/searchService.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/searchService.js server/test/searchService.test.js
git commit -m "feat(server): add search service orchestrating OpenAI search and posting persistence"
```

---

### Task 4: Postings REST routes

**Files:**
- Create: `server/src/routes/postings.js`
- Modify: `server/src/server.js`
- Modify: `server/CLAUDE.md`
- Modify: `docs/claude/DOMAIN_MODEL.md`
- Test: `server/test/postings.routes.test.js`

**Interfaces:**
- Consumes: `searchPostingsForTitle` (Task 3), `listPostingsForTitle`/`markPostingViewed`/`updatePostingStatus` (Task 2).
- Produces: `registerPostingRoutes(app, db)` mounting:
  - `POST /api/position-titles/:id/search`
  - `GET /api/position-titles/:id/postings` (optional `?status=`)
  - `PUT /api/postings/:id/viewed`
  - `PUT /api/postings/:id/status`

  — all relied on by Task 5's client API module.

- [ ] **Step 1: Write the failing route tests**

`server/test/postings.routes.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import { registerPositionTitleRoutes } from '../src/routes/positionTitles.js';
import { registerSettingsRoutes } from '../src/routes/settings.js';
import { registerPostingRoutes } from '../src/routes/postings.js';

vi.mock('../src/services/openaiClient.js', () => ({
  searchJobPostings: vi.fn()
}));

import { searchJobPostings } from '../src/services/openaiClient.js';

let app;

beforeEach(() => {
  const db = createDb(':memory:');
  app = createApp(db);
  registerPositionTitleRoutes(app, db);
  registerSettingsRoutes(app, db);
  registerPostingRoutes(app, db);
  app.use(errorHandler);
  vi.mocked(searchJobPostings).mockReset();
});

async function createTitle(title) {
  const response = await request(app).post('/api/position-titles').send({ title });
  return response.body;
}

async function configureApiKey() {
  await request(app).put('/api/settings/openai-key').send({ apiKey: 'sk-test1234567890' });
}

describe('POST /api/position-titles/:id/search', () => {
  it('rejects when no API key is configured', async () => {
    const title = await createTitle('Product Manager');
    const response = await request(app).post(`/api/position-titles/${title.id}/search`);
    expect(response.status).toBe(400);
  });

  it('saves postings returned by the search', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1', publishedDate: '2026-08-01' }
    ]);

    const response = await request(app).post(`/api/position-titles/${title.id}/search`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalFound: 1, savedCount: 1 });
  });

  it('returns 502 when the search call fails', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockRejectedValue(new Error('boom'));

    const response = await request(app).post(`/api/position-titles/${title.id}/search`);
    expect(response.status).toBe(502);
  });
});

describe('GET /api/position-titles/:id/postings', () => {
  it('lists postings found for a title', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1', publishedDate: '2026-08-01' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);

    const response = await request(app).get(`/api/position-titles/${title.id}/postings`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ postingTitle: 'Senior PM', viewed: false, status: 'New' });
  });

  it('returns 404 for a missing title', async () => {
    const response = await request(app).get('/api/position-titles/999/postings');
    expect(response.status).toBe(404);
  });
});

describe('PUT /api/postings/:id/viewed', () => {
  it('marks a posting viewed', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);
    const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;

    const response = await request(app).put(`/api/postings/${posting.id}/viewed`);
    expect(response.status).toBe(200);
    expect(response.body.viewed).toBe(true);
  });

  it('returns 404 for a missing posting', async () => {
    const response = await request(app).put('/api/postings/999/viewed');
    expect(response.status).toBe(404);
  });
});

describe('PUT /api/postings/:id/status', () => {
  it('updates to a valid status', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);
    const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;

    const response = await request(app)
      .put(`/api/postings/${posting.id}/status`)
      .send({ status: 'In Progress' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('In Progress');
  });

  it('rejects "Applied" via this endpoint', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);
    const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;

    const response = await request(app)
      .put(`/api/postings/${posting.id}/status`)
      .send({ status: 'Applied' });
    expect(response.status).toBe(400);
  });

  it('returns 404 for a missing posting', async () => {
    const response = await request(app).put('/api/postings/999/status').send({ status: 'Rejected' });
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/postings.routes.test.js`
Expected: FAIL — `Cannot find module '../src/routes/postings.js'`

- [ ] **Step 3: Implement `server/src/routes/postings.js`**

```js
import { Router } from 'express';
import { searchPostingsForTitle } from '../services/searchService.js';
import {
  listPostingsForTitle,
  markPostingViewed,
  updatePostingStatus
} from '../services/postingService.js';

export function registerPostingRoutes(app, db) {
  const router = Router();

  router.post('/position-titles/:id/search', async (req, res, next) => {
    try {
      res.json(await searchPostingsForTitle(db, Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  });

  router.get('/position-titles/:id/postings', (req, res, next) => {
    try {
      res.json(listPostingsForTitle(db, Number(req.params.id), { status: req.query.status }));
    } catch (error) {
      next(error);
    }
  });

  router.put('/postings/:id/viewed', (req, res, next) => {
    try {
      res.json(markPostingViewed(db, Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  });

  router.put('/postings/:id/status', (req, res, next) => {
    try {
      res.json(updatePostingStatus(db, Number(req.params.id), req.body.status));
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', router);
}
```

- [ ] **Step 4: Wire the router into `server/src/server.js`**

Modify `server/src/server.js`: add the import and registration call (final file):

```js
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import open from 'open';
import { createApp, errorHandler } from './app.js';
import { createDb } from './db/index.js';
import { PORT, DB_PATH, CLIENT_DIST_PATH } from './config.js';
import { registerPositionTitleRoutes } from './routes/positionTitles.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerPostingRoutes } from './routes/postings.js';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = createDb(DB_PATH);
const app = createApp(db);
registerPositionTitleRoutes(app, db);
registerSettingsRoutes(app, db);
registerPostingRoutes(app, db);

if (fs.existsSync(CLIENT_DIST_PATH)) {
  app.use(express.static(CLIENT_DIST_PATH));
  app.get(/^\/(?!api\/)/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST_PATH, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`FindAJob running at ${url}`);
  if (!process.argv.includes('--no-open')) {
    open(url).catch(() => {});
  }
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/postings.routes.test.js`
Expected: PASS (9 tests)

- [ ] **Step 6: Update `server/CLAUDE.md`**

Add to the end of the `## Key decisions` list:

```markdown
- Search (`searchService.js`) is a pure orchestrator: it validates the OpenAI key is configured, delegates the actual call to `openaiClient.js` (swappable via a `fetchPostings` param so tests never hit the network), then hands raw candidates to `postingService.saveSearchResults`, which enforces the 20-result cap, the 45-day freshness window, and URL-based dedup (existing rows/status are never touched on a re-find).
- `updatePostingStatus` only accepts `New | In Progress | Rejected` — moving a posting to `Applied` requires the CV-upload flow (Story 3.3, Plan 4) and is rejected with a `ValidationError` until that flow exists.
```

Add a new line to the `## Playbook: adding an endpoint` section is not needed (the existing playbook already covers this pattern exactly as used here).

- [ ] **Step 7: Fill in `docs/claude/DOMAIN_MODEL.md`**

Replace the placeholder template content with:

```markdown
# Domain Model

## PositionTitle

PK: `id` (`INTEGER`). A job title the user wants postings searched for.

| Property | Type | DB | Notes |
|---|---|---|---|
| id | number | `position_titles.id` | |
| title | string | `position_titles.title` | Unique, case-insensitive (`COLLATE NOCASE`) |
| createdAt | string (ISO datetime) | `position_titles.created_at` | |
| postingCount | number | derived (`COUNT` join) | Only present on `listPositionTitles` results |

## Posting

PK: `id` (`INTEGER`). A single job posting found by a search, linked to the title that found it.

| Property | Type | DB | Notes |
|---|---|---|---|
| id | number | `postings.id` | |
| positionTitleId | number \| null | `postings.position_title_id` | `ON DELETE SET NULL` — deleting a title unlinks, never deletes, its postings |
| postingTitle | string | `postings.posting_title` | The posting's own title (may differ from the searched `PositionTitle.title`) |
| description | string \| null | `postings.description` | |
| company | string \| null | `postings.company` | |
| url | string | `postings.url` | Unique — the dedup key across repeated searches |
| location | string \| null | `postings.location` | |
| publishedDate | string \| null | `postings.published_date` | As reported by the search; unparseable/missing values are not treated as stale |
| foundAt | string (ISO datetime) | `postings.found_at` | Set once, at insert time |
| viewed | boolean | `postings.viewed` (`INTEGER` 0/1) | Set `true` only via "Open"; never implies a status change |
| status | `'New' \| 'Applied' \| 'In Progress' \| 'Rejected'` | `postings.status` | DB `CHECK` constraint; app-level writes via this plan's endpoint reject `'Applied'` (see Key decisions) |
| adaptedResumePath | string \| null | `postings.adapted_resume_path` | Set by Plan 3 (resume adaptation) |
| appliedCvPath | string \| null | `postings.applied_cv_path` | Set by Plan 4 (Applied CV upload) |
```

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/postings.js server/src/server.js server/test/postings.routes.test.js server/CLAUDE.md docs/claude/DOMAIN_MODEL.md
git commit -m "feat(server): add postings REST routes for search, listing, viewed, and status"
```

---

### Task 5: Client — Posting type, API client, and the Postings results page

**Files:**
- Modify: `client/src/types.ts`
- Create: `client/src/api/postings.ts`
- Create: `client/src/pages/PostingsPage.tsx`
- Test: `client/src/pages/PostingsPage.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `apiFetch`/`ApiError` (Plan 1's `api/http.ts`), `fetchPositionTitles` (Plan 1's `api/positionTitles.ts`), `PositionTitle` (`types.ts`).
- Produces: `Posting`, `PostingStatus` types; `searchPostingsForTitle(positionTitleId)`, `fetchPostingsForTitle(positionTitleId, status?)`, `markPostingViewed(id)`, `updatePostingStatus(id, status)`; the `PostingsPage` component mounted at `/titles/:id/postings` — the link target Task 6 adds to `PositionTitlesPage`.

- [ ] **Step 1: Add `Posting`/`PostingStatus` to `client/src/types.ts`**

Full file:

```ts
export interface PositionTitle {
  id: number;
  title: string;
  createdAt: string;
  postingCount: number;
}

export type PostingStatus = 'New' | 'Applied' | 'In Progress' | 'Rejected';

export interface Posting {
  id: number;
  positionTitleId: number | null;
  postingTitle: string;
  description: string | null;
  company: string | null;
  url: string;
  location: string | null;
  publishedDate: string | null;
  foundAt: string;
  viewed: boolean;
  status: PostingStatus;
  adaptedResumePath: string | null;
  appliedCvPath: string | null;
}
```

- [ ] **Step 2: Create `client/src/api/postings.ts`**

```ts
import { apiFetch } from './http';
import type { Posting } from '../types';

export interface SearchResult {
  totalFound: number;
  savedCount: number;
}

export function searchPostingsForTitle(positionTitleId: number): Promise<SearchResult> {
  return apiFetch<SearchResult>(`/api/position-titles/${positionTitleId}/search`, {
    method: 'POST'
  });
}

export function fetchPostingsForTitle(positionTitleId: number, status?: string): Promise<Posting[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<Posting[]>(`/api/position-titles/${positionTitleId}/postings${query}`);
}

export function markPostingViewed(id: number): Promise<Posting> {
  return apiFetch<Posting>(`/api/postings/${id}/viewed`, { method: 'PUT' });
}

export function updatePostingStatus(id: number, status: string): Promise<Posting> {
  return apiFetch<Posting>(`/api/postings/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}
```

- [ ] **Step 3: Write the failing test for `PostingsPage`**

`client/src/pages/PostingsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PostingsPage from './PostingsPage';

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/titles/1/postings']}>
      <Routes>
        <Route path="/titles/:id/postings" element={<PostingsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const TITLES = [{ id: 1, title: 'Product Manager', createdAt: '2026-08-01', postingCount: 1 }];

const POSTING = {
  id: 10,
  positionTitleId: 1,
  postingTitle: 'Senior PM',
  description: 'Great role',
  company: 'Acme',
  url: 'https://example.com/job/1',
  location: 'Tel Aviv',
  publishedDate: '2026-08-01',
  foundAt: '2026-08-01',
  viewed: false,
  status: 'New',
  adaptedResumePath: null,
  appliedCvPath: null
};

describe('PostingsPage', () => {
  it('shows an empty state when there are no postings yet', async () => {
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [] }
    ]);
    renderPage();
    expect(await screen.findByText(/no postings found yet/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /postings for product manager/i })).toBeInTheDocument();
  });

  it('lists postings with their details', async () => {
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] }
    ]);
    renderPage();
    expect(await screen.findByText('Senior PM')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('runs a search and reports zero matches', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [] },
      { status: 200, body: { totalFound: 0, savedCount: 0 } },
      { status: 200, body: TITLES },
      { status: 200, body: [] }
    ]);
    renderPage();
    await screen.findByText(/no postings found yet/i);

    await user.click(screen.getByRole('button', { name: /search now/i }));

    expect(await screen.findByText(/no matching postings found in the last 45 days/i)).toBeInTheDocument();
  });

  it('shows a search error', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [] },
      { status: 400, body: { message: 'Configure your OpenAI API key in Settings before searching.' } }
    ]);
    renderPage();
    await screen.findByText(/no postings found yet/i);

    await user.click(screen.getByRole('button', { name: /search now/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Configure your OpenAI API key in Settings before searching.'
    );
  });

  it('marks a posting viewed when opened', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] },
      { status: 200, body: { ...POSTING, viewed: true } }
    ]);
    vi.stubGlobal('open', vi.fn());
    renderPage();
    await screen.findByText('Senior PM');

    await user.click(screen.getByRole('button', { name: /open/i }));

    expect(window.open).toHaveBeenCalledWith('https://example.com/job/1', '_blank', 'noopener,noreferrer');
    expect(await screen.findByText('Yes')).toBeInTheDocument();
  });

  it('updates status via the select control', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] },
      { status: 200, body: { ...POSTING, status: 'In Progress' } }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    await user.selectOptions(screen.getByLabelText(/status for senior pm/i), 'In Progress');

    expect(await screen.findByDisplayValue('In Progress')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run (from `client/`): `npx vitest run src/pages/PostingsPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./PostingsPage"`

- [ ] **Step 5: Implement `client/src/pages/PostingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Posting, PositionTitle } from '../types';
import { fetchPositionTitles } from '../api/positionTitles';
import {
  fetchPostingsForTitle,
  markPostingViewed,
  searchPostingsForTitle,
  updatePostingStatus
} from '../api/postings';
import { ApiError } from '../api/http';

const EDITABLE_STATUSES = ['New', 'In Progress', 'Rejected'] as const;
const DESCRIPTION_PREVIEW_LENGTH = 120;

export default function PostingsPage() {
  const { id } = useParams<{ id: string }>();
  const positionTitleId = Number(id);

  const [title, setTitle] = useState<PositionTitle | null>(null);
  const [postings, setPostings] = useState<Posting[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setListError(null);
    try {
      const [titles, foundPostings] = await Promise.all([
        fetchPositionTitles(),
        fetchPostingsForTitle(positionTitleId, statusFilter || undefined)
      ]);
      setTitle(titles.find((t) => t.id === positionTitleId) ?? null);
      setPostings(foundPostings);
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : 'Failed to load postings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [positionTitleId, statusFilter]);

  async function handleSearch() {
    setSearching(true);
    setSearchError(null);
    setSearchInfo(null);
    try {
      const result = await searchPostingsForTitle(positionTitleId);
      if (result.savedCount === 0) {
        setSearchInfo('No matching postings found in the last 45 days.');
      }
      await load();
    } catch (error) {
      setSearchError(error instanceof ApiError ? error.message : 'Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleOpen(posting: Posting) {
    window.open(posting.url, '_blank', 'noopener,noreferrer');
    if (!posting.viewed) {
      try {
        const updated = await markPostingViewed(posting.id);
        setPostings((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } catch {
        // The tab already opened; the viewed flag will pick up on next load.
      }
    }
  }

  async function handleStatusChange(posting: Posting, status: string) {
    setStatusError(null);
    try {
      const updated = await updatePostingStatus(posting.id, status);
      setPostings((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      setStatusError(error instanceof ApiError ? error.message : 'Failed to update status');
    }
  }

  if (loading) {
    return <p>Loading postings…</p>;
  }

  return (
    <section>
      <p>
        <Link to="/titles">&larr; Back to Position Titles</Link>
      </p>
      <h1>Postings for {title?.title ?? `Position Title ${positionTitleId}`}</h1>

      <button onClick={handleSearch} disabled={searching}>
        {searching ? 'Searching…' : 'Search now'}
      </button>
      {searchError && <p role="alert">{searchError}</p>}
      {searchInfo && <p>{searchInfo}</p>}

      <label>
        Filter by status:{' '}
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All</option>
          <option value="New">New</option>
          <option value="Applied">Applied</option>
          <option value="In Progress">In Progress</option>
          <option value="Rejected">Rejected</option>
        </select>
      </label>

      {listError && <p role="alert">{listError}</p>}
      {statusError && <p role="alert">{statusError}</p>}

      {postings.length === 0 ? (
        <p>No postings found yet. Run a search to get started.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Description</th>
              <th>Published</th>
              <th>Viewed</th>
              <th>Status</th>
              <th>Company</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {postings.map((posting) => {
              const description = posting.description ?? '';
              const isExpanded = expandedId === posting.id;
              const isLong = description.length > DESCRIPTION_PREVIEW_LENGTH;
              return (
                <tr key={posting.id}>
                  <td>{posting.postingTitle}</td>
                  <td>
                    {isLong && !isExpanded ? `${description.slice(0, DESCRIPTION_PREVIEW_LENGTH)}…` : description}
                    {isLong && (
                      <button onClick={() => setExpandedId(isExpanded ? null : posting.id)}>
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </td>
                  <td>{posting.publishedDate ?? '—'}</td>
                  <td>{posting.viewed ? 'Yes' : 'No'}</td>
                  <td>
                    {posting.status === 'Applied' ? (
                      posting.status
                    ) : (
                      <select
                        value={posting.status}
                        onChange={(event) => handleStatusChange(posting, event.target.value)}
                        aria-label={`Status for ${posting.postingTitle}`}
                      >
                        {EDITABLE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>{posting.company ?? '—'}</td>
                  <td>{posting.location ?? '—'}</td>
                  <td>
                    <button onClick={() => handleOpen(posting)}>Open</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Add the route in `client/src/App.tsx`**

Full file:

```tsx
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import PositionTitlesPage from './pages/PositionTitlesPage';
import PostingsPage from './pages/PostingsPage';
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
          <Route path="/titles/:id/postings" element={<PostingsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `client/`): `npx vitest run src/pages/PostingsPage.test.tsx src/App.test.tsx`
Expected: PASS (6 + 2 tests)

- [ ] **Step 8: Commit**

```bash
git add client/src/types.ts client/src/api/postings.ts client/src/pages/PostingsPage.tsx client/src/pages/PostingsPage.test.tsx client/src/App.tsx
git commit -m "feat(client): add Postings results page with search, viewed, and status controls"
```

---

### Task 6: Client — "Search now" / "Search all" / "View postings" on the Position Titles page

**Files:**
- Modify: `client/src/pages/PositionTitlesPage.tsx`
- Modify: `client/src/pages/PositionTitlesPage.test.tsx`

**Interfaces:**
- Consumes: `searchPostingsForTitle` (Task 5's `api/postings.ts`), the `/titles/:id/postings` route (Task 5).
- Produces: no new exports — this is the last piece wiring Story 2.1/2.2 into the UI.

- [ ] **Step 1: Update the failing/passing test file to cover the new UI**

`client/src/pages/PositionTitlesPage.test.tsx` (full file — every render is now wrapped in `MemoryRouter` since the page renders a `<Link>`):

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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

function renderPage() {
  return render(
    <MemoryRouter>
      <PositionTitlesPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PositionTitlesPage', () => {
  it('shows an empty state when there are no titles', async () => {
    mockFetchSequence([{ status: 200, body: [] }]);
    renderPage();
    expect(await screen.findByText(/no position titles yet/i)).toBeInTheDocument();
  });

  it('lists titles with their posting counts', async () => {
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'Product Manager', createdAt: '', postingCount: 4 }] }
    ]);
    renderPage();
    expect(await screen.findByText('Product Manager')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('adds a new title and refreshes the list', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [] },
      { status: 201, body: { id: 1, title: 'QA Engineer', createdAt: '' } },
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] }
    ]);
    renderPage();
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
    renderPage();
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
    renderPage();
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(await screen.findByText(/no position titles yet/i)).toBeInTheDocument();
  });

  it('shows an error when deleting fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] },
      { status: 500, body: { message: 'Failed to delete title' } }
    ]);
    renderPage();
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to delete title');
  });

  it('links to the postings page for a title', async () => {
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] }
    ]);
    renderPage();
    await screen.findByText('QA Engineer');

    expect(screen.getByRole('link', { name: /view postings/i })).toHaveAttribute(
      'href',
      '/titles/1/postings'
    );
  });

  it('runs a search for one title and refreshes its posting count', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] },
      { status: 200, body: { totalFound: 2, savedCount: 2 } },
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 2 }] }
    ]);
    renderPage();
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /search now/i }));

    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('shows a retry option when a search fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] },
      { status: 400, body: { message: 'Configure your OpenAI API key in Settings before searching.' } }
    ]);
    renderPage();
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /search now/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Configure your OpenAI API key in Settings before searching.'
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('disables "Search all" when there are no titles', async () => {
    mockFetchSequence([{ status: 200, body: [] }]);
    renderPage();
    await screen.findByText(/no position titles yet/i);

    expect(screen.getByRole('button', { name: /search all/i })).toBeDisabled();
  });

  it('searches every title in sequence when "Search all" is clicked', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      {
        status: 200,
        body: [
          { id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 },
          { id: 2, title: 'Product Manager', createdAt: '', postingCount: 0 }
        ]
      },
      { status: 200, body: { totalFound: 1, savedCount: 1 } },
      {
        status: 200,
        body: [
          { id: 1, title: 'QA Engineer', createdAt: '', postingCount: 1 },
          { id: 2, title: 'Product Manager', createdAt: '', postingCount: 0 }
        ]
      },
      { status: 200, body: { totalFound: 1, savedCount: 1 } },
      {
        status: 200,
        body: [
          { id: 1, title: 'QA Engineer', createdAt: '', postingCount: 1 },
          { id: 2, title: 'Product Manager', createdAt: '', postingCount: 1 }
        ]
      }
    ]);
    renderPage();
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /search all/i }));

    const counts = await screen.findAllByText('1');
    expect(counts).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run (from `client/`): `npx vitest run src/pages/PositionTitlesPage.test.tsx`
Expected: the pre-existing tests still pass (now wrapped in `MemoryRouter`); the four new tests (`links to the postings page`, `runs a search for one title`, `shows a retry option`, `disables "Search all"`, `searches every title in sequence`) FAIL because the buttons/link don't exist yet.

- [ ] **Step 3: Implement the changes in `client/src/pages/PositionTitlesPage.tsx`**

Full file:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { PositionTitle } from '../types';
import {
  createPositionTitle,
  deletePositionTitle,
  fetchPositionTitles,
  updatePositionTitle
} from '../api/positionTitles';
import { searchPostingsForTitle } from '../api/postings';
import { ApiError } from '../api/http';

type SearchState = 'idle' | 'searching' | 'done' | 'error';

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
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [searchState, setSearchState] = useState<Record<number, SearchState>>({});
  const [searchErrors, setSearchErrors] = useState<Record<number, string>>({});

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
    setDeleteError(null);
    try {
      await deletePositionTitle(id);
      setConfirmingDeleteId(null);
      await loadTitles();
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'Failed to delete title');
    }
  }

  async function runSearch(titleId: number) {
    setSearchState((prev) => ({ ...prev, [titleId]: 'searching' }));
    setSearchErrors((prev) => {
      const next = { ...prev };
      delete next[titleId];
      return next;
    });
    try {
      await searchPostingsForTitle(titleId);
      setSearchState((prev) => ({ ...prev, [titleId]: 'done' }));
      await loadTitles();
    } catch (error) {
      setSearchState((prev) => ({ ...prev, [titleId]: 'error' }));
      setSearchErrors((prev) => ({
        ...prev,
        [titleId]: error instanceof ApiError ? error.message : 'Search failed'
      }));
    }
  }

  async function handleSearchAll() {
    for (const title of titles) {
      await runSearch(title.id);
    }
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

      <button onClick={handleSearchAll} disabled={titles.length === 0}>
        Search all
      </button>

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
                      {deleteError && <p role="alert">{deleteError}</p>}
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditing(title)}>Edit</button>
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmingDeleteId(title.id);
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => runSearch(title.id)}
                        disabled={searchState[title.id] === 'searching'}
                      >
                        {searchState[title.id] === 'searching' ? 'Searching…' : 'Search now'}
                      </button>
                      <Link to={`/titles/${title.id}/postings`}>View postings</Link>
                      {searchState[title.id] === 'error' && (
                        <>
                          <span role="alert">{searchErrors[title.id]}</span>
                          <button onClick={() => runSearch(title.id)}>Retry</button>
                        </>
                      )}
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

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `client/`): `npx vitest run src/pages/PositionTitlesPage.test.tsx`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/PositionTitlesPage.tsx client/src/pages/PositionTitlesPage.test.tsx
git commit -m "feat(client): add Search now / Search all / View postings to Position Titles page"
```

---

### Task 7: Full verification, module docs, and manual smoke check

**Files:**
- Modify: `client/CLAUDE.md`

**Interfaces:** none (integration/documentation only).

- [ ] **Step 1: Run the full test suite from the root**

```bash
npm test
```

Expected: PASS — server suite now includes `openaiClient.test.js`, `postingService.test.js`, `searchService.test.js`, `postings.routes.test.js` (32 new server tests); client suite includes `PostingsPage.test.tsx` and the expanded `PositionTitlesPage.test.tsx` (12 new client tests).

- [ ] **Step 2: Manual smoke check via `npm run dev`**

```bash
npm run dev
```

Expected, in the browser at `http://localhost:5173`:
- Add a position title (e.g. "Test Title") if none exist.
- Without an OpenAI key configured, click "Search now" → see an inline error pointing to Settings; no request reaches OpenAI.
- Go to Settings and save a (test) API key — this plan does not require a real call to succeed, only that the "no key" path is correctly blocked and the "key present" path attempts the call (a real key is needed to verify an actual successful search end-to-end, per PRD Key Risk 2 — note in the handoff that this still needs a real-key pass before shipping to the end user).
- Click "View postings" → lands on `/titles/:id/postings`, shows the empty state.
- Confirm "Search all" is disabled with zero titles, enabled otherwise.

Stop the dev servers (Ctrl+C) once verified.

- [ ] **Step 3: Update `client/CLAUDE.md`**

Add to the end of the `## Key decisions` list:

```markdown
- "Search all" (Story 2.2) has no dedicated backend endpoint — `PositionTitlesPage` calls the single-title search endpoint once per title, sequentially, tracking per-title state (`idle | searching | done | error`) so failures are isolated and retryable per title without any new state-management library.
- The status `<select>` on `PostingsPage` only offers `New | In Progress | Rejected` — `Applied` requires the CV-upload flow (Plan 4) and isn't reachable from the UI yet; a posting already `Applied` (once Plan 4 ships) renders as plain text there instead of an editable control.
```

- [ ] **Step 4: Commit**

```bash
git add client/CLAUDE.md
git commit -m "docs(client): document Search all and the Applied-status deferral"
```

---

## Self-Review Notes

- **Spec coverage:** Story 2.1 (Task 2/3/4 — cap/freshness/dedup/missing-key/failure/zero-results), Story 2.2 (Task 6 — sequential per-title search, per-title failure isolation and retry, disabled with zero titles), Story 2.3 (Task 5 — results table with all listed columns, status filter, empty state, description truncation/expand), Story 3.1 (Task 5 — Open sets `viewed`, never touches `status`), Story 3.2 non-Applied part (Task 2/5 — New/In Progress/Rejected transitions; Applied explicitly deferred and documented as a Global Constraint and in both `CLAUDE.md`s).
- **Placeholder scan:** no TBD/"add appropriate handling" left; the one open item (exact OpenAI Responses API shape) is called out explicitly as PRD Open Question #2 with a concrete default implementation given, not a placeholder.
- **Type consistency:** `Posting`/`PostingStatus` (Task 5) match the server's `postingService.js` field names exactly (`positionTitleId`, `postingTitle`, `publishedDate`, `foundAt`, `adaptedResumePath`, `appliedCvPath`); `searchPostingsForTitle`'s return shape `{ totalFound, savedCount }` is identical between `postingService.js` (Task 2), `searchService.js` (Task 3), the route (Task 4), and the client API/tests (Task 5/6).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-25-job-search-assistant-search-results.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
