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

## ResumeTemplate

Not a dedicated table — stored as three key/value rows in `settings`, the same pattern as the OpenAI key. Exactly one active template at a time (Story 4.1).

| Property | Type | Settings key | Notes |
|---|---|---|---|
| path | string | `resumeTemplatePath` | Always `RESUME_TEMPLATE_DIR/template.<format>`; overwritten (old file deleted) on re-upload |
| originalName | string | `resumeTemplateOriginalName` | The filename as uploaded, shown back to the user |
| format | `'docx' \| 'pdf' \| 'txt' \| 'md'` | `resumeTemplateFormat` | Drives extraction/generation and the adapted resume's output extension |
