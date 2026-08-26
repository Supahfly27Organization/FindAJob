# Style lock — FindAJob ("The Campaign Log")

Established: 2026-08-26. Source: user-specified direction (Direction B, "The Campaign Log"), anchored on Stripe Press / Warm Humanist with editorial bones. Palette hand-picked from the direction, then verified — not generated.

Precedence note: the user chose this direction explicitly, so `generate_palette.py`'s mood path was **not** run. The hand-picked palette was instead put through `check_contrast.py --matrix` in both modes, and two tokens were corrected as a result (see Color contract).

## Palette

**Light (primary mode)**

- Background: `#F2EDE1` — warm bone. The "desk"; the page ground.
- Surface: `#FBF8F0` — warm paper. Entries, panels, the resume sheet.
- Primary: `#A0492A` — burnt sienna. Actions, links, "this needs you."
- Accent: `#1B4B5A` — deep teal. Settled/committed state only. Never combined with sienna in the same element.
- Text primary: `#1C1A16` — warm near-black. Contrast vs background: **14.87** (AA pass)
- Text muted: `#5F5A4C` — warm olive-grey. vs background **5.89**, vs surface **6.48** (both AA pass)
- Border: `#CFC5AB` — warm hairline. **Decorative only** (1.47 vs background) — see Color contract.
- Button label color: **Surface `#FBF8F0`**, not white — contrast vs Primary: **5.68** (AA pass). Pure white is banned by the recipe; the warm paper tone was checked, not assumed.

**Dark (companion, runtime toggle)**

- Background: `#1A1815` · Surface: `#232019` · Primary: `#D07B54` · Accent: `#5A9BAE`
- Text primary: `#EDE7DA` — vs background **14.38** (AA pass)
- Text muted: `#A89F8C` — vs background **6.75**, vs surface **6.19** (both AA pass)
- Border: `#3A352C` — decorative only (1.46 vs background)
- Button label: Background `#1A1815` on Primary — **5.60** (AA pass)

- Dark mode: **runtime toggle — both modes ship, user-switchable.** Independently verified; not an inversion of the light values. Default from `prefers-color-scheme`, explicit choice overrides and persists to `localStorage`, read before first paint.

## Color contract

Verified with `check_contrast.py --matrix` on both role sets. The palette is a contract over which colors may touch, not seven hexes to combine freely.

**Light — legal pairings**

- **Text-safe (≥4.5)**: text/surface · text/on-primary · text/bg · text/border · surface/accent · accent/on-primary · bg/accent · surface/primary · primary/on-primary · accent/border · bg/primary
- **UI-safe (≥3.0, <4.5)**: primary/border
- **Decorative (<3.0)**: text/primary · text/accent · surface/border · border/on-primary · primary/accent · bg/border · bg/surface · bg/on-primary · surface/on-primary

**Dark — legal pairings**

- **Text-safe (≥4.5)**: text/bg · text/on-primary · text/surface · text/border · bg/accent · accent/on-primary · bg/primary · primary/on-primary · surface/accent · surface/primary
- **UI-safe (≥3.0, <4.5)**: accent/border · primary/border
- **Decorative (<3.0)**: text/primary · text/accent · bg/border · border/on-primary · surface/border · bg/surface · surface/on-primary · primary/accent · bg/on-primary

**Three consequences that govern the whole system — do not work around them:**

1. **The hairline is decorative in both modes** (1.47 light / 1.46 dark). It may separate regions visually but must **never be the only thing conveying state**. A focus ring, an error edge, or an active-row boundary must use Primary (`primary/border` = 3.51 light, UI-safe) or a text-safe token — never `--border`.
2. **`text × primary` is decorative (2.88 light / 2.57 dark).** Ink text on a sienna fill is illegal. Sienna fills always take the Surface/Background label token.
3. **`primary × accent` is decorative (1.58 light / 1.01 dark).** Sienna and teal must never touch — no teal text on a sienna fill, no sienna border on a teal fill. They are alternating states, never neighbours.

**Adjustments made during verification** (recorded so a later session knows these values already reflect a contrast fix):

- Text muted nudged **`#75705F` → `#5F5A4C`**. The original failed at **4.24:1** against the bone Background — and marginalia (dates, source, "found 3 days ago") lives on exactly that ground. Fixed by lightness nudge within the same warm-olive hue family, per the skill's repair order.
- A lighter tertiary tier **`#8A8578` was tested and rejected** at **3.15:1** on Background. **There is no legal "faint" text tier on the bone ground.** De-emphasis is carried by size, weight, and italic — never by a lighter tint.

## Typography

- Display/heading font: **Newsreader** (variable, `opsz` 6–72) — a sharp transitional serif with real voice. The `opsz` axis carries display *and* text, so one family covers both roles honestly.
- Body font: **Newsreader** at its text optical size. Content is one voice.
- UI chrome font: **Public Sans** — humanist sans, ≤13px only, for labels, table headers, buttons, status chips, metadata.
- Scale: custom 9-step ladder, ~1.15–1.25 steps, base 17px body. See the spec doc.
- **Two families total.** Serif = content, sans = chrome. No decorative third face, no wordmark outlier. Comfortably inside gate 39's cap.
- Paid upgrade path if ever wanted: GT Sectra (display) + Lyon Text (body). Not required — Newsreader is not a placeholder.
- **Headings are roman.** `font-style: normal` on every heading and every display size. Resolves the conflict between the Stripe Press "italic everywhere" instinct and anti-slop gate 38 — the gate wins, and the reason is that all-italic warm serif is precisely the generated-page tell this direction is most exposed to. Italic is reserved for marginalia labels and emphasis inside running body prose.

## Shape language

- Corner radius: **0 everywhere.** Justified by the metaphor, not by reflex (gate 52): bound paper, printed forms, and books have square corners. The only curved thing in the system is a status dot, which is a circle because it is a dot — not a rounded rectangle.
- Shadow depth: **none by default.** Exactly two shadows exist, both meaning "paper lifted off the desk":
  - `--shadow-document: 0 24px 48px rgba(28,26,22,0.16)` — the resume sheet only.
  - `--shadow-dialog: 0 16px 40px rgba(28,26,22,0.22)` — modal dialogs only.
  - Nothing else in the product casts a shadow. Not cards, not buttons, not dropdowns, not hover states.
- Border usage: 1px hairline `--border` for separation only. State always uses color + a second non-color channel.

## Density & spacing

Base unit 4px. This is an **app shell**, so it stays on dense/information-heavy guidance — the landing-page section-padding tiers do not apply here.

- Tokens in use: `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-6` 24 · `space-8` 32 · `space-12` 48 · `space-16` 64
- Dense/compact internal padding (list rows, table cells, chips): `space-3` (12px)
- Content entry internal padding (a posting entry, a panel): `space-6` (24px)
- Showcase internal padding (the resume sheet frame, the campaign header): `space-8` (32px)
- Reading column: `66ch` max for prose. Marginalia rail: `168px` at ≥1100px.
- Overall density: **moderate-editorial.** Denser than a marketing page, more generous than a data grid. Row height 44px minimum (touch target floor), not the 36px a pure dashboard would use.
- Section separation: **hairline divider**, applied the same way at every boundary. No alternating surface tint anywhere.
- Internal ≤ external holds throughout: an entry's own padding never exceeds the gap between it and its neighbour.

## Navigation chrome

App shell, but a deliberately **thin** one — this product has two destinations, not seven, so a full sidebar would be chrome pretending to be structure.

- Sidebar: **none.** A masthead rail replaces it. Recorded explicitly so a later session doesn't "fix" this by adding one.
- Content area background: `Background` (bone).
- Masthead: shares `Background` with a hairline underneath. Not its own fill.
- Active nav item: **sienna 2px underline on the text itself**, plus `font-weight` step. Two channels, never weight alone (this is audit finding UI-8).
- Inactive hover: text shifts from `Text muted` to `Text primary`. No background fill, no pill.
- Breadcrumb: `Text muted` for parents, `Text primary` for the current segment. Never sienna — wayfinding is not a call to action.
- Shell density: 17px serif content, 13px sans chrome, 44px minimum interactive row height.

## Mood descriptors

**Warm, sincere, unhurried, dignified.** Gut-check for any new screen: does it read like a well-made notebook, or like an applicant-tracking system?

## Assets

- Anchor asset: **the rendered adapted-resume sheet.** Everything else matches it — warm paper, square corners, one honest shadow.
- Asset style: minimal. Typographic marks (`§`, `—`, `·`, `↗`) preferred over icons.
- Icon set: **Phosphor Light**, one set only, fetched via `scripts/fetch_icons.py --set ph --color "#A0492A"`. Used sparingly, never decoratively.
- Illustration vs. photography split: **neither.** This product has no photographic or illustrative content and never will — no offices, no people, no places, no abstract concept sections. Stated plainly rather than filling the gap with generic art. The resume document is the only image in the system.
- Illustration source used: **none — not applicable to this product.** `~/.ideagram/undraw/` was not populated and was not needed.
- Logo: none exists. A wordmark set in Newsreader is sufficient; do not construct a geometric mark for a single-user local tool.

## Motion

- Feel: **quiet and matter-of-fact.** Motion answers "what changed" and "is it still working." It never performs.
- Track: **App shell only.** No scroll storytelling, no pinned sections, no scrubbed reveals — there is no scroll narrative in a triage tool.
- Curves: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` · `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`
- Durations: press 120ms · popover 180ms · panel 240ms · entry stagger 60ms/row, 8 rows max
- Entrance: 200ms, 8px rise. Small and quick.
- **Revised down from the direction proposal's 400–600ms crossfades and 6° hover rotation.** Those fail the motion gate for a daily-use tool: high-frequency UI must feel instant, and this is opened every morning. The resume sheet does **not** rotate on hover.
- Frequency rules: **no motion at all** on status change, filter change, row expand/collapse, or nav. These are seen dozens of times per session. Motion is reserved for first data-load stagger, panel switch, dialog enter/exit, and search progress.
- The one long-running exception: **search progress**, which is genuinely 30s+. It gets a real counter, not a spinner.
- Reduced motion: all translate/stagger dropped; opacity and color feedback retained. The progress counter keeps counting — it is information, not decoration.
- Verified by: **pending** — `audit_motion.py` to be run against the implementation.

## Do not

Project-specific bans. Full reasoning in the spec doc.

- No pure white (`#FFFFFF`) and no cold grey anywhere. Every neutral carries a warm cast.
- No italic headings.
- No border-radius above 0.
- No shadow except the two named above.
- No sienna and teal touching.
- No hairline as the sole carrier of state.
- No lighter-than-`#5F5A4C` text on the bone ground.
- No emoji, ever — it would puncture the register instantly.
- No spinner where a real count is available.
- No motion on any action performed more than a few times per session.
- No congratulatory or encouraging microcopy. Sincere, never chirpy.
- No card grid. Entries are entries, not tiles.
- No sidebar.
