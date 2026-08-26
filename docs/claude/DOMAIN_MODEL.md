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
| url | string | `postings.url` | The direct application URL (the posting's own page, not a search-results/listing page) — unique, and the dedup key across repeated searches |
| aggregatorName | string \| null | `postings.aggregator_name` | Name of the job board/aggregator the posting was found on (e.g. "LinkedIn"), or "Company Career Page" if found directly on the employer's site |
| aggregatorUrl | string \| null | `postings.aggregator_url` | URL of the listing as it appears on that aggregator; may equal `url` |
| location | string \| null | `postings.location` | |
| publishedDate | string \| null | `postings.published_date` | As reported by the search; unparseable/missing values are not treated as stale |
| foundAt | string (ISO datetime) | `postings.found_at` | Set once, at insert time |
| viewed | boolean | `postings.viewed` (`INTEGER` 0/1) | Set `true` only via "Open"; never implies a status change |
| status | `'New' \| 'Applied' \| 'In Progress' \| 'Rejected'` | `postings.status` | DB `CHECK` constraint; `PUT /api/postings/:id/status` rejects `'Applied'` — that value is only ever written by the applied-CV upload (see Key decisions) |
| adaptedResumePath | string \| null | `postings.adapted_resume_path` | The AI-adapted draft (Plan 3), at `ADAPTED_RESUMES_DIR/posting-<id>.<format>` |
| appliedCvPath | string \| null | `postings.applied_cv_path` | The CV actually submitted (Plan 4), at `APPLIED_CVS_DIR/posting-<id>.<ext>`; set together with `status = 'Applied'`, and kept if the status later moves off Applied |
| appliedCvOriginalName | string \| null | `postings.applied_cv_original_name` | The filename as uploaded — used as the download filename and shown in the replace warning |

## ResumeTemplate

Not persisted at all — it is just a file the user keeps at the repo root, resolved fresh on every use by `resumeTemplateService.getResumeTemplateInfo()` (returns `null` when absent).

| Property | Type | Source | Notes |
|---|---|---|---|
| path | string | `Resume.<format>` at the repo root | First match wins in `RESUME_TEMPLATE_FORMATS` order (`docx`, `pdf`, `txt`, `md`), so `.docx` beats the others |
| format | `'docx' \| 'pdf' \| 'txt' \| 'md'` | the file's extension | Drives extraction/generation and the adapted resume's output extension |
