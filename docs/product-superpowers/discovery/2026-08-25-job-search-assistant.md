# Job Search Assistant for Wife — Product Discovery

**Date:** 2026-08-25
**Status:** Pending Approval

## Problem Statement

David's wife is job hunting in Israel and currently has to manually re-check job boards for openings matching roles she's interested in, and manually rewrite her resume for each application. This is repetitive, time-consuming, and creates risk of missing relevant postings or submitting a generic (less competitive) resume.

## Desired Outcome

Reduce the time and manual effort she spends per job application cycle — from (search → find postings → tailor resume → apply) done entirely by hand, to a workflow where discovery and resume tailoring are assisted, and she only does the final review + submit + status tracking.

There is no existing baseline metric (this is a net-new personal tool, not an existing product), so the outcome is qualitative for v1: she should be able to go from "I'm interested in Title X" to "I have a tailored resume ready to submit for a specific matching posting" in a few clicks, without manually searching job boards or manually rewriting her resume each time.

## Jobs-to-be-Done

**Primary JTBD:**
> When I'm actively job hunting in Israel, I want to be notified of new postings matching titles I care about without manually re-checking job boards, so I can spend my time applying rather than searching.

**Secondary JTBD:**
> When I find a posting worth applying to, I want a resume tailored to that specific posting without rewriting it myself, so I can apply faster and more competitively.

**Forces of Progress:**
| Force | Notes |
|---|---|
| Push | Manually checking multiple job boards repeatedly is tedious; manually tailoring a resume per posting is slow and easy to skip (leading to generic, less effective applications) |
| Pull | An assistant that surfaces fresh matching postings and pre-drafts a tailored resume removes the two most repetitive steps in the job hunt |
| Anxiety | AI-adapted resume content must stay accurate (no fabricated experience) and require her review before use; API costs need to stay bounded and predictable |
| Habit | She may still browse job boards directly out of habit even once the tool exists — the tool needs to be trustworthy enough (fresh, relevant results) to replace that habit |

## Research Findings

Requirements were gathered directly from David (building this for his wife) rather than a direct interview with the end user, since this is a personal tool built for a family member rather than a market-facing product. Decisions below were made collaboratively via structured clarifying questions covering search scope, resume handling, app shape, tracking, and cost control.

**Note / open risk:** No direct validation with the actual end user (the wife) has happened yet on the workflow shape itself (e.g., is a local web app the most comfortable format for her day-to-day; does she want to review results in a list before opening them). Recommend a quick check-in with her once a first working version exists.

## Opportunity Assessment

Adapted for a single-user personal tool rather than a market product:

1. **Exactly what problem will this solve?** Eliminates manual job-board searching and manual resume tailoring per application.
2. **For whom do we solve that problem?** One user: David's wife, job hunting for roles in Israel.
3. **How big is the opportunity?** Personal — success is measured in hours saved per week during an active job search and in resume quality/relevance per application, not market size.
4. **How will we measure success?** Qualitative for v1: she actively uses it (adds titles, reviews search results, generates adapted resumes, tracks status) instead of reverting to fully manual search/tailoring.
5. **What alternatives are out there now?** Manually browsing AllJobs/Drushim/LinkedIn/company sites; manually editing her resume in Word per application; no tracking beyond memory/spreadsheet.
6. **Why are we best suited to pursue this?** Fully custom to her exact workflow and titles of interest; no market tool combines "search Israeli postings for specific titles" + "auto-tailor resume" + "simple status tracking" in one local, low-friction tool tailored to her.
7. **Why now?** She is actively job hunting now.
8. **How will we get this to market?** N/A — personal tool, run locally by David for his wife. "Delivery" = a working local web app she can open in her browser.
9. **What factors are critical to success?** (a) Search results are actually relevant (right titles, right location, recent postings) (b) resume adaptations are accurate and not fabricated (c) OpenAI API costs stay bounded and predictable (d) the app is simple enough for a non-technical daily user.
10. **Given the above, is it worth pursuing?** Yes — pursue.

## Scope Decisions (from clarifying questions)

- **Search source:** Broad OpenAI web search (not scraping specific job boards directly) covering postings relevant to Israel.
- **Match criteria:** Position title (plus reasonable equivalent/synonymous titles) + location within Israel. Postings must be published within the last 45 days. No seniority filter or company blocklist for v1.
- **Result volume:** Capped at ~20 results per title per search run, to keep OpenAI API cost predictable.
- **Duplicate handling:** Postings already seen in a prior search (matched by posting URL) are skipped/merged, not re-added — existing status is preserved.
- **Resume template formats:** Must support all three common formats as the original template: Word (.docx), PDF, and plain text/Markdown.
- **Adapted resume output:** Same format as the original template, AI-edited to match the specific posting; saved to disk per position and retrievable later.
- **App shape:** Local Node.js web app — she opens it in a browser tab (e.g. `http://localhost:PORT`); no separate desktop install.
- **Auth:** None — single user, local machine only.
- **Search cadence:** Manual only for v1 (a "Search now" action) — no scheduled/background searching, to avoid surprise API costs.
- **Status tracking:** New → Viewed (auto-set when she opens the posting's application page from the app) → Applied → Rejected → Interview. All settable/markable from the position's page.
- **OpenAI access:** Not yet set up — needs an API key/account created before the app is usable; usage-based cost applies per search and per resume adaptation.

## Validation Results

No formal external validation (landing page test, smoke test, etc.) was performed — appropriate given this is a personal tool for one known user with a clearly understood, already-confirmed need, not a market bet requiring demand validation. Requirements were validated through direct structured questioning with the requester (David) instead.

## Recommendation

**Pursue.** The problem is clear, the user is known and available, the scope has been narrowed to a buildable v1 (manual search, capped results, no auth, local app), and the main technical risks (multi-format resume handling, search relevance, cost control) are identifiable up front rather than open-ended.

## Open Questions

1. Multi-format resume editing (.docx / PDF / plain text) has real technical complexity, especially preserving PDF layout when "editing" — this needs a concrete technical approach decided during PRD/implementation (e.g., possibly normalizing to one working format internally while preserving the original's visual structure on output).
2. No direct validation with the actual end user (the wife) on the day-to-day workflow shape yet — worth a quick check-in after a first working version.
3. Expected OpenAI cost per search/adaptation run is not yet estimated — should be estimated during PRD so David can set expectations on ongoing cost.
4. Exact set of position titles she cares about, and specific Israel location(s)/regions to filter by, are not yet enumerated — needed as real input data once the app exists.
