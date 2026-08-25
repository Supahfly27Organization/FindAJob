# Job Search Assistant — Resume Template & Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Epic 4 (Resume Template & Adaptation — Stories 4.1, 4.2, 4.3) end-to-end, in the browser, on top of the Plan 1/2 foundation: configure a resume template file, generate an AI-tailored draft resume for a specific posting without inventing or dropping content, and retrieve a previously generated draft later.

**Architecture:** Four new backend services follow the exact layering already established (`server/CLAUDE.md`'s "adding an endpoint" playbook): `resumeTemplateService.js` (settings-table-backed template metadata + file-on-disk management, mirrors `settingsService.js`'s key/value pattern), `resumeExtractionService.js` (plain-text extraction from `.docx`/`.pdf`/`.txt`/`.md`), `resumeGenerationService.js` (writes a fresh document in one of those same four formats from adapted text), and `resumeAdaptationService.js` (the orchestrator, following `searchService.js`'s injectable-dependency pattern). `openaiClient.js` gains a second call, `adaptResumeText`, using Chat Completions with JSON-object mode (no web search needed here, unlike the search call). Two existing routers gain endpoints: `routes/settings.js` (upload/status for the template) and `routes/postings.js` (trigger adaptation, download the result). On the client, `SettingsPage` gains a resume-template upload section and `PostingsPage` gains per-row "Adapt my resume" / "Download adapted resume" actions, following the existing inline-confirmation pattern (no `window.confirm`).

**Key technical decision (PRD Key Risk 1 / Open Question 1):** there is no true in-place template editing for any format. Every adaptation **extracts plain text** from the template, sends that text to OpenAI, and **regenerates a brand-new document** in the same format from the adapted text. This satisfies "same file format as the template" and "no invented/dropped content" but does **not** preserve the original template's visual layout/styling — the regenerated `.docx`/`.pdf` is plain, unstyled text. This is the PRD's own suggested mitigation for PDF, applied uniformly to all formats for consistency and simplicity.

**Key technical decision (accuracy constraint / Key Risk 1 mitigation):** "must not invent or drop content" is enforced via a **self-reported check within the same OpenAI call** — the model is asked to report how many distinct positions/roles it counted in the original template (`originalPositionCount`) and how many survive in its adapted output (`retainedPositionCount`); if `retainedPositionCount < originalPositionCount`, the service treats this as a generation failure (`UpstreamError`) and the user can retry (Story 4.2's edge case). This is a **v1 heuristic**, not a rigorous guarantee — it relies on the model accurately self-reporting, the same way search relevance relies on the model's web-search tool. Document this limitation in `server/CLAUDE.md`; revisit only if it proves unreliable in practice.

**Tech Stack:** Adds `docx` (generate `.docx`), `mammoth` (extract text from `.docx`), `pdfkit` (generate `.pdf`), `pdf-parse` (extract text from `.pdf`), and `multer` (multipart file upload) to `server/`. Everything else reuses Plan 1/2's stack: Express 4 + better-sqlite3 (backend), the `openai` SDK (Chat Completions this time, not the Responses API), React 19 + TypeScript + Vite + react-router-dom (frontend), Vitest + Supertest + React Testing Library + user-event (tests).

**Spec:**
- `docs/product-superpowers/prds/2026-08-25-job-search-assistant.md` (Proposed Solution items 4–5, Key Risk 1, Open Question 1)
- `docs/product-superpowers/stories/2026-08-25-job-search-assistant-stories.md` (Epic 4: Stories 4.1, 4.2, 4.3)

**Plan sequence:** This is **Plan 3 of 4**. It builds on Plan 1's DB schema (`postings.adapted_resume_path` already exists, unused until now — no schema changes needed) and service/route/error patterns, and Plan 2's `settingsService.getOpenAiKey` / `postingService.getPostingById`. Plan 4 (Applied CV Tracking & Packaging — Stories 3.3/3.4) follows, and is a separate, unrelated file (`applied_cv_path`) — it does not depend on anything built in this plan.

## Global Constraints

- Resume template uploads are restricted to `.docx`, `.pdf`, `.txt`, `.md` and capped at 10MB; anything else is rejected with a clear error naming the supported formats (Story 4.1).
- Only **one** active template at a time; uploading a new one replaces it, but previously generated adapted resumes (tied to past postings) are unaffected (Story 4.1).
- No true in-place editing of any format — every adaptation extracts plain text and regenerates a fresh document in the template's format (see "Key technical decision" above). Visual layout of the original template is **not** preserved.
- Resume adaptation output is always the **same format as the template that was active at generation time** (PRD item 4). Changing the template later does not retroactively change previously generated adapted resumes.
- Adaptation must never invent content the template doesn't contain, and must never drop a position/role from the template — enforced via the self-reported `originalPositionCount`/`retainedPositionCount` check (see "Key technical decision" above); a shortfall is treated as a generation failure, not silently saved (Story 4.2).
- Regenerating an adapted resume for a posting that already has one **replaces** the previous file; the client warns before doing so (Story 4.2).
- Adaptation cannot run without both a configured OpenAI API key and a configured resume template — blocked with a clear message pointing to Settings, not a generic error (Stories 4.2/5.1).
- Local-only app, no authentication (carried over from Plan 1/2).

---

## File Structure

```
FindAJob/
  server/
    src/
      config.js                          # MODIFY: add DATA_DIR, RESUME_TEMPLATE_DIR, ADAPTED_RESUMES_DIR, OPENAI_ADAPTATION_MODEL
      services/
        resumeTemplateService.js         # NEW: getResumeTemplateStatus, getResumeTemplateInfo, saveResumeTemplate
        resumeExtractionService.js       # NEW: extractResumeText
        resumeGenerationService.js       # NEW: generateResumeDocument
        openaiClient.js                  # MODIFY: add buildAdaptationPrompt, parseAdaptationResponse, adaptResumeText
        resumeAdaptationService.js       # NEW: adaptResumeForPosting (orchestrates the above)
      routes/
        settings.js                      # MODIFY: add GET/POST /api/settings/resume-template (multer)
        postings.js                      # MODIFY: add POST /postings/:id/adapt-resume, GET /postings/:id/adapted-resume
    package.json                         # MODIFY: adds `docx`, `mammoth`, `pdf-parse`, `pdfkit`, `multer`
    test/
      resumeTemplateService.test.js      # NEW
      resumeExtractionService.test.js    # NEW
      resumeGenerationService.test.js    # NEW
      openaiClient.test.js               # MODIFY: add adaptation prompt/parse tests
      resumeAdaptationService.test.js    # NEW
      settings.routes.test.js            # MODIFY: add resume-template route tests
      postings.routes.test.js            # MODIFY: add adapt-resume/adapted-resume route tests
    CLAUDE.md                            # MODIFY: document the new services/routes and their tradeoffs
  client/
    src/
      api/
        http.ts                          # MODIFY: add apiUpload
        resumeTemplate.ts                # NEW: fetchResumeTemplateStatus, uploadResumeTemplate
        postings.ts                      # MODIFY: add adaptResumeForPosting
      pages/
        SettingsPage.tsx                 # MODIFY: add resume template upload section
        SettingsPage.test.tsx            # MODIFY: add resume template tests, fix fetch sequencing
        PostingsPage.tsx                 # MODIFY: add Adapt/Download resume actions
        PostingsPage.test.tsx            # MODIFY: add adapt-resume tests
    CLAUDE.md                            # MODIFY: note the file-upload pattern and inline adapt/replace confirmation
  docs/claude/DOMAIN_MODEL.md            # MODIFY: document the ResumeTemplate entity
  docs/claude/PATTERNS.md                # MODIFY: document the file-upload/disk-backed-test-cleanup pattern
```

---

### Task 1: Config, dependencies, and `resumeTemplateService` (Story 4.1 backend, part 1)

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/config.js`
- Create: `server/src/services/resumeTemplateService.js`
- Test: `server/test/resumeTemplateService.test.js`

**Interfaces:**
- Consumes: the `settings` table (existing, from Plan 1's `schema.sql`).
- Produces: `DATA_DIR`, `RESUME_TEMPLATE_DIR`, `ADAPTED_RESUMES_DIR`, `OPENAI_ADAPTATION_MODEL` (from `config.js`); `getResumeTemplateStatus(db) => { hasTemplate: boolean, originalName: string|null, format: string|null }`, `getResumeTemplateInfo(db) => { path: string, format: string } | null`, `saveResumeTemplate(db, file) => { hasTemplate, originalName, format }` where `file` is `{ originalname: string, size: number, buffer: Buffer }` (Multer's in-memory file shape) — all relied on by Task 4's `resumeAdaptationService.js` and Task 5's `routes/settings.js`.

Note: this service writes real (tiny) files to disk under `RESUME_TEMPLATE_DIR`, unlike the DB-only services which use `:memory:`. Its test cleans up with `fs.rmSync(RESUME_TEMPLATE_DIR, { recursive: true, force: true })` in `afterEach` — see the pattern noted in `docs/claude/PATTERNS.md` (Task 8).

- [ ] **Step 1: Install the new dependencies**

Run (from `server/`):
```bash
npm install docx mammoth pdf-parse pdfkit multer
```

Expected: `server/package.json`'s `dependencies` gains `docx`, `mammoth`, `pdf-parse`, `pdfkit`, `multer`.

- [ ] **Step 2: Add config constants**

Modify `server/src/config.js`, adding after the existing exports:

```js
export const DATA_DIR = path.dirname(DB_PATH);
export const RESUME_TEMPLATE_DIR = path.join(DATA_DIR, 'resume-template');
export const ADAPTED_RESUMES_DIR = path.join(DATA_DIR, 'adapted-resumes');
export const OPENAI_ADAPTATION_MODEL = process.env.OPENAI_ADAPTATION_MODEL || 'gpt-4.1';
```

- [ ] **Step 3: Write the failing tests**

`server/test/resumeTemplateService.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { createDb } from '../src/db/index.js';
import {
  getResumeTemplateStatus,
  getResumeTemplateInfo,
  saveResumeTemplate
} from '../src/services/resumeTemplateService.js';
import { ValidationError } from '../src/errors.js';
import { RESUME_TEMPLATE_DIR } from '../src/config.js';

let db;

beforeEach(() => {
  db = createDb(':memory:');
});

afterEach(() => {
  fs.rmSync(RESUME_TEMPLATE_DIR, { recursive: true, force: true });
});

describe('getResumeTemplateStatus', () => {
  it('reports no template configured initially', () => {
    expect(getResumeTemplateStatus(db)).toEqual({ hasTemplate: false, originalName: null, format: null });
  });
});

describe('saveResumeTemplate', () => {
  it('saves a valid .docx template and reports it back', () => {
    const file = { originalname: 'resume.docx', size: 1024, buffer: Buffer.from('fake docx bytes') };
    const status = saveResumeTemplate(db, file);
    expect(status).toEqual({ hasTemplate: true, originalName: 'resume.docx', format: 'docx' });
    expect(getResumeTemplateStatus(db)).toEqual(status);
  });

  it('exposes the saved file path and format via getResumeTemplateInfo', () => {
    const file = { originalname: 'resume.txt', size: 10, buffer: Buffer.from('hello') };
    saveResumeTemplate(db, file);
    const info = getResumeTemplateInfo(db);
    expect(info.format).toBe('txt');
    expect(info.path).toMatch(/template\.txt$/);
    expect(fs.readFileSync(info.path, 'utf-8')).toBe('hello');
  });

  it('returns null from getResumeTemplateInfo when no template is set', () => {
    expect(getResumeTemplateInfo(db)).toBeNull();
  });

  it('replaces a previous template when a new one is uploaded', () => {
    saveResumeTemplate(db, { originalname: 'old.docx', size: 10, buffer: Buffer.from('old') });
    const status = saveResumeTemplate(db, { originalname: 'new.pdf', size: 10, buffer: Buffer.from('new') });
    expect(status).toEqual({ hasTemplate: true, originalName: 'new.pdf', format: 'pdf' });
    expect(getResumeTemplateInfo(db).format).toBe('pdf');
  });

  it('rejects an unsupported file format', () => {
    const file = { originalname: 'resume.pages', size: 10, buffer: Buffer.from('x') };
    expect(() => saveResumeTemplate(db, file)).toThrow(ValidationError);
    expect(() => saveResumeTemplate(db, file)).toThrow(/unsupported file format/i);
  });

  it('rejects a file larger than 10MB', () => {
    const file = { originalname: 'resume.docx', size: 11 * 1024 * 1024, buffer: Buffer.alloc(0) };
    expect(() => saveResumeTemplate(db, file)).toThrow(ValidationError);
    expect(() => saveResumeTemplate(db, file)).toThrow(/10MB/);
  });

  it('rejects when no file is provided', () => {
    expect(() => saveResumeTemplate(db, undefined)).toThrow(ValidationError);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/resumeTemplateService.test.js`
Expected: FAIL — `Cannot find module '../src/services/resumeTemplateService.js'`

- [ ] **Step 5: Implement `server/src/services/resumeTemplateService.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { ValidationError } from '../errors.js';
import { RESUME_TEMPLATE_DIR } from '../config.js';

const ALLOWED_FORMATS = ['docx', 'pdf', 'txt', 'md'];
const MAX_TEMPLATE_SIZE_BYTES = 10 * 1024 * 1024;

const PATH_KEY = 'resumeTemplatePath';
const NAME_KEY = 'resumeTemplateOriginalName';
const FORMAT_KEY = 'resumeTemplateFormat';

function getSetting(db, key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

function setSetting(db, key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export function getResumeTemplateStatus(db) {
  return {
    hasTemplate: Boolean(getSetting(db, NAME_KEY)),
    originalName: getSetting(db, NAME_KEY),
    format: getSetting(db, FORMAT_KEY)
  };
}

export function getResumeTemplateInfo(db) {
  const filePath = getSetting(db, PATH_KEY);
  const format = getSetting(db, FORMAT_KEY);
  if (!filePath || !format) {
    return null;
  }
  return { path: filePath, format };
}

export function saveResumeTemplate(db, file) {
  if (!file) {
    throw new ValidationError('Select a resume file to upload.');
  }
  if (file.size > MAX_TEMPLATE_SIZE_BYTES) {
    throw new ValidationError('Resume template must be 10MB or smaller.');
  }
  const ext = path.extname(file.originalname).toLowerCase().replace(/^\./, '');
  if (!ALLOWED_FORMATS.includes(ext)) {
    throw new ValidationError(`Unsupported file format. Supported formats: ${ALLOWED_FORMATS.join(', ')}.`);
  }

  fs.mkdirSync(RESUME_TEMPLATE_DIR, { recursive: true });

  const previousPath = getSetting(db, PATH_KEY);
  const newPath = path.join(RESUME_TEMPLATE_DIR, `template.${ext}`);

  fs.writeFileSync(newPath, file.buffer);
  if (previousPath && previousPath !== newPath && fs.existsSync(previousPath)) {
    fs.unlinkSync(previousPath);
  }

  setSetting(db, PATH_KEY, newPath);
  setSetting(db, NAME_KEY, file.originalname);
  setSetting(db, FORMAT_KEY, ext);

  return getResumeTemplateStatus(db);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/resumeTemplateService.test.js`
Expected: PASS (7 tests)

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json server/src/config.js server/src/services/resumeTemplateService.js server/test/resumeTemplateService.test.js
git commit -m "feat(server): add resume template config, dependencies, and template service"
```

---

### Task 2: `resumeExtractionService` — plain-text extraction from all four formats

**Files:**
- Create: `server/src/services/resumeExtractionService.js`
- Test: `server/test/resumeExtractionService.test.js`

**Interfaces:**
- Consumes: `mammoth`, `pdf-parse`, `node:fs/promises` (installed in Task 1).
- Produces: `extractResumeText(filePath, format) => Promise<string>` — relied on by Task 4's `resumeAdaptationService.js`.

Note: the test builds its own minimal `.docx`/`.pdf` fixtures inline using the raw `docx`/`pdfkit` libraries (not this plan's own generation service, to keep this task independent of Task 3).

- [ ] **Step 1: Write the failing tests**

`server/test/resumeExtractionService.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Document, Packer, Paragraph } from 'docx';
import PDFDocument from 'pdfkit';
import { extractResumeText } from '../src/services/resumeExtractionService.js';

let tmpDir;

beforeAll(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'findajob-extract-'));
});

afterAll(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

describe('extractResumeText', () => {
  it('extracts text from a plain .txt file', async () => {
    const filePath = path.join(tmpDir, 'resume.txt');
    await fsp.writeFile(filePath, 'Jane Doe\nSoftware Engineer', 'utf-8');
    expect(await extractResumeText(filePath, 'txt')).toBe('Jane Doe\nSoftware Engineer');
  });

  it('extracts text from a .md file', async () => {
    const filePath = path.join(tmpDir, 'resume.md');
    await fsp.writeFile(filePath, '# Jane Doe\n\nSoftware Engineer', 'utf-8');
    expect(await extractResumeText(filePath, 'md')).toBe('# Jane Doe\n\nSoftware Engineer');
  });

  it('extracts text from a .docx file', async () => {
    const filePath = path.join(tmpDir, 'resume.docx');
    const doc = new Document({
      sections: [{ children: [new Paragraph('Jane Doe'), new Paragraph('Software Engineer at Acme')] }]
    });
    await fsp.writeFile(filePath, await Packer.toBuffer(doc));

    const text = await extractResumeText(filePath, 'docx');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Software Engineer at Acme');
  });

  it('extracts text from a .pdf file', async () => {
    const filePath = path.join(tmpDir, 'resume.pdf');
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', reject);
      doc.text('Jane Doe');
      doc.text('Software Engineer at Acme');
      doc.end();
    });

    const text = await extractResumeText(filePath, 'pdf');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Software Engineer at Acme');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/resumeExtractionService.test.js`
Expected: FAIL — `Cannot find module '../src/services/resumeExtractionService.js'`

- [ ] **Step 3: Implement `server/src/services/resumeExtractionService.js`**

```js
import fs from 'node:fs/promises';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export async function extractResumeText(filePath, format) {
  if (format === 'docx') {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value.trim();
  }
  if (format === 'pdf') {
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }
  const text = await fs.readFile(filePath, 'utf-8');
  return text.trim();
}
```

**Note on `pdf-parse`:** the installed version is the v2 API (`PDFParse` class with `getText()`/`destroy()`), not the older v1 single-function API (`pdf(buffer) => {text}`) that older examples online show. Verified directly against the installed package during plan pre-flight — use the class-based API above as written, not the v1 shape.

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/resumeExtractionService.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/resumeExtractionService.js server/test/resumeExtractionService.test.js
git commit -m "feat(server): add resume text extraction for docx/pdf/txt/md"
```

---

### Task 3: `resumeGenerationService` — regenerate a document in any of the four formats

**Files:**
- Create: `server/src/services/resumeGenerationService.js`
- Test: `server/test/resumeGenerationService.test.js`

**Interfaces:**
- Consumes: `docx`, `pdfkit`, `node:fs` (installed in Task 1); `extractResumeText` (Task 2, used only by this task's own tests to verify docx/pdf round-trip).
- Produces: `generateResumeDocument(text, format, outputPath) => Promise<void>` — creates `outputPath`'s parent directory if needed; relied on by Task 4's `resumeAdaptationService.js`.

- [ ] **Step 1: Write the failing tests**

`server/test/resumeGenerationService.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateResumeDocument } from '../src/services/resumeGenerationService.js';
import { extractResumeText } from '../src/services/resumeExtractionService.js';

let tmpDir;

beforeAll(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'findajob-generate-'));
});

afterAll(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

describe('generateResumeDocument', () => {
  it('writes a plain .txt file with the exact text, creating parent directories', async () => {
    const outputPath = path.join(tmpDir, 'nested', 'resume.txt');
    await generateResumeDocument('Jane Doe\nSoftware Engineer', 'txt', outputPath);
    expect(await fsp.readFile(outputPath, 'utf-8')).toBe('Jane Doe\nSoftware Engineer');
  });

  it('writes a .md file with the exact text', async () => {
    const outputPath = path.join(tmpDir, 'resume.md');
    await generateResumeDocument('# Jane Doe', 'md', outputPath);
    expect(await fsp.readFile(outputPath, 'utf-8')).toBe('# Jane Doe');
  });

  it('writes a .docx file whose text can be extracted back', async () => {
    const outputPath = path.join(tmpDir, 'resume.docx');
    await generateResumeDocument('Jane Doe\nSoftware Engineer at Acme', 'docx', outputPath);
    const text = await extractResumeText(outputPath, 'docx');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Software Engineer at Acme');
  });

  it('writes a .pdf file whose text can be extracted back', async () => {
    const outputPath = path.join(tmpDir, 'resume.pdf');
    await generateResumeDocument('Jane Doe\nSoftware Engineer at Acme', 'pdf', outputPath);
    const text = await extractResumeText(outputPath, 'pdf');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Software Engineer at Acme');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/resumeGenerationService.test.js`
Expected: FAIL — `Cannot find module '../src/services/resumeGenerationService.js'`

- [ ] **Step 3: Implement `server/src/services/resumeGenerationService.js`**

```js
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Document, Packer, Paragraph } from 'docx';
import PDFDocument from 'pdfkit';

async function generateDocx(text, outputPath) {
  const paragraphs = text.split('\n').map((line) => new Paragraph(line));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);
  await fsp.writeFile(outputPath, buffer);
}

function generatePdf(text, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    doc.on('error', reject);
    stream.on('finish', resolve);
    stream.on('error', reject);
    for (const line of text.split('\n')) {
      doc.text(line);
    }
    doc.end();
  });
}

export async function generateResumeDocument(text, format, outputPath) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  if (format === 'docx') {
    await generateDocx(text, outputPath);
    return;
  }
  if (format === 'pdf') {
    await generatePdf(text, outputPath);
    return;
  }
  await fsp.writeFile(outputPath, text, 'utf-8');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/resumeGenerationService.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/resumeGenerationService.js server/test/resumeGenerationService.test.js
git commit -m "feat(server): add resume document generation for docx/pdf/txt/md"
```

---

### Task 4: `openaiClient.adaptResumeText` + `resumeAdaptationService` (Story 4.2 orchestration)

**Files:**
- Modify: `server/src/services/openaiClient.js`
- Modify: `server/test/openaiClient.test.js`
- Create: `server/src/services/resumeAdaptationService.js`
- Test: `server/test/resumeAdaptationService.test.js`

**Interfaces:**
- Consumes: `OPENAI_ADAPTATION_MODEL` (Task 1), `getOpenAiKey` (`settingsService.js`, existing), `getResumeTemplateInfo` (Task 1), `getPostingById` (`postingService.js`, existing), `extractResumeText` (Task 2), `generateResumeDocument` (Task 3), `ADAPTED_RESUMES_DIR` (Task 1).
- Produces: `buildAdaptationPrompt(templateText, posting) => string`, `parseAdaptationResponse(rawText) => { adaptedResumeText, originalPositionCount, retainedPositionCount }`, `adaptResumeText(apiKey, templateText, posting) => Promise<{ adaptedResumeText, originalPositionCount, retainedPositionCount }>` (all in `openaiClient.js`); `adaptResumeForPosting(db, postingId, { adaptResume = adaptResumeText } = {}) => Promise<Posting>` — relied on by Task 5's `routes/postings.js`.

Note: like `searchJobPostings`, the real `adaptResumeText` network call is not unit tested here (no live network access) — only `buildAdaptationPrompt`/`parseAdaptationResponse` are. `resumeAdaptationService.js` is tested via the same dependency-injection pattern as `searchService.js`.

- [ ] **Step 1: Write the failing tests for the new `openaiClient.js` helpers**

Modify `server/test/openaiClient.test.js`, changing the import line to:

```js
import { describe, it, expect } from 'vitest';
import {
  buildSearchPrompt,
  parseSearchResponse,
  buildAdaptationPrompt,
  parseAdaptationResponse
} from '../src/services/openaiClient.js';
```

and appending at the end of the file:

```js

describe('buildAdaptationPrompt', () => {
  it('includes the template text and the posting details', () => {
    const prompt = buildAdaptationPrompt('Jane Doe\nPM at Acme', {
      postingTitle: 'Senior PM',
      company: 'Beta',
      description: 'Lead the product'
    });
    expect(prompt).toContain('Jane Doe');
    expect(prompt).toContain('PM at Acme');
    expect(prompt).toContain('Senior PM');
    expect(prompt).toContain('Beta');
    expect(prompt).toContain('Lead the product');
  });
});

describe('parseAdaptationResponse', () => {
  it('parses a valid adaptation response', () => {
    const result = parseAdaptationResponse(
      '{"adaptedResumeText":"Jane Doe","originalPositionCount":1,"retainedPositionCount":1}'
    );
    expect(result).toEqual({ adaptedResumeText: 'Jane Doe', originalPositionCount: 1, retainedPositionCount: 1 });
  });

  it('parses a response wrapped in a markdown code fence', () => {
    const result = parseAdaptationResponse(
      '```json\n{"adaptedResumeText":"Jane Doe","originalPositionCount":1,"retainedPositionCount":1}\n```'
    );
    expect(result.adaptedResumeText).toBe('Jane Doe');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseAdaptationResponse('not json')).toThrow('not valid JSON');
  });

  it('throws when a required field is missing', () => {
    expect(() => parseAdaptationResponse('{"adaptedResumeText":"Jane Doe"}')).toThrow('missing required fields');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/openaiClient.test.js`
Expected: FAIL — `buildAdaptationPrompt`/`parseAdaptationResponse` are not exported

- [ ] **Step 3: Implement the `openaiClient.js` additions**

Modify `server/src/services/openaiClient.js`'s import line:

```js
import OpenAI from 'openai';
import { OPENAI_SEARCH_MODEL, OPENAI_ADAPTATION_MODEL } from '../config.js';
```

and append at the end of the file:

```js

export function buildAdaptationPrompt(templateText, posting) {
  return `You are adapting a job seeker's resume to better match a specific job posting, without fabricating anything.

RESUME TEMPLATE (the only source of truth for her experience — do not add anything not present here):
"""
${templateText}
"""

TARGET JOB POSTING:
Title: ${posting.postingTitle}
Company: ${posting.company ?? 'Unknown'}
Description: ${posting.description ?? 'No description provided'}

Rules:
- Do NOT invent any experience, skill, or qualification that is not already present in the resume template above.
- Do NOT remove any position/role that appears in the resume template — you may reframe, reorder, or re-emphasize existing content, but every position/role must still appear in your output.
- Count the number of distinct positions/roles (jobs held) mentioned in the resume template.
- Produce an adapted version of the resume, tailored to the job posting above, as plain text.

Respond with ONLY a JSON object (no markdown, no commentary, no code fences) with exactly these fields:
{
  "adaptedResumeText": string,
  "originalPositionCount": number,
  "retainedPositionCount": number
}

"originalPositionCount" is how many distinct positions/roles you counted in the resume template.
"retainedPositionCount" is how many of those same positions/roles are still present in "adaptedResumeText".`;
}

export function parseAdaptationResponse(rawText) {
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
  if (
    !parsed ||
    typeof parsed.adaptedResumeText !== 'string' ||
    typeof parsed.originalPositionCount !== 'number' ||
    typeof parsed.retainedPositionCount !== 'number'
  ) {
    throw new Error('OpenAI response was missing required fields');
  }
  return parsed;
}

export async function adaptResumeText(apiKey, templateText, posting) {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: OPENAI_ADAPTATION_MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildAdaptationPrompt(templateText, posting) }]
  });
  return parseAdaptationResponse(response.choices[0]?.message?.content);
}
```

**Verify against current docs:** confirm the Chat Completions JSON-object response-format shape (`response_format: { type: 'json_object' }`) and the `gpt-4.1` model name against the OpenAI Node SDK's current docs when a real API key is available (same open item as Plan 2's search call — PRD Open Question #2).

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/openaiClient.test.js`
Expected: PASS (9 tests total: 5 existing + 4 new)

- [ ] **Step 5: Write the failing tests for `resumeAdaptationService`**

`server/test/resumeAdaptationService.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { createDb } from '../src/db/index.js';
import { createPositionTitle } from '../src/services/positionTitleService.js';
import { saveSearchResults } from '../src/services/postingService.js';
import { saveOpenAiKey } from '../src/services/settingsService.js';
import { saveResumeTemplate } from '../src/services/resumeTemplateService.js';
import { adaptResumeForPosting } from '../src/services/resumeAdaptationService.js';
import { ValidationError, UpstreamError, NotFoundError } from '../src/errors.js';
import { RESUME_TEMPLATE_DIR, ADAPTED_RESUMES_DIR } from '../src/config.js';

let db;
let posting;

beforeEach(() => {
  db = createDb(':memory:');
  const title = createPositionTitle(db, 'Product Manager');
  saveSearchResults(db, title.id, [
    { postingTitle: 'Senior PM', description: 'Lead the product', company: 'Acme', url: 'https://example.com/job/1' }
  ]);
  [posting] = db.prepare('SELECT id FROM postings').all();
});

afterEach(() => {
  fs.rmSync(RESUME_TEMPLATE_DIR, { recursive: true, force: true });
  fs.rmSync(ADAPTED_RESUMES_DIR, { recursive: true, force: true });
});

describe('adaptResumeForPosting', () => {
  it('throws ValidationError when no API key is configured', async () => {
    saveResumeTemplate(db, { originalname: 'resume.txt', size: 10, buffer: Buffer.from('Jane Doe') });
    await expect(adaptResumeForPosting(db, posting.id)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when no resume template is configured', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    await expect(adaptResumeForPosting(db, posting.id)).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError for a missing posting', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, { originalname: 'resume.txt', size: 10, buffer: Buffer.from('Jane Doe') });
    await expect(adaptResumeForPosting(db, 999)).rejects.toThrow(NotFoundError);
  });

  it('generates and saves an adapted resume using the injected adapter', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, {
      originalname: 'resume.txt',
      size: 10,
      buffer: Buffer.from('Jane Doe\nPM at Acme')
    });
    const adaptResume = vi.fn().mockResolvedValue({
      adaptedResumeText: 'Jane Doe\nSenior PM at Acme',
      originalPositionCount: 1,
      retainedPositionCount: 1
    });

    const updated = await adaptResumeForPosting(db, posting.id, { adaptResume });

    expect(adaptResume).toHaveBeenCalledWith(
      'sk-test1234567890',
      'Jane Doe\nPM at Acme',
      expect.objectContaining({ id: posting.id, postingTitle: 'Senior PM' })
    );
    expect(updated.adaptedResumePath).toMatch(/posting-\d+\.txt$/);
    expect(fs.readFileSync(updated.adaptedResumePath, 'utf-8')).toBe('Jane Doe\nSenior PM at Acme');
  });

  it('throws an UpstreamError when the adaptation drops a position', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, {
      originalname: 'resume.txt',
      size: 10,
      buffer: Buffer.from('Jane Doe\nPM at Acme\nQA at Beta')
    });
    const adaptResume = vi.fn().mockResolvedValue({
      adaptedResumeText: 'Jane Doe\nSenior PM at Acme',
      originalPositionCount: 2,
      retainedPositionCount: 1
    });

    await expect(adaptResumeForPosting(db, posting.id, { adaptResume })).rejects.toThrow(UpstreamError);
  });

  it('wraps a failed adaptation call in an UpstreamError', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, { originalname: 'resume.txt', size: 10, buffer: Buffer.from('Jane Doe') });
    const adaptResume = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(adaptResumeForPosting(db, posting.id, { adaptResume })).rejects.toThrow(UpstreamError);
  });

  it('reports a rejected API key as a ValidationError instead of a generic UpstreamError', async () => {
    saveOpenAiKey(db, 'sk-test1234567890');
    saveResumeTemplate(db, { originalname: 'resume.txt', size: 10, buffer: Buffer.from('Jane Doe') });
    const authError = new Error('Incorrect API key provided');
    authError.status = 401;
    const adaptResume = vi.fn().mockRejectedValue(authError);

    await expect(adaptResumeForPosting(db, posting.id, { adaptResume })).rejects.toThrow(ValidationError);
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run (from `server/`): `npx vitest run test/resumeAdaptationService.test.js`
Expected: FAIL — `Cannot find module '../src/services/resumeAdaptationService.js'`

- [ ] **Step 7: Implement `server/src/services/resumeAdaptationService.js`**

```js
import path from 'node:path';
import { ValidationError, UpstreamError } from '../errors.js';
import { getOpenAiKey } from './settingsService.js';
import { getResumeTemplateInfo } from './resumeTemplateService.js';
import { getPostingById } from './postingService.js';
import { extractResumeText } from './resumeExtractionService.js';
import { generateResumeDocument } from './resumeGenerationService.js';
import { adaptResumeText } from './openaiClient.js';
import { ADAPTED_RESUMES_DIR } from '../config.js';

export async function adaptResumeForPosting(db, postingId, { adaptResume = adaptResumeText } = {}) {
  const posting = getPostingById(db, postingId);

  const apiKey = getOpenAiKey(db);
  if (!apiKey) {
    throw new ValidationError('Configure your OpenAI API key in Settings before adapting your resume.');
  }

  const template = getResumeTemplateInfo(db);
  if (!template) {
    throw new ValidationError('Configure your resume template in Settings before adapting your resume.');
  }

  const templateText = await extractResumeText(template.path, template.format);

  let result;
  try {
    result = await adaptResume(apiKey, templateText, posting);
  } catch (error) {
    console.error('[resume-adaptation] OpenAI call failed for posting', postingId, error);
    if (error?.status === 401) {
      throw new ValidationError('Your OpenAI API key was rejected. Update it in Settings.');
    }
    throw new UpstreamError('Resume adaptation failed. Please try again.');
  }

  if (result.retainedPositionCount < result.originalPositionCount) {
    throw new UpstreamError(
      'The adapted resume appears to have dropped part of your work history. Please try again.'
    );
  }

  const outputPath = path.join(ADAPTED_RESUMES_DIR, `posting-${postingId}.${template.format}`);
  await generateResumeDocument(result.adaptedResumeText, template.format, outputPath);

  db.prepare('UPDATE postings SET adapted_resume_path = ? WHERE id = ?').run(outputPath, postingId);
  return getPostingById(db, postingId);
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run (from `server/`): `npx vitest run test/resumeAdaptationService.test.js`
Expected: PASS (6 tests)

- [ ] **Step 9: Commit**

```bash
git add server/src/services/openaiClient.js server/test/openaiClient.test.js server/src/services/resumeAdaptationService.js server/test/resumeAdaptationService.test.js
git commit -m "feat(server): add OpenAI resume adaptation call and orchestrating service"
```

---

### Task 5: REST routes — resume template upload and posting adaptation/download

**Files:**
- Modify: `server/src/routes/settings.js`
- Modify: `server/src/routes/postings.js`
- Modify: `server/test/settings.routes.test.js`
- Modify: `server/test/postings.routes.test.js`

**Interfaces:**
- Consumes: `getResumeTemplateStatus`/`saveResumeTemplate` (Task 1), `adaptResumeForPosting` (Task 4), `getPostingById` (existing), `ValidationError`/`NotFoundError` (existing).
- Produces: `GET /api/settings/resume-template`, `POST /api/settings/resume-template` (multipart, field name `file`), `POST /api/postings/:id/adapt-resume`, `GET /api/postings/:id/adapted-resume` — relied on by Tasks 6 and 7's client API modules.

- [ ] **Step 1: Write the failing route tests**

Modify `server/test/settings.routes.test.js`, adding these imports at the top (after the existing ones):

```js
import fs from 'node:fs';
import { RESUME_TEMPLATE_DIR } from '../src/config.js';
```

and appending at the end of the file:

```js

describe('GET /api/settings/resume-template', () => {
  it('reports no template configured initially', async () => {
    const response = await request(app).get('/api/settings/resume-template');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasTemplate: false, originalName: null, format: null });
  });
});

describe('POST /api/settings/resume-template', () => {
  afterEach(() => {
    fs.rmSync(RESUME_TEMPLATE_DIR, { recursive: true, force: true });
  });

  it('saves an uploaded .txt template', async () => {
    const response = await request(app)
      .post('/api/settings/resume-template')
      .attach('file', Buffer.from('Jane Doe'), 'resume.txt');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasTemplate: true, originalName: 'resume.txt', format: 'txt' });
  });

  it('rejects an unsupported file format', async () => {
    const response = await request(app)
      .post('/api/settings/resume-template')
      .attach('file', Buffer.from('x'), 'resume.pages');
    expect(response.status).toBe(400);
  });
});
```

Modify `server/test/postings.routes.test.js`'s mock block to also mock `adaptResumeText`, changing:

```js
vi.mock('../src/services/openaiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, searchJobPostings: vi.fn() };
});

import { searchJobPostings } from '../src/services/openaiClient.js';
```

to:

```js
vi.mock('../src/services/openaiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, searchJobPostings: vi.fn(), adaptResumeText: vi.fn() };
});

import { searchJobPostings, adaptResumeText } from '../src/services/openaiClient.js';
```

and adding these imports right after (alongside the existing ones):

```js
import fs from 'node:fs';
import { RESUME_TEMPLATE_DIR, ADAPTED_RESUMES_DIR } from '../src/config.js';
```

Add `vi.mocked(adaptResumeText).mockReset();` to the existing `beforeEach` block, right after `vi.mocked(searchJobPostings).mockReset();`.

Add this helper near the existing `createTitle`/`configureApiKey` helpers:

```js
async function createPostingWithTemplate() {
  const title = await createTitle('Product Manager');
  await configureApiKey();
  vi.mocked(searchJobPostings).mockResolvedValue([
    { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
  ]);
  await request(app).post(`/api/position-titles/${title.id}/search`);
  const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;
  await request(app).post('/api/settings/resume-template').attach('file', Buffer.from('Jane Doe'), 'resume.txt');
  return posting;
}
```

Append at the end of the file:

```js

describe('POST /api/postings/:id/adapt-resume', () => {
  afterEach(() => {
    fs.rmSync(RESUME_TEMPLATE_DIR, { recursive: true, force: true });
    fs.rmSync(ADAPTED_RESUMES_DIR, { recursive: true, force: true });
  });

  it('adapts and saves a resume for a posting', async () => {
    const posting = await createPostingWithTemplate();
    vi.mocked(adaptResumeText).mockResolvedValue({
      adaptedResumeText: 'Jane Doe, tailored',
      originalPositionCount: 1,
      retainedPositionCount: 1
    });

    const response = await request(app).post(`/api/postings/${posting.id}/adapt-resume`);
    expect(response.status).toBe(200);
    expect(response.body.adaptedResumePath).toMatch(/posting-\d+\.txt$/);
  });

  it('rejects when no resume template is configured', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);
    const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;

    const response = await request(app).post(`/api/postings/${posting.id}/adapt-resume`);
    expect(response.status).toBe(400);
  });

  it('returns 404 for a missing posting', async () => {
    await request(app).post('/api/settings/resume-template').attach('file', Buffer.from('Jane Doe'), 'resume.txt');
    const response = await request(app).post('/api/postings/999/adapt-resume');
    expect(response.status).toBe(404);
  });
});

describe('GET /api/postings/:id/adapted-resume', () => {
  afterEach(() => {
    fs.rmSync(RESUME_TEMPLATE_DIR, { recursive: true, force: true });
    fs.rmSync(ADAPTED_RESUMES_DIR, { recursive: true, force: true });
  });

  it('downloads the adapted resume file', async () => {
    const posting = await createPostingWithTemplate();
    vi.mocked(adaptResumeText).mockResolvedValue({
      adaptedResumeText: 'Jane Doe, tailored',
      originalPositionCount: 1,
      retainedPositionCount: 1
    });
    await request(app).post(`/api/postings/${posting.id}/adapt-resume`);

    const response = await request(app).get(`/api/postings/${posting.id}/adapted-resume`);
    expect(response.status).toBe(200);
    expect(response.text).toBe('Jane Doe, tailored');
  });

  it('returns 404 when no adapted resume exists yet', async () => {
    const posting = await createPostingWithTemplate();
    const response = await request(app).get(`/api/postings/${posting.id}/adapted-resume`);
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`):
```bash
npx vitest run test/settings.routes.test.js test/postings.routes.test.js
```
Expected: FAIL — 404s on the new routes (they don't exist yet)

- [ ] **Step 3: Implement the `settings.js` route additions**

Replace the full contents of `server/src/routes/settings.js`:

```js
import { Router } from 'express';
import multer from 'multer';
import { ValidationError } from '../errors.js';
import { getOpenAiKeyStatus, saveOpenAiKey } from '../services/settingsService.js';
import { getResumeTemplateStatus, saveResumeTemplate } from '../services/resumeTemplateService.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

  router.get('/resume-template', (req, res) => {
    res.json(getResumeTemplateStatus(db));
  });

  router.post('/resume-template', (req, res, next) => {
    upload.single('file')(req, res, (uploadError) => {
      if (uploadError) {
        if (uploadError.code === 'LIMIT_FILE_SIZE') {
          return next(new ValidationError('Resume template must be 10MB or smaller.'));
        }
        return next(uploadError);
      }
      try {
        res.json(saveResumeTemplate(db, req.file));
      } catch (error) {
        next(error);
      }
    });
  });

  app.use('/api/settings', router);
}
```

- [ ] **Step 4: Implement the `postings.js` route additions**

Replace the full contents of `server/src/routes/postings.js`:

```js
import { Router } from 'express';
import path from 'node:path';
import { searchPostingsForTitle } from '../services/searchService.js';
import {
  listPostingsForTitle,
  markPostingViewed,
  updatePostingStatus,
  getPostingById
} from '../services/postingService.js';
import { adaptResumeForPosting } from '../services/resumeAdaptationService.js';
import { NotFoundError } from '../errors.js';

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

  router.post('/postings/:id/adapt-resume', async (req, res, next) => {
    try {
      res.json(await adaptResumeForPosting(db, Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  });

  router.get('/postings/:id/adapted-resume', (req, res, next) => {
    try {
      const posting = getPostingById(db, Number(req.params.id));
      if (!posting.adaptedResumePath) {
        throw new NotFoundError('No adapted resume has been generated for this posting yet.');
      }
      const filename = `adapted-resume${path.extname(posting.adaptedResumePath)}`;
      res.download(posting.adaptedResumePath, filename, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', router);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `server/`):
```bash
npx vitest run test/settings.routes.test.js test/postings.routes.test.js
```
Expected: PASS (all tests in both files)

- [ ] **Step 6: Run the full server test suite**

Run (from `server/`): `npx vitest run`
Expected: PASS (all tests, no regressions)

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/settings.js server/src/routes/postings.js server/test/settings.routes.test.js server/test/postings.routes.test.js
git commit -m "feat(server): add resume template and posting adaptation REST routes"
```

---

### Task 6: Client — Resume template upload on the Settings page (Story 4.1 frontend)

**Files:**
- Modify: `client/src/api/http.ts`
- Create: `client/src/api/resumeTemplate.ts`
- Modify: `client/src/pages/SettingsPage.tsx`
- Modify: `client/src/pages/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `GET /api/settings/resume-template`, `POST /api/settings/resume-template` (Task 5).
- Produces: `apiUpload<T>(path, formData) => Promise<T>` (in `http.ts`); `fetchResumeTemplateStatus() => Promise<ResumeTemplateStatus>`, `uploadResumeTemplate(file: File) => Promise<ResumeTemplateStatus>` (in `resumeTemplate.ts`) — relied on by `SettingsPage.tsx` this task, and available for reuse by any future page.

- [ ] **Step 1: Write the failing tests**

Modify `client/src/pages/SettingsPage.test.tsx` to account for the new resume-template fetch on mount and add new test cases. Replace the full contents of the file:

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

const NO_TEMPLATE = { status: 200, body: { hasTemplate: false, originalName: null, format: null } };

describe('SettingsPage', () => {
  it('shows that no key is configured initially', async () => {
    mockFetchSequence([{ status: 200, body: { hasKey: false, maskedKey: null } }, NO_TEMPLATE]);
    render(<SettingsPage />);
    expect(await screen.findByText(/no api key configured/i)).toBeInTheDocument();
  });

  it('shows the masked key once one is saved', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      NO_TEMPLATE,
      { status: 200, body: { hasKey: true, maskedKey: '••••mnop' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no api key configured/i);

    await user.type(screen.getByLabelText(/openai api key/i), 'sk-abcdefghijklmnop');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/••••mnop/)).toBeInTheDocument();
  });

  it('shows a validation error when saving the key fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      NO_TEMPLATE,
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

  it('shows an error when the initial key status fetch fails', async () => {
    mockFetchSequence([{ status: 500, body: { message: 'Failed to load API key status' } }, NO_TEMPLATE]);
    render(<SettingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load API key status');
  });

  it('shows that no resume template is configured initially', async () => {
    mockFetchSequence([{ status: 200, body: { hasKey: false, maskedKey: null } }, NO_TEMPLATE]);
    render(<SettingsPage />);
    expect(await screen.findByText(/no resume template configured/i)).toBeInTheDocument();
  });

  it('shows an error when the initial template status fetch fails', async () => {
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      { status: 500, body: { message: 'Failed to load resume template status' } }
    ]);
    render(<SettingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load resume template status');
  });

  it('shows the uploaded template once saved', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      NO_TEMPLATE,
      { status: 200, body: { hasTemplate: true, originalName: 'resume.docx', format: 'docx' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no resume template configured/i);

    const file = new File(['dummy content'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    await user.upload(screen.getByLabelText(/resume template file/i), file);
    await user.click(screen.getByRole('button', { name: /upload/i }));

    expect(await screen.findByText(/resume\.docx/)).toBeInTheDocument();
  });

  it('shows a validation error when the template upload fails', async () => {
    // applyAccept: false — the input keeps accept=".docx,.pdf,.txt,.md" for real users (a native
    // file-picker UX hint), but userEvent.upload() filters files against that same attribute by
    // default, which would silently drop this .pages fixture before it ever reaches onChange.
    // This flag is test-only and does not change production behavior.
    const user = userEvent.setup({ applyAccept: false });
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      NO_TEMPLATE,
      { status: 400, body: { message: 'Unsupported file format. Supported formats: docx, pdf, txt, md.' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no resume template configured/i);

    const file = new File(['dummy'], 'resume.pages');
    await user.upload(screen.getByLabelText(/resume template file/i), file);
    await user.click(screen.getByRole('button', { name: /upload/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/unsupported file format/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `client/`): `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: FAIL — no resume-template UI exists yet, and the second `fetch` call per test (the template status fetch) is not made by the current component

- [ ] **Step 3: Implement `apiUpload` in `client/src/api/http.ts`**

Append to `client/src/api/http.ts`:

```ts

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(path, { method: 'POST', body: formData });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(body.message ?? 'Request failed', response.status);
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: Create `client/src/api/resumeTemplate.ts`**

```ts
import { apiFetch, apiUpload } from './http';

export interface ResumeTemplateStatus {
  hasTemplate: boolean;
  originalName: string | null;
  format: string | null;
}

export function fetchResumeTemplateStatus(): Promise<ResumeTemplateStatus> {
  return apiFetch<ResumeTemplateStatus>('/api/settings/resume-template');
}

export function uploadResumeTemplate(file: File): Promise<ResumeTemplateStatus> {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<ResumeTemplateStatus>('/api/settings/resume-template', formData);
}
```

- [ ] **Step 5: Implement the `SettingsPage.tsx` resume template section**

Replace the full contents of `client/src/pages/SettingsPage.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { fetchOpenAiKeyStatus, saveOpenAiKey, type OpenAiKeyStatus } from '../api/settings';
import {
  fetchResumeTemplateStatus,
  uploadResumeTemplate,
  type ResumeTemplateStatus
} from '../api/resumeTemplate';
import { ApiError } from '../api/http';

export default function SettingsPage() {
  const [status, setStatus] = useState<OpenAiKeyStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [templateStatus, setTemplateStatus] = useState<ResumeTemplateStatus | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  async function loadStatus() {
    setLoadError(null);
    try {
      setStatus(await fetchOpenAiKeyStatus());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load API key status');
    }
  }

  async function loadTemplateStatus() {
    setTemplateLoadError(null);
    try {
      setTemplateStatus(await fetchResumeTemplateStatus());
    } catch (err) {
      setTemplateLoadError(err instanceof ApiError ? err.message : 'Failed to load resume template status');
    }
  }

  useEffect(() => {
    loadStatus();
    loadTemplateStatus();
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

  async function handleTemplateUpload(event: FormEvent) {
    event.preventDefault();
    setTemplateError(null);
    if (!templateFile) {
      setTemplateError('Select a resume file first.');
      return;
    }
    setUploadingTemplate(true);
    try {
      const updated = await uploadResumeTemplate(templateFile);
      setTemplateStatus(updated);
      setTemplateFile(null);
    } catch (err) {
      setTemplateError(err instanceof ApiError ? err.message : 'Failed to upload resume template');
    } finally {
      setUploadingTemplate(false);
    }
  }

  return (
    <section>
      <h1>Settings</h1>

      {loadError && <p role="alert">{loadError}</p>}

      <h2>OpenAI API key</h2>
      {status?.hasKey ? (
        <p>Current key on file: {status.maskedKey}</p>
      ) : (
        <p>No API key configured yet. Search and resume adaptation won't work until one is set.</p>
      )}

      <form onSubmit={handleSave}>
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

      <h2>Resume template</h2>
      {templateLoadError && <p role="alert">{templateLoadError}</p>}
      {templateStatus?.hasTemplate ? (
        <p>
          Current template: {templateStatus.originalName} ({templateStatus.format})
        </p>
      ) : (
        <p>No resume template configured yet. Resume adaptation won't work until one is set.</p>
      )}

      <form onSubmit={handleTemplateUpload}>
        <input
          type="file"
          accept=".docx,.pdf,.txt,.md"
          aria-label="Resume template file"
          onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={uploadingTemplate}>
          {uploadingTemplate ? 'Uploading…' : 'Upload'}
        </button>
        {templateError && <p role="alert">{templateError}</p>}
      </form>
    </section>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `client/`): `npx vitest run src/pages/SettingsPage.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 7: Commit**

```bash
git add client/src/api/http.ts client/src/api/resumeTemplate.ts client/src/pages/SettingsPage.tsx client/src/pages/SettingsPage.test.tsx
git commit -m "feat(client): add resume template upload to the Settings page"
```

---

### Task 7: Client — Adapt/download resume actions on the Postings page (Stories 4.2, 4.3 frontend)

**Files:**
- Modify: `client/src/api/postings.ts`
- Modify: `client/src/pages/PostingsPage.tsx`
- Modify: `client/src/pages/PostingsPage.test.tsx`

**Interfaces:**
- Consumes: `POST /api/postings/:id/adapt-resume`, `GET /api/postings/:id/adapted-resume` (Task 5).
- Produces: `adaptResumeForPosting(id: number) => Promise<Posting>` (in `api/postings.ts`) — used by `PostingsPage.tsx` this task.

- [ ] **Step 1: Write the failing tests**

Modify `client/src/pages/PostingsPage.test.tsx`, appending at the end of the `describe('PostingsPage', ...)` block (before its closing `});`):

```tsx

  it('generates an adapted resume and shows a download link', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] },
      { status: 200, body: { ...POSTING, adaptedResumePath: '/data/adapted-resumes/posting-10.docx' } }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    await user.click(screen.getByRole('button', { name: /adapt my resume/i }));

    expect(await screen.findByRole('link', { name: /download adapted resume/i })).toBeInTheDocument();
  });

  it('shows an error when adaptation fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] },
      { status: 400, body: { message: 'Configure your resume template in Settings before adapting your resume.' } }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    await user.click(screen.getByRole('button', { name: /adapt my resume/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Configure your resume template in Settings before adapting your resume.'
    );
  });

  it('confirms before replacing an existing adapted resume', async () => {
    const user = userEvent.setup();
    const postingWithResume = { ...POSTING, adaptedResumePath: '/data/adapted-resumes/posting-10.docx' };
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [postingWithResume] },
      { status: 200, body: postingWithResume }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    await user.click(screen.getByRole('button', { name: /re-adapt resume/i }));
    expect(screen.getByText(/replace existing adapted resume/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /yes, replace/i }));
    expect(await screen.findByRole('link', { name: /download adapted resume/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `client/`): `npx vitest run src/pages/PostingsPage.test.tsx`
Expected: FAIL — no "Adapt my resume" button exists yet

- [ ] **Step 3: Add `adaptResumeForPosting` to `client/src/api/postings.ts`**

Append to `client/src/api/postings.ts`:

```ts

export function adaptResumeForPosting(id: number): Promise<Posting> {
  return apiFetch<Posting>(`/api/postings/${id}/adapt-resume`, { method: 'POST' });
}
```

- [ ] **Step 4: Implement the `PostingsPage.tsx` adapt/download actions**

Modify `client/src/pages/PostingsPage.tsx`'s import line:

```tsx
import {
  fetchPostingsForTitle,
  markPostingViewed,
  searchPostingsForTitle,
  updatePostingStatus,
  adaptResumeForPosting
} from '../api/postings';
```

Add new state alongside the existing `expandedId`/`statusError` state:

```tsx
  const [adaptingId, setAdaptingId] = useState<number | null>(null);
  const [adaptConfirmId, setAdaptConfirmId] = useState<number | null>(null);
  const [adaptErrors, setAdaptErrors] = useState<Record<number, string>>({});
```

Add these two functions alongside `handleStatusChange`:

```tsx
  async function performAdapt(posting: Posting) {
    setAdaptingId(posting.id);
    setAdaptConfirmId(null);
    setAdaptErrors((prev) => ({ ...prev, [posting.id]: '' }));
    try {
      const updated = await adaptResumeForPosting(posting.id);
      setPostings((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      setAdaptErrors((prev) => ({
        ...prev,
        [posting.id]: error instanceof ApiError ? error.message : 'Failed to adapt resume'
      }));
    } finally {
      setAdaptingId(null);
    }
  }

  function handleAdaptClick(posting: Posting) {
    if (posting.adaptedResumePath) {
      setAdaptConfirmId(posting.id);
      return;
    }
    performAdapt(posting);
  }
```

Add a `<th>Resume</th>` header, right after the existing `<th>Actions</th>`:

```tsx
              <th>Actions</th>
              <th>Resume</th>
```

Add the new `<td>` cell, right after the existing Actions `<td>` (which contains the "Open" button):

```tsx
                  <td>
                    <button onClick={() => handleOpen(posting)}>Open</button>
                  </td>
                  <td>
                    {posting.adaptedResumePath && (
                      <div>
                        <a href={`/api/postings/${posting.id}/adapted-resume`} download>
                          Download adapted resume
                        </a>
                      </div>
                    )}
                    {adaptConfirmId === posting.id ? (
                      <span>
                        Replace existing adapted resume?{' '}
                        <button onClick={() => performAdapt(posting)}>Yes, replace</button>{' '}
                        <button onClick={() => setAdaptConfirmId(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => handleAdaptClick(posting)} disabled={adaptingId === posting.id}>
                        {adaptingId === posting.id
                          ? 'Adapting…'
                          : posting.adaptedResumePath
                            ? 'Re-adapt resume'
                            : 'Adapt my resume'}
                      </button>
                    )}
                    {adaptErrors[posting.id] && <p role="alert">{adaptErrors[posting.id]}</p>}
                  </td>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `client/`): `npx vitest run src/pages/PostingsPage.test.tsx`
Expected: PASS (10 tests total: 7 existing + 3 new)

- [ ] **Step 6: Commit**

```bash
git add client/src/api/postings.ts client/src/pages/PostingsPage.tsx client/src/pages/PostingsPage.test.tsx
git commit -m "feat(client): add Adapt my resume / Download adapted resume to the Postings page"
```

---

### Task 8: Full verification, module docs, and manual smoke check

**Files:**
- Modify: `server/CLAUDE.md`
- Modify: `client/CLAUDE.md`
- Modify: `docs/claude/DOMAIN_MODEL.md`
- Modify: `docs/claude/PATTERNS.md`

- [ ] **Step 1: Run the full test suites**

Run from the repo root (or `server/`/`client/` individually):
```bash
npm test
```
Expected: PASS — all server and client tests green, no regressions in Plan 1/2 tests.

- [ ] **Step 2: Update `server/CLAUDE.md`**

Add to the "Key decisions" list:

```markdown
- Resume adaptation never edits a template in place: `resumeExtractionService.js` pulls plain text out of the template (`.docx` via `mammoth`, `.pdf` via `pdf-parse`, `.txt`/`.md` read directly), OpenAI adapts that text, and `resumeGenerationService.js` writes a brand-new document in the same format (`.docx` via `docx`, `.pdf` via `pdfkit`). The regenerated file is plain/unstyled — the original template's visual layout is not preserved, only its file format.
- "Never invent or drop content" (Story 4.2) is enforced via a **self-reported** check inside the single adaptation call: the model reports `originalPositionCount` and `retainedPositionCount`; `resumeAdaptationService.adaptResumeForPosting` treats `retainedPositionCount < originalPositionCount` as a generation failure (`UpstreamError`, retryable). This is a v1 heuristic, not a rigorous guarantee — revisit if it proves unreliable in practice.
- The resume template is one active file, tracked as three key/value rows in `settings` (`resumeTemplatePath`/`resumeTemplateOriginalName`/`resumeTemplateFormat`), mirroring the OpenAI key pattern. The file itself always lives at `RESUME_TEMPLATE_DIR/template.<format>`; uploading a new one deletes the old one. Adapted resumes are written to `ADAPTED_RESUMES_DIR/posting-<id>.<format>`, one per posting, overwritten on regeneration.
- File uploads (`POST /api/settings/resume-template`) use `multer` with in-memory storage — the route validates format/size in `resumeTemplateService.js`, not in Multer's own filter, so error messages stay consistent with the rest of the app's `ValidationError` handling.
```

Add to the "Playbook" section, after step 4:

```markdown

## Playbook: disk-backed service tests

Services that write real files (`resumeTemplateService.js`, `resumeAdaptationService.js`, `resumeGenerationService.js`) still use `createDb(':memory:')` for the DB, but write small real files under `RESUME_TEMPLATE_DIR`/`ADAPTED_RESUMES_DIR` (from `config.js`). Their tests clean up with `fs.rmSync(dir, { recursive: true, force: true })` in `afterEach` — there is no in-memory filesystem equivalent to `:memory:` for this app's scale, so tests share the real (small) local `server/data/` tree and are responsible for tidying up after themselves.
```

- [ ] **Step 3: Update `client/CLAUDE.md`**

Add to the "Key decisions" list:

```markdown
- File uploads (resume template) use a dedicated `apiUpload()` in `src/api/http.ts` instead of `apiFetch()` — it sends a `FormData` body with no explicit `Content-Type` header, letting the browser set the multipart boundary itself. `apiFetch()` always forces `Content-Type: application/json`, which would corrupt a multipart body.
- "Adapt my resume" on `PostingsPage` follows the same inline-confirmation pattern as delete/status-change: clicking it when a posting already has an adapted resume shows an inline "Replace existing adapted resume?" prompt (not `window.confirm`) instead of adapting immediately.
```

- [ ] **Step 4: Update `docs/claude/DOMAIN_MODEL.md`**

Add after the `Posting` section:

```markdown

## ResumeTemplate

Not a dedicated table — stored as three key/value rows in `settings`, the same pattern as the OpenAI key. Exactly one active template at a time (Story 4.1).

| Property | Type | Settings key | Notes |
|---|---|---|---|
| path | string | `resumeTemplatePath` | Always `RESUME_TEMPLATE_DIR/template.<format>`; overwritten (old file deleted) on re-upload |
| originalName | string | `resumeTemplateOriginalName` | The filename as uploaded, shown back to the user |
| format | `'docx' \| 'pdf' \| 'txt' \| 'md'` | `resumeTemplateFormat` | Drives extraction/generation and the adapted resume's output extension |
```

- [ ] **Step 5: Update `docs/claude/PATTERNS.md`**

Replace the full contents of the file:

```markdown
# Patterns

## Disk-backed local storage, key/value settings

Anything that needs "one active configured thing" (the OpenAI key, the resume template) is stored as key/value rows in the `settings` table, not a dedicated table — see `settingsService.js` and `resumeTemplateService.js`. Any actual file content (the template, an adapted resume) lives on disk under a directory derived from `config.js`'s `DATA_DIR`, with the settings row/DB column holding just the path.

## File uploads

`multer` with `storage: memoryStorage()` handles multipart uploads at the route layer; the resulting `{ originalname, size, buffer }` object is handed to a plain service function (`resumeTemplateService.saveResumeTemplate`) that does all format/size validation and disk writes, so validation logic stays testable without an HTTP layer. On the client, use `apiUpload()` (not `apiFetch()`) for any `FormData` body — see `client/CLAUDE.md`.

## Disk-backed service tests

Services that write real files use `createDb(':memory:')` for the DB (as always) but write small real files under the app's real `server/data/` subdirectories (no in-memory filesystem is used) — see `server/CLAUDE.md`'s "disk-backed service tests" playbook.

## Known Issues / Tech Debt

- Adapted resumes and regenerated resume-template documents (`.docx`/`.pdf`) are plain/unstyled — the original template's visual layout is never preserved, only its file format (see `server/CLAUDE.md`'s resume-adaptation decisions).
- The "never invent/drop content" accuracy constraint on resume adaptation is enforced via a self-reported count from the same OpenAI call, not independent verification — a known v1 limitation, not a bug.
```

- [ ] **Step 6: Manual smoke check**

Run (from the repo root): `npm run dev`

With a real OpenAI API key configured in Settings:
1. Upload a `.txt` resume template in Settings; confirm the filename/format display updates.
2. Run a search on a position title, then click "Adapt my resume" on one of its postings.
3. Confirm a success response updates the row to show "Download adapted resume", and that clicking it downloads a real file containing tailored text.
4. Click "Re-adapt resume" on the same posting; confirm the inline "Replace existing adapted resume?" prompt appears before it re-generates.
5. Note any mismatch between the real OpenAI Chat Completions response shape and `parseAdaptationResponse`'s expectations (PRD Open Question #2) and fix `openaiClient.js` accordingly if needed.

- [ ] **Step 7: Commit the docs**

```bash
git add server/CLAUDE.md client/CLAUDE.md docs/claude/DOMAIN_MODEL.md docs/claude/PATTERNS.md
git commit -m "docs: document resume adaptation architecture and tradeoffs"
```

---

## Self-Review Notes

- **Spec coverage:** Story 4.1 (Task 1 service + Task 5 routes + Task 6 UI), Story 4.2 (Task 4 orchestration + Task 5 routes + Task 7 UI, including the "no invented/dropped content" and "overwrite confirmation" ACs), Story 4.3 (Task 5's download route + Task 7's download link, plus Task 5's "no adapted resume yet → 404" case backing the AC's implicit "no retrieval option" state) are all covered. The PRD's Key Risk 1 (format-handling complexity) and Open Question 1 (concrete per-format approach) are resolved by the extract-then-regenerate design documented in the plan header and `server/CLAUDE.md`.
- **Placeholder scan:** no TBD/TODO markers; every step has runnable code, not descriptions of code.
- **Type consistency:** `Posting.adaptedResumePath` (existing, from Plan 1/2) is reused as-is — no new posting fields. `ResumeTemplateStatus` (`hasTemplate`/`originalName`/`format`) is defined once in Task 6's `resumeTemplate.ts` and used identically in `SettingsPage.tsx`. `adaptResumeForPosting`'s signature (`db, postingId, { adaptResume } = {}`) matches `searchPostingsForTitle`'s existing `(db, positionTitleId, { fetchPostings } = {})` shape for consistency. Format strings (`'docx' | 'pdf' | 'txt' | 'md'`) are used identically across `resumeTemplateService.js`, `resumeExtractionService.js`, and `resumeGenerationService.js`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-25-job-search-assistant-resume-adaptation.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
