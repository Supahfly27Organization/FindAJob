# Job Search Assistant — User Stories

**Date:** 2026-08-25 (revised 2026-08-25 after user feedback)
**Based on PRD:** `docs/product-superpowers/prds/2026-08-25-job-search-assistant.md`
**Status:** Draft — Pending Approval

**Revision note:** Status enum simplified to `New / Applied / In Progress / Rejected`; `Viewed` is now a separate yes/no flag, not a status. Story 2.3's table gained `description`; Epic 3 gained a CV-upload-on-Applied flow (Stories 3.3, 3.4); Story 4.2 strengthened to explicitly forbid removing positions. Frontend is React + TypeScript.

**Persona used throughout:** *Noa, a job seeker in Israel actively applying to roles*, using the app that David set up and maintains for her.

## Shared Definition of Ready

Applies to every story below unless a story lists an addition:
- [ ] Story follows the standard format and meets INVEST criteria
- [ ] Acceptance criteria written in Gherkin, including edge/error cases
- [ ] No open dependency blocking the story (or dependency explicitly accepted)
- [ ] Story is small enough to complete in a few days

---

## Epic 1: Manage Position Titles

**Outcome:** Noa can maintain the list of job titles that drive what the search looks for.

### Story 1.1: Add a position title

**As a** job seeker using the app
**I want to** add a job title I'm interested in
**So that** future searches look for postings matching it

**Priority:** Must Have · **Estimate:** S
**Dependencies:** None

**Acceptance Criteria:**
```gherkin
Given I am on the Position Titles page
When I enter "Product Manager" and click "Add"
Then "Product Manager" appears in my list of titles
And it has no postings associated with it yet

Given I am on the Position Titles page
When I click "Add" with the title field empty
Then I see the error "Title is required"
And no title is added

Given I already have "Product Manager" in my list
When I add "Product Manager" again
Then I see the error "This title is already in your list"
And no duplicate is added
```

**Edge Cases:**
- Leading/trailing whitespace should be trimmed before duplicate-checking and saving.
- Very long titles (e.g. 200+ characters) should be rejected with a clear error rather than silently truncated.

---

### Story 1.2: Edit a position title

**As a** job seeker using the app
**I want to** correct or refine a title I've already added
**So that** future searches use the right wording without losing postings already found for it

**Priority:** Must Have · **Estimate:** S
**Dependencies:** Story 1.1

**Acceptance Criteria:**
```gherkin
Given I have "Product Manger" (typo) in my list
When I edit it to "Product Manager" and save
Then the list shows "Product Manager"
And postings previously found for this title remain linked to it

Given I edit a title to a value that already exists elsewhere in my list
When I save
Then I see the error "This title is already in your list"
And the edit is not saved
```

**Edge Cases:**
- Editing to an empty value is rejected the same way as add (Story 1.1).

---

### Story 1.3: Delete a position title

**As a** job seeker using the app
**I want to** remove a title I'm no longer interested in
**So that** future searches don't waste time/cost on it

**Priority:** Must Have · **Estimate:** S
**Dependencies:** Story 1.1

**Acceptance Criteria:**
```gherkin
Given I have "QA Engineer" in my list with 5 postings found for it
When I click "Delete" on "QA Engineer" and confirm
Then "QA Engineer" is removed from my list
And I am told what will happen to its previously found postings before I confirm

Given I click "Delete" on a title
When I am shown the confirmation prompt
Then I can cancel without deleting anything
```

**Edge Cases:**
- Deleting a title with existing postings/adapted resumes must not silently delete adapted resume files from disk — the confirmation must state whether postings/resumes are kept or removed (decision: **postings and their adapted resumes are kept, just unlinked from an active title**, so nothing on disk is lost).

---

### Story 1.4: View my list of position titles

**As a** job seeker using the app
**I want to** see all the titles I've added, with how many postings each has found
**So that** I know what's being searched for and where to focus

**Priority:** Must Have · **Estimate:** S
**Dependencies:** Story 1.1

**Acceptance Criteria:**
```gherkin
Given I have added 3 titles, one with 4 postings found and two with none yet
When I open the Position Titles page
Then I see all 3 titles listed
And each shows a count of postings found for it

Given I have not added any titles yet
When I open the Position Titles page
Then I see an empty state explaining I should add a title to start searching
```

---

## Epic 2: Search for Matching Postings

**Outcome:** Noa finds fresh, relevant Israeli job postings for her titles without manually checking job boards.

### Story 2.1: Run a search for one position title

**As a** job seeker using the app
**I want to** trigger a search for a specific title
**So that** I get an up-to-date list of matching postings in Israel without browsing job boards myself

**Priority:** Must Have · **Estimate:** L
**Dependencies:** Story 1.1, Story 5.1 (OpenAI key configured)

**Acceptance Criteria:**
```gherkin
Given I have the title "Product Manager" in my list and an OpenAI API key is configured
When I click "Search now" on that title
Then the app searches for open positions in Israel matching "Product Manager" or reasonably equivalent titles
And returns at most 20 results, each published within the last 45 days
And each new result is saved with its own posting title, description, company, posting URL, location, published date, viewed = false, and status "New"

Given a search for "Product Manager" previously found a posting at a given URL
When I run the search again and that same URL is found
Then the existing posting entry is kept unchanged (status is not reset)
And no duplicate entry is created

Given I click "Search now"
When the search is in progress
Then I see a clear loading/in-progress indicator
And I cannot trigger another search for the same title until it completes

Given the OpenAI API key is not configured
When I click "Search now"
Then I see an error directing me to configure the API key
And no search is attempted

Given the search call fails (network error, API error, or timeout)
When the failure occurs
Then I see a clear error message
And I can retry the search
And no partial/malformed postings are saved
```

**Edge Cases:**
- Zero results found: show an explicit "No matching postings found in the last 45 days" state, not a blank list.
- OpenAI returns a posting missing required fields (e.g. no URL): that result is discarded, not saved with blank data.

---

### Story 2.2: Run a search across all position titles at once

**As a** job seeker using the app
**I want to** trigger a search for every title in my list in one action
**So that** I don't have to click "Search now" separately for each title every time

**Priority:** Should Have · **Estimate:** M
**Dependencies:** Story 2.1

**Acceptance Criteria:**
```gherkin
Given I have 3 titles in my list
When I click "Search all"
Then each title is searched using the same rules as Story 2.1 (cap, freshness, dedup)
And I see per-title progress as each completes

Given "Search all" is running and one title's search fails
When that failure happens
Then the other titles' searches still complete
And I see which title(s) failed and can retry just those
```

**Edge Cases:**
- If I have zero titles, "Search all" is disabled with a hint to add a title first.

---

### Story 2.3: View search results for a title

**As a** job seeker using the app
**I want to** see all postings found for a title, in a table with their key details and current status
**So that** I can decide which ones to open, apply to, or ignore

**Priority:** Must Have · **Estimate:** M
**Dependencies:** Story 2.1

**Acceptance Criteria:**
```gherkin
Given "Product Manager" has 12 postings found, at various statuses
When I open its results page
Then I see a table with one row per posting showing: position ID, title, description, published date, viewed (yes/no), status, company, and location
And I can distinguish New / Applied / In Progress / Rejected at a glance, independently of whether it's been viewed

Given a title has postings but I filter to a specific status (e.g. "Applied")
When I apply that filter
Then only postings with that status are shown

Given a title has no postings found yet
When I open its results page
Then I see an empty state prompting me to run a search
```

**Edge Cases:**
- Long descriptions are truncated in the table with a way to see the full text (e.g. expand row or tooltip) rather than breaking the table layout.

---

## Epic 3: Track Posting Status

**Outcome:** Noa always knows where she stands with each posting — including exactly which CV she used to apply — without tracking it in her head or a separate spreadsheet.

### Story 3.1: Open a posting and have it auto-marked as viewed

**As a** job seeker using the app
**I want to** open a posting's original application page from the app
**So that** I can read the full listing and apply directly on the source site

**Priority:** Must Have · **Estimate:** S
**Dependencies:** Story 2.3

**Acceptance Criteria:**
```gherkin
Given a posting has viewed = false
When I click "Open" on it
Then its original application URL opens in a new browser tab
And its "viewed" flag becomes true immediately, without needing a page refresh
And its status is unchanged by this action

Given a posting already has viewed = true
When I click "Open" on it again
Then the URL opens in a new tab as normal
And viewed remains true (no change)
```

**Edge Cases:**
- If the posting URL is malformed or unreachable, opening it should not crash the app or block the `viewed` flag update — the browser tab handles the failed navigation on its own.

---

### Story 3.2: Update a posting's status manually

**As a** job seeker using the app
**I want to** move a posting between New, In Progress, and Rejected
**So that** my tracking reflects reality as my application progresses (marking Applied is handled separately — see Story 3.3, since it requires uploading the CV I used)

**Priority:** Must Have · **Estimate:** S
**Dependencies:** Story 2.3

**Acceptance Criteria:**
```gherkin
Given a posting has status "Applied"
When I mark it as "In Progress"
Then its status changes to "In Progress"

Given a posting has status "Applied" or "In Progress"
When I mark it as "Rejected"
Then its status changes to "Rejected"

Given a posting has any status
When I select "Applied" from the status control
Then the Applied CV upload modal opens (Story 3.3) instead of immediately changing status
And status only becomes "Applied" once that modal's upload is completed
```

**Edge Cases:**
- Status changes (other than into Applied) are not hard-locked — she can correct a mis-click (e.g. accidentally marked Rejected) by changing status again.

---

### Story 3.3: Upload the CV used when marking a posting Applied

**As a** job seeker using the app
**I want to** upload the actual CV file I used when I mark a posting Applied
**So that** I have an accurate record of exactly what I submitted for that application

**Priority:** Must Have · **Estimate:** M
**Dependencies:** Story 3.2

**Acceptance Criteria:**
```gherkin
Given I select "Applied" as the new status for a posting
When the upload modal opens
Then I am prompted to select a CV file from my computer (any of .docx, PDF, or plain text/Markdown)
And the modal explains this should be the file I actually used for this application

Given the upload modal is open
When I select a valid file and confirm
Then the file is saved as this posting's applied CV
And the posting's status changes to "Applied"
And the modal closes

Given the upload modal is open
When I close/cancel it without selecting a file
Then no file is saved
And the status is NOT changed to "Applied"

Given a posting already has an applied CV from a previous upload
When I change its status to "Applied" again (e.g. after correcting a mis-click) and upload a new file
Then the previous applied CV is replaced
And I am told the previous file will be overwritten before I confirm

Given I select an unsupported file type in the modal
When I try to confirm
Then I see an error naming the supported formats
And the upload is not accepted
```

**Edge Cases:**
- File larger than a reasonable size limit (e.g. 10MB) is rejected with a clear message.
- If the upload fails (e.g. disk write error), the modal shows an error, stays open, and status is not changed.

---

### Story 3.4: Download the CV used for an applied posting

**As a** job seeker using the app
**I want to** download the CV I uploaded when I applied to a posting
**So that** I can confirm exactly what I sent, or reuse it if asked to resend

**Priority:** Must Have · **Estimate:** S
**Dependencies:** Story 3.3

**Acceptance Criteria:**
```gherkin
Given a posting has status "Applied" (or later) and has an applied CV on file
When I view that posting
Then I see a download link for the applied CV
And clicking it downloads the exact file that was uploaded, in its original format

Given a posting has no applied CV yet (status has never been set to Applied)
When I view that posting
Then no applied-CV download link is shown
```

---

## Epic 4: Resume Template & Adaptation

**Outcome:** Noa gets a resume *draft* tailored to each specific posting without manually rewriting it, and can always retrieve what was generated. (This AI-adapted draft is distinct from the "applied CV" she uploads in Story 3.3, which is the file she actually ends up submitting.)

### Story 4.1: Configure her resume template

**As a** job seeker using the app
**I want to** set which file on disk is my resume template
**So that** the app knows what to adapt for each posting

**Priority:** Must Have · **Estimate:** M
**Dependencies:** None

**Acceptance Criteria:**
```gherkin
Given I am on the Settings page
When I select a resume file in .docx, PDF, or plain text/Markdown format
Then the app saves it as my active resume template
And shows its filename and format as confirmation

Given I select a file in an unsupported format (e.g. .pages, image file)
When I try to save it as my template
Then I see an error naming the supported formats
And no template is saved

Given I already have a template set
When I select a new file
Then the new file replaces the active template
And previously generated adapted resumes (tied to past postings) are unaffected
```

**Edge Cases:**
- File larger than a reasonable size limit (e.g. 10MB) is rejected with a clear message rather than failing silently downstream.

---

### Story 4.2: Generate an adapted resume for a posting

**As a** job seeker using the app
**I want to** generate a version of my resume tailored to a specific posting
**So that** I can apply with a more relevant, competitive resume without rewriting it myself

**Priority:** Must Have · **Estimate:** L
**Dependencies:** Story 4.1, Story 2.3

**Acceptance Criteria:**
```gherkin
Given a posting is selected and my resume template is configured
When I click "Adapt my resume"
Then the app generates a tailored version of my resume for that posting's content
And the output is in the same file format as my template
And it does not invent any experience, skill, or qualification not already present in my template
And it does not remove any position/role that appears in my template — only reframing, reordering, or re-emphasizing existing content
And I see a clear success confirmation once it's ready

Given no resume template is configured
When I click "Adapt my resume"
Then I see an error directing me to configure a template in Settings first
And no adaptation is attempted

Given the adaptation call fails (API error, timeout)
When the failure occurs
Then I see a clear error message
And I can retry
And no partial/corrupt file is saved

Given I click "Adapt my resume" again for a posting that already has an adapted resume
When the new generation completes
Then the previous adapted resume for that posting is replaced
And I am told the previous version will be overwritten before I confirm

Given my template lists 4 distinct positions/roles in my work history
When the adapted resume is generated
Then the output still contains all 4 positions — none are dropped, even if de-emphasized or reordered
```

**Edge Cases:**
- Very short or malformed posting descriptions (e.g. search returned minimal detail) should still produce a usable adaptation, not an error — the app degrades gracefully to a lighter tailoring.
- If the underlying model output would remove a position or appears to fabricate content, the app should not silently save it — treat this as a generation failure and let her retry, rather than saving a resume that violates the accuracy constraint.

---

### Story 4.3: Retrieve a previously adapted resume

**As a** job seeker using the app
**I want to** open or download the resume I already generated for a posting
**So that** I can review it or submit it without regenerating it

**Priority:** Must Have · **Estimate:** S
**Dependencies:** Story 4.2

**Acceptance Criteria:**
```gherkin
Given a posting has a previously generated adapted resume
When I open that posting's detail view
Then I see an option to open/download that adapted resume file
And opening it gives me the exact file that was generated, in its original format

Given a posting has no adapted resume yet
When I open that posting's detail view
Then I see the "Adapt my resume" action instead of a retrieval option
```

---

## Epic 5: App Setup & Configuration

**Outcome:** The app can be configured with the credentials it needs, without exposing Noa to unnecessary security or cost risk.

### Story 5.1: Configure OpenAI API key

**As a** job seeker using the app
**I want to** enter my OpenAI API key once in Settings
**So that** searches and resume adaptations work without me handling API details each time

**Priority:** Must Have · **Estimate:** S
**Dependencies:** None

**Acceptance Criteria:**
```gherkin
Given I am on the Settings page
When I enter a valid-format API key and save
Then the app stores it locally (not displayed in plaintext again after saving)
And search and resume adaptation features become usable

Given I have not yet configured an API key
When I try to use "Search now" or "Adapt my resume"
Then I am blocked with a clear message pointing me to Settings

Given I enter a key and save
When the app makes its first call and the key is rejected by OpenAI (invalid/expired)
Then I see a clear error identifying it as an authentication problem, not a generic failure
```

**Edge Cases:**
- The key must never be logged in plaintext or displayed back in the UI after initial entry (mask it, e.g. show only the last 4 characters).

---

## Story Map (Summary)

```
Journey:      Set up  →  Add titles  →  Search  →  Review results  →  Open posting  →  Adapt resume  →  Mark Applied (+CV)  →  Track status
                |            |             |              |                |                |                  |                  |
Must Have:   5.1         1.1/1.2/1.3    2.1            2.3, 1.4          3.1            4.1, 4.2, 4.3      3.3, 3.4            3.2

Should Have:                            2.2
```

## MVP Scope

Everything marked **Must Have** above constitutes v1 — there is no meaningful smaller slice, since removing any of them breaks one of the core flows from the PRD (manage titles, search, review, adapt resume, upload/track the applied CV, track status). The one **Should Have** (Story 2.2, search-all-titles-at-once) is the only story that could be deferred past initial launch without breaking the core loop — she can still search each title individually via Story 2.1 in its absence.
