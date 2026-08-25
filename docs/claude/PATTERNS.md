# Patterns

## Disk-backed local storage, key/value settings

Anything that needs "one active configured thing" (the OpenAI key, the resume template) is stored as key/value rows in the `settings` table, not a dedicated table — see `settingsService.js` and `resumeTemplateService.js`. Any actual file content (the template, an adapted resume) lives on disk under a directory derived from `config.js`'s `DATA_DIR`, with the settings row/DB column holding just the path.

## File uploads

`multer` with `storage: memoryStorage()` handles multipart uploads at the route layer; the resulting `{ originalname, size, buffer }` object is handed to a plain service function (`resumeTemplateService.saveResumeTemplate`) that does all format/size validation and disk writes, so validation logic stays testable without an HTTP layer. On the client, use `apiUpload()` (not `apiFetch()`) for any `FormData` body — see `client/CLAUDE.md`.

## Disk-backed service tests

Services that write real files use `createDb(':memory:')` for the DB (as always) but write small real files under the app's real `server/data/` subdirectories (no in-memory filesystem is used) — see `server/CLAUDE.md`'s "disk-backed service tests" playbook.

## Known Issues / Tech Debt

- Adapted resumes and regenerated resume-template documents (`.docx`/`.pdf`) are plain/unstyled — the original template's visual layout is never preserved, only its file format (see `server/CLAUDE.md`'s resume-adaptation decisions).
- The "never invent/drop content" accuracy constraint on resume adaptation is enforced via a self-reported count from the same OpenAI call, and provides no independent assurance — the same model call that might drop or invent content is the one self-reporting whether it did, so a model failure is unlikely to self-report as one. Treat this as a v1 placeholder, not a real safety check.
