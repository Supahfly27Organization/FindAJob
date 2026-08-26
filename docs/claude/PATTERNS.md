# Patterns

## Configuration lives in files, not in the app

There is no Settings page and no `settings` table. The two things that need configuring are edited on disk and read at startup: the OpenAI key from `OPENAI_API_KEY` in the repo-root `.env` (`config.js` loads it via dotenv and exposes `getOpenAiKey()`), and the resume template from `Resume.<docx|pdf|txt|md>` at the repo root (`resumeTemplateService.getResumeTemplateInfo()`). Neither has a DB fallback — when one is missing the app says which file to fix. Content the app itself produces (adapted resumes, applied CVs) still lives on disk under `config.js`'s `DATA_DIR`, with the DB column holding just the path.

## File uploads

`multer` with `storage: memoryStorage()` handles multipart uploads at the route layer; the resulting `{ originalname, size, buffer }` object is handed to a plain service function (`appliedCvService.saveAppliedCv`) that does all format/size validation and disk writes, so validation logic stays testable without an HTTP layer. On the client, use `apiUpload()` (not `apiFetch()`) for any `FormData` body — see `client/CLAUDE.md`.

## Disk-backed service tests

Services that write real files use `createDb(':memory:')` for the DB (as always) but write small real files under the app's real `server/data/` subdirectories (no in-memory filesystem is used) — see `server/CLAUDE.md`'s "disk-backed service tests" playbook.

## Known Issues / Tech Debt

- Adapted resumes and regenerated resume-template documents (`.docx`/`.pdf`) are plain/unstyled — the original template's visual layout is never preserved, only its file format (see `server/CLAUDE.md`'s resume-adaptation decisions).
- The "never invent/drop content" accuracy constraint on resume adaptation is enforced via a self-reported count from the same OpenAI call, and provides no independent assurance — the same model call that might drop or invent content is the one self-reporting whether it did, so a model failure is unlikely to self-report as one. Treat this as a v1 placeholder, not a real safety check.
