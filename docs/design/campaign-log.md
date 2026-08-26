# The Campaign Log — FindAJob Design System

**Status:** Definitive design direction. Approved 2026-08-26. No code written against it yet.
**Machine-readable token lock:** `.tastemaker/style-lock.md` — that file is the source of truth for values; this file is the source of truth for *why*.
**Audit this responds to:** the 42-finding review published 2026-08-26.

---

## 1. Design philosophy

**The app is a bound record of a campaign you are running.**

Not a database. Not a feed. Not an applicant-tracking system. A logbook — the kind you keep when an effort runs for months and you need to know where you stand.

Three convictions follow from that, and every decision in this document traces back to one of them:

**Accumulation is the point.** A job search has a beginning, a middle, and — eventually — an end. The interface should show that it has been running: weeks elapsed, entries logged, applications sent. A flat list of rows shows none of it. The current build treats a posting found this morning and one found six weeks ago as identical objects; the log treats them as entries in a sequence.

**The document is the deliverable.** This product makes exactly one physical thing: the adapted resume. It is the only artifact that leaves the app and enters the world. It gets rendered as a real sheet of paper with an honest shadow, at reading size, because that is what it is — and because a machine wrote it and you should read it before it goes out. The audit noted the "never drop a role" safeguard is close to worthless. Making the document impossible to ignore is a better safeguard than a self-reported count.

**Restraint is respect.** Job hunting is demoralising. An interface that is warm without being chirpy, considered without being precious, and quiet without being cold is the correct register. It does not congratulate you for adding a search term. It does not display a streak. It does not tell you that you've got this.

### What this philosophy costs, stated up front

This direction is the **lowest-density** of the three considered, and the audit's largest structural problems are density problems. That tension is real and permanent. The resolution throughout this document is: **prose gets room, metadata gets compressed.** Job descriptions are set at reading size in a reading measure; everything else — dates, source, status, company — is compressed into a marginalia rail at 12px sans. The generosity is spent on the one thing that deserves reading, and nowhere else.

---

## 2. Visual personality

| It is | It is not |
|---|---|
| Warm | Soft, pastel, or cute |
| Sincere | Encouraging, motivational, gamified |
| Unhurried | Slow, laggy, or precious |
| Dignified | Corporate, institutional, or austere |
| Considered | Decorated |

**The gut-check for any new screen:** does this read like a well-made notebook, or like an applicant-tracking system?

**Register of the writing:** a good archivist. Factual, warm, never performative. "Found 3 days ago" — not "Fresh! ✨". "No entries yet" — not "Nothing here… yet!". "Search failed. The OpenAI key in `.env` was rejected." — not "Oops! Something went wrong."

---

## 3. Colour palette

Every value below was verified with `check_contrast.py`, not eyeballed. Two tokens were corrected during verification; both corrections are recorded.

### Light — the primary mode

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#F2EDE1` | Warm bone. The desk. The page ground. |
| `--surface` | `#FBF8F0` | Warm paper. Entries, panels, the resume sheet. |
| `--ink` | `#1C1A16` | Warm near-black. All primary text. |
| `--ink-muted` | `#5F5A4C` | Warm olive-grey. Marginalia, metadata, secondary prose. |
| `--rule` | `#CFC5AB` | Warm hairline. Separation only — never state. |
| `--sienna` | `#A0492A` | Burnt sienna. Actions, links, focus, "this needs you." |
| `--teal` | `#1B4B5A` | Deep teal. Settled state only. |
| `--on-fill` | `#FBF8F0` | Label colour on any solid fill. **Not white.** |

### Dark — a real companion, independently verified

| Token | Hex | Verified |
|---|---|---|
| `--bg` | `#1A1815` | — |
| `--surface` | `#232019` | — |
| `--ink` | `#EDE7DA` | 14.38 vs bg |
| `--ink-muted` | `#A89F8C` | 6.75 vs bg · 6.19 vs surface |
| `--rule` | `#3A352C` | decorative |
| `--sienna` | `#D07B54` | 5.60 vs bg |
| `--teal` | `#5A9BAE` | 5.68 vs bg |
| `--on-fill` | `#1A1815` | 5.60 on sienna |

This is a **runtime toggle**, not an author-time choice. Default from `prefers-color-scheme`; an explicit choice overrides it and persists. This closes audit finding UI-2, where a full dark palette existed and was broken by hardcoded light hairlines.

### The three rules the contrast matrix imposes

These are not style preferences. They are the output of running the numbers, and working around them breaks the identity *and* accessibility at once.

**1 — The hairline is decorative. It can never be the only thing conveying state.**
`bg × rule` is **1.47**. A focus ring, an error edge, or an active-row boundary drawn in `--rule` is invisible to a large number of people. State-carrying borders use `--sienna` (`primary × border` = 3.51, UI-safe) or a text-safe token. This single constraint shapes the table, form, and focus specs below.

**2 — Ink never sits on sienna.**
`text × primary` is **2.88**. Any sienna fill takes `--on-fill` as its label. Verified at 5.68.

**3 — Sienna and teal never touch.**
`primary × accent` is **1.58** light, **1.01** dark. No teal text on sienna, no sienna border on teal. They are alternating states — one means "this needs you," the other means "this is settled" — and they are never neighbours. This also enforces the Stripe Press "one foil-stamp colour per object" rule for free.

### Corrections made during verification

- **`#75705F` → `#5F5A4C`.** The original secondary-text token failed at **4.24:1** on the bone ground — and marginalia lives on exactly that ground. Fixed by nudging lightness within the same warm-olive hue family.
- **A lighter tertiary tier was tested and rejected.** `#8A8578` measures **3.15:1** on bone. **There is no legal "faint" text tier on the ground.** De-emphasis is carried by size, weight, and italic — never by a lighter tint. This is a genuine constraint on the marginalia design, not a rule to route around.

### Status colour

Status uses **two channels always** — colour plus a non-colour channel. This closes audit finding A11Y-11.

| Status | Colour | Second channel |
|---|---|---|
| New / unviewed | `--ink` | Entry title at weight 600 + a filled sienna dot in the rail |
| Viewed | `--ink` | Title returns to weight 400. Dot removed. |
| In Progress | `--teal` | Rail label reads `In progress`, teal 2px underline |
| Applied | `--teal` | Rail label reads `Applied`, filled teal square |
| Rejected | `--ink-muted` | Entry title struck through, entry opacity 0.72 |

---

## 4. Typography

**Two families. Serif is content, sans is chrome.** No decorative third face, no wordmark outlier.

| Role | Family | Where |
|---|---|---|
| Content — display *and* body | **Newsreader** (variable, `opsz` 6–72) | Page titles, entry titles, all prose, job descriptions |
| Chrome | **Public Sans** | ≤13px only: labels, table headers, buttons, chips, metadata, marginalia |

**Why one serif for both roles.** Newsreader's optical-size axis is designed to carry display and text from a single family — larger sizes get tighter spacing and higher contrast automatically. Using the `opsz` axis rather than pairing two serifs is a real typographic move, and it keeps us well inside the three-family cap with room to spare.

**Headings are roman.** `font-style: normal` on every heading and display size, without exception.

> This overrides the Stripe Press recipe's "italic everywhere" instinct, deliberately. An all-italic warm serif on cream is one of the most reliable markers of generated design, and warm-serif-on-cream is already the aesthetic this direction is most exposed to. Emphasis is carried by **weight, sienna, or a drawn underline** — never by italicising a heading.

**Where italic survives:** marginalia labels (`found 3 days ago`), and emphasis inside running body prose. That is the entire list.

**Paid upgrade path**, if ever wanted: GT Sectra display + Lyon Text body. Newsreader is a real choice, not a placeholder standing in for them.

---

## 5. Type scale

Nine steps, ~1.15–1.25 ratio, base 17px. The ladder is deliberately compressed at the top — this is a tool, not a magazine cover, and there is no hero.

| Token | Size | Family | Line-height | Use |
|---|---:|---|---:|---|
| `--text-2xs` | 11px | sans | 1.4 | Uppercase labels, `0.09em` tracking |
| `--text-xs` | 12px | sans | 1.45 | Marginalia, metadata, table cell chrome |
| `--text-sm` | 13px | sans | 1.5 | Buttons, table headers, nav, chips |
| `--text-base` | 15px | serif | 1.55 | Dense list rows, secondary prose |
| `--text-body` | **17px** | serif | **1.65** | **Job descriptions. The reading size.** |
| `--text-lg` | 21px | serif | 1.35 | Entry titles |
| `--text-xl` | 26px | serif | 1.25 | Section heads |
| `--text-2xl` | 32px | serif | 1.15 | Page title |
| `--text-stat` | 34px | serif | 1.0 | Campaign tally numerals, `tabular-nums` |

**Measure:** prose caps at `66ch`. Never wider — the whole point of the reading size is undone by a 120-character line.

**Numerals:** `font-variant-numeric: tabular-nums` everywhere digits align in a column. Non-negotiable in the campaign header and every table.

---

## 6. Spacing system

4px base. This is an **app shell**, so it stays on dense guidance — the landing-page section-padding tiers explicitly do not apply.

| Token | Value | Use |
|---|---:|---|
| `space-1` | 4px | Icon-to-label, chip internals |
| `space-2` | 8px | Label and its value; stacked related lines |
| `space-3` | 12px | **Dense floor** — table cells, list rows, compact chips |
| `space-4` | 16px | Standard control padding |
| `space-6` | 24px | **Entry internal padding**; gap between groups within a panel |
| `space-8` | 32px | Showcase padding — the resume frame, the campaign header |
| `space-12` | 48px | Gap between major regions |
| `space-16` | 64px | Page top margin; gap above the campaign header |

**The governing rule: internal ≤ external.** An entry's own padding never exceeds the gap between it and its neighbour. Violating this is what makes a layout read as cramped and unclear simultaneously.

**Layout constants:**
- Reading column: `66ch`
- Marginalia rail: `168px`, appears at `≥1100px`
- Rail-to-column gutter: `space-8` (32px)
- Interactive row height: **44px minimum** — the touch-target floor, not the 36px a pure dashboard would use. This closes audit finding RSP-3.

**Values off the ladder** (20, 28, 40) are legal but should be rare and deliberate. Six arbitrary values between 16 and 32 reads as unintentional.

---

## 7. Border radius philosophy

**Zero. Everywhere.**

The justification is the metaphor, not a reflex toward flat design: **bound paper, printed forms, and books have square corners.** A logbook with rounded cards is not a logbook.

The only curved thing in the system is the **status dot**, which is a circle because it is a dot — a shape, not a radius decision.

This is a hard identity boundary. A single `border-radius: 6px` on a button breaks the metaphor more visibly than a wrong colour would, because it imports a different material entirely.

---

## 8. Borders

**1px, `--rule`, and structural only.**

Borders separate regions. They never carry state, because the matrix says they cannot — `bg × rule` is 1.47.

| Where | Treatment |
|---|---|
| Masthead underline | 1px `--rule` |
| Between entries | 1px `--rule` |
| Table row separation | 1px `--rule`, horizontal only |
| Panel edges | 1px `--rule` |
| Vertical table rules | **None.** Column separation is spacing, not lines. |

**State always uses `--sienna` at 2px**, and always alongside a second channel:

- Focus: `2px solid --sienna` outline, `2px` offset. Verified at 5.16 on ground, 5.68 on paper.
- Active nav: 2px sienna underline **plus** a weight step.
- Field error: 2px sienna left edge **plus** a text message.

**Border-width never changes between states** — that shifts layout. State moves colour and outline only.

---

## 9. Shadows

**None by default.** Exactly two exist in the entire system, and both mean one specific thing: *paper lifted off the desk.*

```
--shadow-document: 0 24px 48px rgba(28, 26, 22, 0.16);   /* the resume sheet only */
--shadow-dialog:   0 16px 40px rgba(28, 26, 22, 0.22);   /* modal dialogs only */
```

Both are warm-tinted, never neutral black.

**Nothing else casts a shadow.** Not entries, not buttons, not dropdowns, not hover states, not the masthead. A shadow in this system is a claim that something is physically lifted, and only two things are.

---

## 10. Surfaces

Two surfaces. There is no third tier, and adding one would flatten the meaning of the two that exist.

| Surface | Token | Meaning |
|---|---|---|
| **The desk** | `--bg` `#F2EDE1` | The ground. Everything sits on it. |
| **Paper** | `--surface` `#FBF8F0` | Something written down: an entry, a panel, the resume, a dialog. |

`bg × surface` is 1.10 — the step between them is *deliberately* nearly invisible. It is a change of material, not a change of elevation. Paper is distinguished from desk by its hairline edge and its content, not by contrast.

**No alternating tints.** No striped table rows. No "elevated" variants.

---

## 11. Page background

`--bg` (`#F2EDE1`), flat, edge to edge, with **no texture by default**.

An optional cloth texture at ≤3% opacity may be used on the campaign header only. It is the one permitted decorative flourish in the system and it is opt-in, not default. If it ever reads as noise rather than material, remove it — a flat warm ground is the correct fallback, not a failure.

**Deleted from the current build:** the `#root { width: 1126px }` rail, the `border-inline` side borders, `text-align: center`, and the `#social` rules. All of it is Vite template residue (audit UI-1) and none of it survives.

---

## 12. Navigation

**A masthead, not a sidebar.**

The audit's finding IA-3 is that removing Settings leaves navigation with a single item — and a one-item nav bar is a header pretending to be navigation. So this direction stops pretending.

```
┌────────────────────────────────────────────────────────┐
│  FindAJob                          Week 6 · 3 titles   │  ← masthead, hairline under
├────────────────────────────────────────────────────────┤
│  Showing · all · unviewed · in progress · applied      │  ← filter line, inline text
└────────────────────────────────────────────────────────┘
```

- **Wordmark** in Newsreader, `--text-xl`, weight 500. Not a logo. A single-user local tool does not need a constructed mark.
- **Campaign state** sits opposite it — weeks elapsed, active titles. Quiet, `--text-xs` sans, `--ink-muted`.
- **Filters are a line of inline text links**, magazine contents-page style. Not tabs, not a `<select>`. Active filter takes sienna underline + weight 600.
- **Every filter is a real URL.** `/?status=applied`, `/?view=unviewed`. Browser back, forward, and bookmarks work — a functional upgrade borrowed from the Plain Text direction, and it also fixes audit IA-4 (no per-page titles) almost for free.
- **`document.title` per screen.** `Postings — Product Manager · FindAJob`.

**Position titles are not a destination.** They become a management panel reachable from the masthead, not a top-level page. The postings feed is the home screen, closing audit IA-2 and UX-4.

**Breadcrumb**, where one is needed: `--ink-muted` for parents, `--ink` for the current segment. Never sienna.

---

## 13. Cards

**There are no cards.** There are **entries**.

This is the sharpest structural break from the current build and from generic dashboard design. A card is a tile in a grid — interchangeable, boxed, shadowed. An entry is a record in a log — sequential, hairline-separated, sitting directly on the ground.

```
────────────────────────────────────────────────────────────
 ●  Senior Product Manager                          ← --text-lg, serif, w600
    Monday.com · Tel Aviv                           ← --text-xs sans, --ink-muted
 
    We're looking for a product manager to own       ← --text-body serif 17/1.65
    our core collaboration surface. You'll work      ← 66ch measure
    directly with…                        Show more
 
 found 3 days ago · LinkedIn ↗ · New                 ← marginalia rail at ≥1100px,
────────────────────────────────────────────────────────────    inline below at narrower
```

**Anatomy:**
- Status dot in the left gutter — sienna filled if unviewed, absent otherwise
- Title: `--text-lg`, serif, weight 600 unviewed / 400 viewed
- Dek: company · location, `--text-xs` sans, `--ink-muted`
- Prose: `--text-body`, 66ch, real reading setting
- Marginalia: date, source, status — rail at ≥1100px, inline below at narrower widths
- Internal padding `space-6`; gap between entries `space-8`. Internal ≤ external holds.

**Multiple entries expand at once.** The current build's single `expandedId` is a limitation, not a feature (audit UX-7) — removing the constraint removes the bug.

**Never:** a card grid, a tile layout, a bordered box with a shadow, an accent bar down the left edge of a rounded rectangle.

---

## 14. Tables

Tables survive only where data is genuinely tabular — the position-titles management panel. **The postings view is not a table.** Converting a ten-column table into entries is how audit findings RSP-1, UX-6, and UX-7 get closed simultaneously.

Where a table does appear:

- Horizontal hairlines only. **No vertical rules** — columns are separated by space.
- `<caption>` on every table. `scope="col"` on every `<th>`. Closes audit A11Y-6.
- Header: `--text-2xs` sans, uppercase, `0.09em` tracking, `--ink-muted`.
- Cells: `space-3` padding, 44px minimum row height.
- Numerals right-aligned with `tabular-nums`.
- **No zebra striping.** Row separation is the hairline.
- Sort is a real control on the header, and the sorted column is marked by an arrow glyph **plus** `aria-sort`.
- Wide tables sit in their own `overflow-x: auto` container. **The page body never scrolls sideways.**

---

## 15. Forms

- **Every input has a visible `<label>` above it.** `--text-2xs` sans, uppercase, `--ink-muted`. Placeholder-as-label is banned outright — it fails cognitive accessibility and it is audit finding A11Y-5.
- Placeholders show **format examples only** (`e.g. Senior Product Manager`), never the field name.
- Inputs are **underlined, not boxed**: 1px `--rule` bottom border, transparent background, `space-3` vertical padding. A boxed field on paper looks like a form field on a form; an underlined one looks like a line you write on.
- Focus: bottom border goes 2px `--sienna`. Border-width on the *other* edges never changes.
- **Input height matches adjacent button height.** Always.
- Error: 2px sienna left edge, plus a message below in `--text-xs`, plus `aria-describedby`. Three channels.
- Disabled: `opacity: 0.55` **plus** `cursor: not-allowed` **plus** the native attribute. Never opacity alone.
- Grouping is by relatedness, never by schema order.
- **Destructive actions are visually separated** and never styled like safe ones.

---

## 16. Buttons

Buttons are **type-led**, not boxes. This is a logbook; the interface is written, not built out of chrome.

| Variant | Treatment |
|---|---|
| **Primary** | Solid `--sienna` fill, `--on-fill` label (5.68 verified), `space-3 / space-6` padding, 0 radius |
| **Secondary** | Text in `--ink` with a 1px `--rule` underline that thickens to 2px `--sienna` on hover |
| **Destructive** | Text in `--sienna` with a 1px sienna underline. **No red.** Sienna already reads as consequential in this palette, and a fourth colour would break the restriction. |
| **Quiet** | `--ink-muted` text, no underline until hover |

**States, all specified — none left to browser default:**
- Hover: underline thickens, or fill darkens one lightness step. Gated behind `@media (hover: hover) and (pointer: fine)`.
- `:focus-visible`: 2px sienna outline, 2px offset. Never removed.
- `:active`: `transform: scale(0.97)`, 120ms.
- Disabled: opacity + cursor + attribute.
- Loading: label swaps to a live status string (`Adapting… 00:12`), button stays the same width, no spinner.

**Minimum target 44×44px.** Adjacent buttons get `space-3` between them minimum — the current build's flush "Confirm / Cancel" pair is a real mis-tap hazard (audit RSP-3).

---

## 17. Dialogs

**Inline confirmation stays the default.** It is a documented project decision tied to testability and the stories' acceptance criteria, and it must not be replaced with `window.confirm` or a modal.

But the current inline pattern is invisible to assistive technology (audit A11Y-4). Fixed as follows:

**Inline confirmation:**
- Renders in place with `role="alertdialog"` and `aria-labelledby` pointing at its question
- **Focus moves to the confirm control on reveal**, and returns to the trigger on cancel
- Question set in `--text-base` serif, actions as Destructive + Quiet buttons
- Sienna 2px left edge marks the confirming region
- The existing consequence copy is preserved: *"Postings already found for it are kept, just unlinked."* That sentence is good and it stays.

**Modal dialogs** — reserved for the resume preview only:
- Centred, `--surface`, `--shadow-dialog`, 0 radius
- Backdrop: `rgba(28, 26, 22, 0.4)` — warm, never neutral black
- Focus trapped; `Esc` closes; focus returns to trigger
- Enter 240ms `--ease-out`, from `scale(0.98)` + `opacity: 0`. **Never from `scale(0)`.**

---

## 18. Notifications

**No toasts.** A toast is a message that leaves before you have read it, and this product's messages — "5 new entries logged," "Adaptation failed" — are things you need.

Messages are **written into the log where they happened**:

| Kind | Treatment |
|---|---|
| Success | `--text-xs` sans, `--teal`, inline at the point of action, with a teal filled square. Persists until the next action. |
| Error | `--text-xs` sans, `--sienna`, `role="alert"`, 2px sienna left edge, inline. **Always carries a recovery action.** |
| Progress | `--text-xs` sans mono-numeral, `--ink-muted`, `aria-live="polite"` |

This closes audit UI-6, where success and failure were typographically identical.

**Errors state what happened and what to do.** No apologies, no "Oops."

> `Search failed — the OpenAI key in .env was rejected. Update it and retry.` **Retry**

---

## 19. Icons

**Typographic marks first, icons rarely, emoji never.**

Preferred marks: `§` source · `—` empty · `·` separator · `↗` opens externally · `●` unviewed · `▪` applied

Where a true icon is needed: **Phosphor Light**, one set only, fetched via
`python3 scripts/fetch_icons.py --icons <names> --set ph --color "#A0492A" --out design/assets/icons`

- 16px or 20px only
- 1.5px stroke, warm ink or sienna
- **Never filled** — filled glyphs read as app-store chrome
- Never the sole label for an action; always paired with text

**One set, project-wide.** Mixing icon libraries is immediately visible. And an icon is never decoration — if deleting it loses no information, it should not be there.

---

## 20. Imagery and illustration

**There is exactly one image in this product, and it is real.**

Stated plainly, because the honest answer matters more than filling the slot: **this product has no photographic or illustrative content and never will.** No offices, no people, no places, no abstract concept sections. There is nothing here to photograph and nothing worth illustrating. No stock photography, no unDraw figures, no generated art, no CSS-drawn scenes.

**The one image: the adapted resume sheet.**

- A rendered first page of the actual generated document
- On `--surface`, square corners, `--shadow-document`
- Roughly 3:4, capped at 420px wide in the entry view; full page in the modal
- Loading: a paper-coloured block at the correct aspect ratio with a hairline edge — **never a grey box, never a spinner**

> **This is the direction's load-bearing dependency, and it is genuine engineering work.** Rendering a DOCX or PDF first page in the browser is not trivial. Without it, this direction loses its anchor asset and drifts toward generic warm-serif blogging. If it turns out to be infeasible, that is a signal to revisit the direction — not to quietly substitute a placeholder and carry on.

**Interim state, if the renderer lands later than the rest:** a sheet-shaped `--surface` panel at the right aspect ratio containing the adapted resume's **first six lines as real extracted text**, plus the filename and generation timestamp. Real content at reduced fidelity — not a fake preview image, and labelled as a text extract so nobody mistakes it for the rendered document.

---

## 21. Empty states

Empty states are high-visibility, low-stakes real estate, and this system has a natural motif: **a blank page.**

Every empty state gets a `--surface` sheet with a hairline edge, sitting on the ground — visually the same object as a real entry, just unwritten. The form stays constant; only the content is absent. A new campaign looks *new*, not broken. This is the direction's structural advantage over the terminal alternative, and it should be spent here.

Each one **teaches**, closing audit UX-13:

**No position titles yet**
> **Nothing logged yet.**
> Add the job titles you're searching for and the log starts filling.
> Searches look back 45 days and return up to 20 postings per title. Each one costs a small amount of OpenAI credit.
> [ Add a title ]

**No postings for this title**
> **No entries under "Product Manager" yet.**
> Run a search to look for postings from the last 45 days.
> [ Search now ]

**Filter returns nothing**
> **No entries match "applied".**
> [ Show all entries ]

**Never:** a shrug illustration, an empty-box graphic, an exclamation mark, or the word "Oops."

---

## 22. Error states

Every error answers three questions: **what happened, why, and what now.** The third is the one the current build usually omits (audit UX-8).

**Structure:** 2px sienna left edge · `role="alert"` · message in `--text-base` serif · recovery action as a Secondary button.

**Every error gets a recovery action.** No exceptions. A failed initial load currently leaves you with a paragraph and a browser refresh as the only way forward; that is not acceptable in this system.

| Failure | Copy |
|---|---|
| List load failed | **Couldn't load the log.** [ Try again ] |
| Search failed | **Search failed.** The request to OpenAI didn't complete. [ Retry search ] |
| Key rejected | **The OpenAI key was rejected.** Update `OPENAI_API_KEY` in `.env` at the repo root and restart the server. [ Retry ] |
| No template | **No resume template found.** Put a `Resume.docx` at the repo root, then try again. [ Retry ] |
| Adaptation failed | **Couldn't adapt your resume for this posting.** [ Try again ] |

Note the last two: the current copy points at a Settings page that no longer configures anything (audit UX-9). It now names the real file.

**Partial failure is normal and must be shown as such.** "Search all" runs per-title; one title failing must never look like total failure. Each entry carries its own state and its own retry.

---

## 23. Loading states

The audit's most severe finding is that two 30-second AI operations have no progress model (UX-2). This system's answer is **honesty over animation**.

**Principle: if a real number is available, show the number.** A spinner that could have been a count is a downgrade.

| Operation | Treatment |
|---|---|
| Initial load | **Skeleton entries** — sheet-shaped `--surface` blocks with hairline edges at real row heights. Never a full-page "Loading…" replacement (audit UX-3). |
| Filter change | **Nothing unmounts.** Entries fade to `opacity: 0.5` and back. The filter control never disappears — the current build destroys it on every use. |
| Single search | Button label → `Searching… 00:31`. Live elapsed count, `aria-live="polite"`. |
| Search all | `Searching 3 of 8 · Senior PM · 02:14` — plus a hairline progress rule that fills. **[ Stop ]** always available. |
| Adapting resume | `Adapting… 00:12`, sheet placeholder appears immediately at the correct aspect ratio |
| Saving | Inline `Saved` in teal. No spinner — it is instantaneous. |

**Cancellation is required** on both long operations. A four-minute uninterruptible run is not acceptable.

**Every long operation announces itself** via `aria-live="polite"` — announcing at start, at each meaningful step, and at completion. Currently a screen-reader user clicks Search and gets thirty seconds of silence (audit A11Y-2).

---

## 24. Responsive behaviour

The current build has **three font-size media queries and no layout strategy** (audit RSP-2). This is the strategy.

| Breakpoint | Layout |
|---|---|
| **< 640px** | Single column. Marginalia inline **below** the entry, comma-separated. Prose 16px/1.6. Filters wrap to two lines. Page padding `space-4`. |
| **640–1099px** | Single column, prose at 66ch, marginalia still inline. Page padding `space-6`. |
| **≥ 1100px** | **Marginalia rail appears** — 168px, left of the reading column, `space-8` gutter. This is the layout the direction is designed around. |
| **≥ 1440px** | Column and rail centre as a unit. Measure never grows past 66ch. |

**Rules that hold at every width:**
- The page body **never** scrolls horizontally. Wide content gets its own `overflow-x: auto` container.
- Touch targets stay ≥44px. They do not shrink on mobile — that is where they matter most.
- Adjacent actions keep ≥`space-3` between them.
- The reading measure is capped, not fluid. A wider window means more margin, not longer lines.
- Fluid type via `clamp()` between the mobile and desktop values; the ladder's *relationships* hold at every size.

---

## 25. Animation philosophy

**Motion answers "what changed" and "is it still working." It never performs.**

This is an **app shell** track. No scroll storytelling, no pinned sections, no parallax, no scrubbed reveals — a triage tool has no scroll narrative.

```
--ease-out:     cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out:  cubic-bezier(0.77, 0, 0.175, 1);
--duration-press:   120ms;
--duration-popover: 180ms;
--duration-panel:   240ms;
```

| Moment | Motion |
|---|---|
| First data load | Entries stagger in, 60ms apart, **8 rows maximum**, 200ms / 8px rise |
| Panel switch | 240ms cross-fade + 8px directional slide, direction consistent with navigation |
| Dialog enter/exit | 240ms, from `scale(0.98)` + `opacity: 0`, same path out |
| Button press | `scale(0.97)`, 120ms |
| Search progress | The counter counts. That is the animation. |

**Where motion is deliberately deleted** — because these are seen dozens of times per session and instant is the correct feel:

- Status change
- Filter change
- Row expand / collapse
- Navigation
- Hover on entries

**Revised down from the direction proposal.** The original called for 400–600ms crossfades and a 6° rotation on the resume sheet. Both fail the motion gate for a daily-use tool: high-frequency UI must feel instant. **The resume sheet does not rotate on hover.**

**Hard rules:**
- Animate `transform` and `opacity` only. Never `width`, `height`, `top`, `left`, or shadow spread.
- Never `transition: all` — name the properties.
- Never `ease-in` on UI.
- Never animate from `scale(0)`.
- Hover motion gated behind `@media (hover: hover) and (pointer: fine)`.
- Enter and exit along the same path.

**Reduced motion:** all translate and stagger dropped; opacity and colour feedback retained. **The progress counter keeps counting** — it is information, not decoration, and removing it would remove the only feedback a long operation has.

---

## 26. Real-world references

| Reference | What to take |
|---|---|
| **Stripe Press** (press.stripe.com) | The anchor. Warm bone ground, editorial serif, the physical object photographed with an honest shadow, unhurried pacing. |
| **Physical Stripe Press books** | Cloth-bound, foil-stamped, square-cornered. One accent colour per object. |
| **Robert Bringhurst, *The Elements of Typographic Style*** | Measure discipline, marginalia as a first-class structural device. |
| **Edward Tufte's own books** | Side-notes in the margin instead of tooltips. Directly inspires the marginalia rail. |
| ***The Whole Earth Catalog*** | Dense information presented warmly. Proof that generous and utilitarian coexist. |
| **Field notebooks / lab logbooks** | The core metaphor. Sequential entries, dated, accumulating, square-cornered. |
| **Cereal magazine** — typography only | Restrained serif hierarchy. Explicitly **not** its photography, which we have none of. |
| **Are.na's editorial writing** | Content-first, chrome-light, sincere register. |

**Anti-references — what this must never resemble:**

Notion's AI-era marketing · Linear's dark-mode tool aesthetic · any applicant-tracking system · Headspace-style wellness softness · the warm-cream-plus-terracotta-plus-serif combination that has become the default generated "premium" look. That last one is the closest neighbour and the most dangerous — the defence is roman headings, zero radius, no shadows, and a genuinely restricted palette.

---

## 27. Never do — the identity boundaries

Breaking any of these breaks the direction. They are ordered by how visibly.

### Colour
1. **Never pure white** (`#FFFFFF`) or cold grey. Every neutral carries a warm cast.
2. **Never put ink text on a sienna fill.** 2.88 — illegal. Fills take `--on-fill`.
3. **Never let sienna and teal touch.** 1.58 — illegal, and it breaks the one-foil-stamp rule.
4. **Never use the hairline to convey state.** 1.47 — decorative only.
5. **Never use text lighter than `#5F5A4C` on the bone ground.** There is no legal faint tier.
6. **Never add a fifth colour.** No red for errors, no green for success, no amber for warnings. Sienna and teal carry every state.
7. **Never convey status by colour alone.** Two channels, always.

### Form
8. **Never a border-radius above 0.** Paper has square corners.
9. **Never a shadow** outside the two named ones. No hover lift, no dropdown elevation, no card shadow.
10. **Never a card grid or a tile layout.** Entries in a log, not tiles in a dashboard.
11. **Never a sidebar.** Two destinations do not justify persistent chrome.
12. **Never an accent bar down the left edge of a rounded card.** Named cliché, and it violates two rules at once.
13. **Never a third surface tier.** Desk and paper. That is all.

### Type
14. **Never an italic heading.** Emphasis is weight, sienna, or a drawn underline.
15. **Never a third font family.** Serif is content, sans is chrome.
16. **Never set body prose in mono.**
17. **Never use a placeholder as a label.**
18. **Never let prose exceed 66ch.**

### Motion
19. **Never animate anything seen more than a few times per session.** Status, filter, expand, nav — instant.
20. **Never `transition: all`.** Name the properties.
21. **Never animate layout properties.** Transform and opacity only.
22. **Never a spinner where a real count exists.**
23. **Never rotate the resume sheet on hover.**

### Content and craft
24. **Never emoji.** Anywhere. It would puncture the register instantly.
25. **Never congratulatory or encouraging microcopy.** No streaks, no "You've got this," no confetti.
26. **Never an error without a recovery action.**
27. **Never a full-page loading replacement.** Skeletons in place.
28. **Never destroy focus on a state change.** Manage it explicitly.
29. **Never a toast.** Messages persist where they happened.
30. **Never fabricate the resume preview.** Real render, or a labelled text extract. Never a fake page image.
31. **Never let the page body scroll horizontally.**
32. **Never reintroduce the Vite template residue** — the 1126px rail, `border-inline`, `text-align: center`, `#social`.

---

## Open items for implementation

1. **The resume renderer is the critical path.** Everything else degrades gracefully; this does not. Scope it before committing to the direction.
2. **146 tests query exact button strings** — `Adapt my resume`, `Re-adapt resume`, `Yes, replace`, `Search now`, `Show more`, and `role="alert"`. Restyling is free; renaming is a deliberate, test-updating decision.
3. **Cutting the Settings page** removes three client tests and two API modules. Whether the server endpoints follow is a separate call — `GET /api/settings/resume-template` is the only thing that reports which template is actually live.
4. **`audit_motion.py` and `anti_slop_scan.py` have not been run** — there is no implementation to run them against yet. Both are required before handoff.
5. **Contrast figures are calculated, not browser-verified.** Confirm in DevTools during implementation.
