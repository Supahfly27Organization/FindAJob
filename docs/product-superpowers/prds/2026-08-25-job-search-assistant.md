# Job Search Assistant — Product Brief

**Date:** 2026-08-25 (revised 2026-08-25 after user feedback)
**Format:** SVPG Product Brief
**Discovery source:** `docs/product-superpowers/discovery/2026-08-25-job-search-assistant.md`
**Status:** Pending Approval

**Revision note:** After initial approval, feedback refined the resume-adaptation constraints, results table content, added a distinct "upload the CV actually used" step on Applied, and changed the frontend to React + TypeScript. See inline changes below.

## Problem

David's wife is job hunting in Israel. Today she manually re-checks job boards for openings matching titles she's interested in, and manually rewrites her resume for each application. This is repetitive, easy to fall behind on, and results in generic (less competitive) resumes when tailoring gets skipped due to time pressure.

## Current State

- She browses job boards/sites herself, repeating the same searches over time to catch new postings.
- She has no single place tracking which postings she's already seen or applied to — that lives in memory or an ad hoc spreadsheet, if at all.
- She manually edits her resume in Word (or similar) per application, which takes time and is often skipped or rushed.
- No tool currently combines "search for specific titles in Israel" + "tailor resume per posting" + "track status" for her.

## Proposed Solution

A local app, run on her own computer (React + TypeScript frontend talking to a Node.js API, served at `http://localhost:<port>`, no login), with the following core flows:

**1. Manage position titles (CRUD)**
A page to add, edit, and delete the job titles she's interested in (e.g. "Product Manager", "QA Engineer"). This list drives what the search looks for.

**2. Search for postings**
A manual "Search now" action (per title, or for all titles) triggers an OpenAI-powered web search that looks for open positions in Israel matching each title (including reasonably equivalent/synonymous titles). Per title, per run:
- Capped at ~20 results.
- Only postings published within the last 45 days.
- Results are deduplicated against previously found postings by posting URL — if already seen, the existing entry (and its status) is kept as-is rather than duplicated.

New postings are saved to a local database with: position ID, title matched, the posting's own job title, description, company, posting URL, location, published date, found date, `viewed` flag (`false` by default), and status (`New` by default).

**3. View & open postings**
A results page lists found postings per title in a table with, per row: **position ID, title, description, published date, viewed (yes/no), status**, plus company and location for context. An "Open" button opens the posting's original application page in a new browser tab and sets `viewed` to `true` — opening does **not** change `status`.

**4. Adapt resume for a posting (AI draft)**
An "Adapt my resume" button on a posting takes her resume template (kept on disk in one of: `.docx`, PDF, or plain text/Markdown) and, via OpenAI, generates a version tailored to that specific posting's content — same file format as the template, so it stays visually consistent with what she's used to. This is a **draft/suggestion**, distinct from the CV she actually ends up submitting (see flow 6).

Constraints on the adaptation, to keep it trustworthy:
- Must **not invent** any experience, skill, or qualification not already present in her template.
- Must **not remove** any previously listed position/role from her work history — content may be reframed, reordered, or emphasized differently per posting, but her full position history stays intact.

**5. Save & retrieve adapted resumes**
The adapted (draft) resume is saved to disk associated with that specific position (e.g. under a per-position folder/file naming scheme) and can be retrieved/re-opened later from that posting's entry — not regenerated from scratch each time it's viewed.

**6. Mark applied — upload & track the CV actually used**
Changing a posting's status to `Applied` opens a modal requiring her to upload the CV file she actually used for that application (which may be the AI-adapted draft as-is, or her own further-edited version). This uploaded file — the **applied CV** — is stored per posting, separately from the AI-adapted draft, and a download link for it is shown on the posting once set. Status can otherwise move between `New`, `Applied`, `In Progress`, and `Rejected`.

### Data model (indicative — not final, refined during implementation)
- **PositionTitle**: id, title, createdAt
- **Posting**: id, positionTitleId, postingTitle, description, company, url, location, publishedDate, foundAt, viewed (boolean), status (`New` \| `Applied` \| `In Progress` \| `Rejected`), adaptedResumePath (nullable — AI draft), appliedCvPath (nullable — actual file used, set via the Applied upload modal)
- Resume template: a configured file path on disk (one active template)

### Tech stack
- **Frontend:** React + TypeScript SPA (build step via a bundler, e.g. Vite), calling the backend over a REST API
- **Backend:** Node.js API server (per existing CLAUDE.md)
- Local file-based database (e.g. SQLite) for positions/postings/status
- OpenAI API for (a) web search of postings and (b) resume text adaptation
- Local filesystem for storing the resume template, generated AI-adapted drafts, and uploaded applied CVs

## Success Criteria

No existing baseline (net-new personal tool). Success for v1 is behavioral, not a numeric target:

- **Primary:** She completes at least one full cycle — add a title → run a search → open a real posting from the app → generate an adapted resume → mark it applied (uploading the CV she used) — without falling back to fully manual search/tailoring for that application.
- **Secondary (guardrails):**
  - Search results returned are real, relevant postings (correct title match, Israel-based, within 45 days) — not hallucinated or stale links.
  - Adapted resumes contain no fabricated experience/qualifications and never drop a position from her work history — only reframed/reordered/re-emphasized real content from her template.
  - OpenAI API cost per search run stays predictable (bounded by the ~20-results-per-title cap).
- **Counter-metric to watch:** if search results are frequently irrelevant or broken links, she'll stop trusting/using the tool — this would be a signal to revisit the search approach, not to just increase result volume.

## Key Risks

1. **Resume format handling complexity** — programmatically "editing" a `.docx`, PDF, or plain-text template while preserving visual layout is nontrivial, especially for PDF. *Mitigation:* decide concrete per-format technical approach during implementation (e.g. `.docx`/text may support true in-place content edits; PDF may require regenerating a new document that approximates the original template rather than true in-place editing).
2. **Search relevance/quality** — depends entirely on the OpenAI web-search capability returning real, current, correctly-matched Israeli job postings. *Mitigation:* validate manually with a handful of real searches early; treat "low relevance" as a red flag to reassess approach, not just a tuning problem.
3. **Unvalidated workflow with actual end user** — the wife hasn't confirmed the app shape/flow directly yet. *Mitigation:* do a check-in with her once a first working version exists, before investing further polish.
4. **OpenAI cost variability** — usage-based cost for both search and resume adaptation. *Mitigation:* result cap (~20/title/run) and manual-only search trigger (no background/scheduled runs) bound worst-case spend for v1.

## Scope

**In scope (v1):**
- Position title CRUD page
- Manual, on-demand search (per title or all titles) via OpenAI web search, capped ~20 results/title, postings ≤45 days old
- Dedup of previously-seen postings by URL, preserving existing status
- Results table per title showing position ID, title, description, published date, viewed (yes/no), status, company, and location; an "Open" action that opens the original posting in a new tab and sets `viewed` to `true` (independent of `status`)
- "Adapt my resume" action generating a posting-specific tailored resume from her template, in the same file format as the template, that never invents content and never removes a position from her history
- Persisting the AI-adapted resume draft to disk per position, retrievable later
- Marking a posting `Applied` opens a modal requiring upload of the CV file actually used; that file is stored per posting and downloadable via a link on the posting, separate from the AI-adapted draft
- `In Progress`/`Rejected` status updates
- Local-only app (React + TypeScript frontend, Node.js backend), no authentication, SQLite (or equivalent local file DB)

**Out of scope (v1 — explicitly deferred):**
- Scheduled/automatic background searches
- Multiple resume templates or resume version history/management beyond one active template
- Cover letter generation
- Application analytics/dashboards beyond the basic status list
- Multi-user support or authentication
- Mobile app / responsive mobile-first design
- Direct scraping/integration with specific job boards (v1 relies on OpenAI web search only)
- Email/push notifications for new postings
- In-app editing of the adapted resume (she edits externally in Word/PDF viewer if she wants manual tweaks after generation)
- Interview scheduling, salary negotiation, or other post-application workflow beyond status tracking

## Assumptions, Constraints, Dependencies

**Assumptions:**
- She maintains one canonical resume template file that she keeps reasonably up to date.
- David (technical) will handle initial setup (installing Node.js, running the app, configuring the OpenAI API key) — she is not expected to do technical setup herself.
- OpenAI's web search capability can reliably surface real, working, reasonably fresh Israeli job posting URLs for a given title.

**Constraints:**
- Requires an OpenAI API key/account (not yet set up — see discovery open questions); usage-based cost applies per search run and per resume adaptation.
- Must run entirely locally on her computer — no cloud hosting/deployment for v1.
- No authentication — the app must not be exposed beyond localhost.
- Result volume and posting age are capped (~20/title/run, ≤45 days old) specifically to bound OpenAI cost.

**Dependencies:**
- OpenAI API access (web search + text generation).
- Node.js runtime installed on her machine.
- A library/approach capable of programmatically producing tailored output in `.docx`, PDF, and plain-text/Markdown formats.

## Open Questions

Carried over from discovery, to resolve during implementation:

1. Concrete technical approach for adapting each resume format — especially whether PDF templates get true in-place editing or are regenerated from extracted content (with likely some layout risk).
2. Which specific OpenAI capability/model to use for web search (e.g. a model with a web-search tool) and PDF/docx/text generation, and a rough expected cost per search/adaptation so David can set expectations on ongoing spend.
3. The real list of position titles she cares about, and how "location within Israel" should be specified (whole country vs. specific city/region per title) — needed as real input once the app exists.
4. Whether "equivalent/synonymous titles" matching should be handled by the search prompt itself (let the OpenAI search reason about equivalents) or via an explicit synonym list — leaning toward the former for v1 simplicity, to confirm during implementation.
