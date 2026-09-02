# OnTopic Desktop — Backlog

---

## Architecture — P0: Blocks macOS / Linux shipping

> **macOS items (A-01, A-02, A-13) are deferred until a Mac build environment is available.** All context is preserved below so they can be picked up without re-investigation.

| # | Item | Notes |
|---|------|-------|
| A-01 | **macOS speaker capture** *(deferred — needs Mac)* | Bundle BlackHole installer; call Swift/ObjC helper to create Multi-Output Device via CoreAudio; open BlackHole 2ch via naudiodon. `speaker-capture-mac.js` is a no-op stub. The setup wizard opens a GitHub wiki — needs to instead bundle and silently install the .pkg. Requires `NSMicrophoneUsageDescription` (see A-02). |
| A-02 | **macOS entitlements** *(deferred — needs Mac)* | Add `NSMicrophoneUsageDescription` + `com.apple.security.device.audio-input` entitlement to `electron-builder.yml`. App will be rejected by Gatekeeper without this. Also add `com.apple.security.files.user-selected.read-write` if the aggregate-device setup helper writes to system audio prefs. |
| ~~A-03~~ | ~~Linux speaker capture~~ | ✅ Done — `speaker-capture-linux.js` implements `parec` spawn against the detected PulseAudio/PipeWire monitor source. |
| ~~A-04~~ | ~~Platform-conditional server spawn~~ | ✅ Done — extracted `getAppDataDir()` helper; `loadEnvFile()` and `startServer()` log path both use it. Spawn itself was already platform-conditional. |
| ~~A-05~~ | ~~Platform-conditional port cleanup~~ | ✅ Done — `killProcessOnPort` Unix branch now tries `lsof` first, falls back to `ss` (iproute2) for minimal Linux. `mkdirSync` added for log directory. |

---

## Architecture — P1: Correctness and reliability

| # | Item | Notes |
|---|------|-------|
| ~~A-06~~ | ~~Session analysis queue~~ | ✅ Done — `enqueueForSession()` serializes `/analyze` and `/demo-analyze` per `sessionId` using a chained Promise map. |
| ~~A-07~~ | ~~Analysis async response~~ | ✅ Done — `/analyze` returns `202 + jobId` immediately; client polls for the result. |
| ~~A-08~~ | ~~Token budget management~~ | ✅ Done — `max_completion_tokens` raised from 2048 → 4096 in `analyzeText()`. |
| ~~A-09~~ | ~~Prompt caching~~ | ✅ Done — `getStaticPromptContext()` caches partners + competencies + reference projects with a 5-min TTL and explicit invalidation middleware on all partner/competency/reference-project mutation routes. |
| ~~A-10~~ | ~~JSON column validation on read~~ | ✅ Done — `safeArray<T>()` helper replaces all raw `(session.x \|\| []) as T[]` casts in `processAnalysis()`; null/corrupt columns degrade to empty arrays instead of a type mis-cast. |
| ~~A-11~~ | ~~Migration safety~~ | ✅ Done — `db.ts` now only suppresses errors matching `table/column/index … already exists`; all other migration errors are re-thrown to surface on startup. |

---

## Architecture — P2: Production readiness

| # | Item | Notes |
|---|------|-------|
| A-12 | **Code signing — Windows** | NSIS + Authenticode certificate. Required for SmartScreen to not block the installer. |
| A-13 | **Code signing + notarization — macOS** | Apple Developer ID + `notarytool`. Required for Gatekeeper on macOS Big Sur+. |
| A-14 | **Auto-update** | Integrate `electron-updater`. Server-side update manifest. Delta updates so users don't re-download the full binary. |
| ~~A-15~~ | ~~Rate limiting on `/analyze`~~ | ✅ Done — per-session request throttle on the analysis endpoint. |
| ~~A-16~~ | ~~Pagination on sessions list~~ | ✅ Done — `limit`/`offset` added to storage, route, and UI. |
| ~~A-17~~ | ~~Database backup before migration~~ | ✅ Done — `.sqlite` copied to `.sqlite.bak` before `migrate()` runs. |

---

## Architecture — P3: Quality of life

| # | Item | Notes |
|---|------|-------|
| A-18 | **Database encryption at rest** | The SQLite file containing transcripts, BANT data, and client details is plaintext. Use SQLCipher or a key derived from `safeStorage` to protect sensitive meeting data on shared machines. |
| ~~A-19~~ | ~~Configurable ports and timeouts~~ | ✅ Done — server port configurable via `ONTOPIC_PORT` env var. |
| ~~A-20~~ | ~~Audio level visualization fix~~ | ✅ Done — real FFT spectrum via Web Audio API `AnalyserNode` replaces the synthesized flat fill. |
| ~~A-21~~ | ~~Device hot-swap~~ | ✅ Done — `useAudioCapture` detects `deviceId` changes and restarts the stream without a manual stop/start. |
| ~~A-22~~ | ~~Voice profile confidence feedback~~ | ✅ Done — sample count + confidence score surfaced as a reliability indicator. |
| ~~A-23~~ | ~~Session export~~ | ✅ Done — PDF + JSON export from the session-detail header. |
| ~~A-24~~ | ~~Topic pruning~~ | ✅ Done — individual topics can be deleted from session detail. |
| ~~A-25~~ | ~~Re-runnable setup wizard~~ | ✅ Done — re-runnable from Studio Settings for troubleshooting. |

---

## Product backlog

### BL-001 · Keep React and Electron versions always in sync
**Priority:** High | **Type:** Process / Engineering

Ensure feature parity, documentation, and unit tests are maintained across both the React web version and the Electron desktop shell at all times.

- Any feature added to the React frontend must be verified functional in Electron (IPC, file paths, CSP, offline behaviour)
- CLAUDE.md and SETUP.md must reflect both runtime targets
- Unit tests must cover paths exercised in both environments (e.g. API base URL differences, `window.electronAudio` presence checks)
- CI / build scripts should run both `npm test` (Node/Vitest) and a smoke build of the Electron package
- Checklist item added to PR template: "Tested in Electron dev mode?"

---

### BL-002 · Demo features worth promoting to the real product
**Priority:** Medium | **Type:** Feature / Discovery

Features built for the demo experience that have value in production and should be evaluated for full implementation.

| Demo feature | Production consideration |
|---|---|
| Word-by-word transcript streaming (timed to audio) | Real transcription already streams; ensure the live transcript panel scrolls and reveals text incrementally rather than appending whole chunks |
| Explicit speaker override per segment | Expose a "correct speaker" affordance in the live transcript so users can fix misattributions in real time |
| Named persona voices (TTS per speaker) | Not applicable to production audio capture, but the speaker-colour / label system could be surfaced more prominently |
| Unnamed "Speaker N" auto-labelling | Already works in production via `resolveSpeaker`; consider adding a one-click "Name this speaker" prompt in the transcript UI |
| Realistic sales-call script with NDA, action items, BANT flow | Use as a reference for onboarding copy and demo environment for prospects |
| Demo session auto-cleanup (reference project teardown) | Let users "reset demo data" from Settings without a full reinstall |

---

### BL-003 · Salesforce Opportunity box on the AE live session screen
**Priority:** High | **Status:** ✅ Implemented (v0.1 — read-only, derived from BANT + session data)

Fields auto-populate from BANT data, speaker detection, and session metadata.

**Future iterations:**
- Editable inline fields
- Stage picker tied to methodology progress
- "Copy to clipboard" / "Push to Salesforce" from the live session panel
- Salesforce OAuth integration (see BL-005)

---

### BL-004 · Salesforce Opportunity tab on the Session Detail page
**Priority:** High | **Status:** ✅ Implemented (v0.1 — read-only + non-functional Push button)

**Future iterations:**
- Salesforce Connected App OAuth flow
- Field mapping configuration
- Two-way sync: pull existing Opp from SFDC to pre-populate session metadata
- Activity / Call Log creation in addition to Opportunity update

---

### BL-005 · Salesforce OAuth integration
**Priority:** Low (depends on BL-003 / BL-004) | **Type:** Integration

Full Salesforce Connected App integration so the "Push to Salesforce" button actually creates/updates an Opportunity record.

- OAuth 2.0 Connected App (client credentials via Electron `safeStorage`)
- REST API: `PATCH /services/data/v59.0/sobjects/Opportunity/{id}`
- Field mapping UI in Settings
- Error handling for permission / validation failures
- Sandbox vs. production org toggle

---

### BL-006 · Unit test coverage gaps
**Priority:** Medium | **Type:** Engineering (child of BL-001)

- `useAudioCapture` hook behaviour when `window.electronAudio` is absent (web fallback path)
- `processDemoChunk` word-streaming and audio fallback logic
- `resolveSpeaker` edge cases (NEW_SPEAKER, voiceMatch override, consecutive same-speaker)
- Salesforce data derivation logic (once extracted to a shared helper)
- Session-detail tab rendering for sessions with/without BANT data

---

### BL-007 · SIPOC tool for BA persona
**Priority:** Medium | **Type:** Feature (BA persona) | **Status:** ✅ Implemented

Structured BA framework, additive alongside `requirements`/`painPoints`. AI-drafted, human-edited scaffold — not a one-shot auto-fill.

**Architecture**
- `shared/schema.ts`: `sipocData` JSON column on `sessions`, typed `SIPOCData { suppliers, inputs, process, outputs, customers: SIPOCItem[]; lastUpdated }` where `SIPOCItem = { text, evidence? }`.
- `drizzle/0002_sipoc.sql` migration + `_journal.json` entry (idx 2).
- `server/constants.ts`: `sipoc?: boolean` on `FeatureFlags`; `featuresForRole("correspondent")` returns `sipoc: true`.
- `server/analysis-helpers.ts`: `applySipocUpdates()` — merges per-category, dedupes case-insensitively against the first 40 chars (same pattern as `dedupeByText` callers elsewhere), only touches categories present in a given update.
- `server/routes.ts`: wired into `processAnalysis()` gated on `features.sipoc`; `sipocData` added to the `PATCH /api/sessions/:id` zod schema (needed for the delete-item UI below).

**AI changes**
- `buildAnalysisPrompt()` in `server/services/analysis.ts`: SIPOC extraction task + `sipocUpdate: { suppliers?, inputs?, process?, outputs?, customers?: string[] }` in the JSON shape, gated on `features.sipoc`. Explicitly instructs the model to leave categories empty rather than force-fill them.

**UI**
- Session-detail: new "SIPOC" tab (correspondent-only, shown once any category has data), five-card grid, each item removable via a hover ✕ — backed by the generic session PATCH endpoint. Full inline text-editing (vs. delete-only) is a reasonable fast-follow if the delete-only scaffold proves insufficient in practice.
- Live dashboard: "SIPOC" tab added to the BA role's bottom tab group (Questions/SIPOC/Topics/Actions/Sentiment), read-only accumulation matching how Requirements/Pain Points already behave live.
- **Superseded by BL-010:** the board described here (flat five-card grid) was later redesigned into a colored header band with connecting arrows, then a "Confirmed Chains" linked-row layout — see BL-010 for the current shape of `SipocBoard`.

**Demo**
- Correction from the original sketch: the BA (correspondent) role has its own dedicated demo — `BA_DEMO_CHUNKS` in `src/pages/dashboard.tsx`, "Procurement Requirements Workshop" (Rachel Torres et al. at Northgate Group) — not the generic "Cloud Migration Review" script, which is actually the **engineer** role's demo.
- **Follow-up — done:** a manual demo run showed Suppliers/Inputs staying thin (1-2 items) while Process/Outputs/Customers accumulated 4-8 — exactly the imbalance the initial "validate after a run" note was watching for. Fixed by naming specific suppliers (Acme Manufacturing, Beacon Logistics, Meridian Office Supplies, Cascade Industrial Supply) and distinct input document types (invoices, purchase requisitions, signed contracts, W-9 forms, banking details, insurance certificates) in Pat Singh's two chunks, instead of the generic "supplier invoices" phrasing. No audio exists for this demo (BA has none recorded, unlike AE), so this was a same-index text edit with no downstream file renumbering to worry about. Verified via the real API: 4 suppliers, 6 inputs after both chunks.

**Docs / Tests**
- `tests/constants.test.ts`: correspondent → `sipoc: true`; `sipoc: false/undefined` asserted for every other role.
- `tests/analysis-helpers.test.ts`: 7 new cases for `applySipocUpdates` (null/undefined handling, category isolation, case-insensitive dedupe, blank/whitespace filtering, trimming) + a `persistSessionUpdates` sipocData case.
- 319/319 tests passing after both BL-007 and BL-008.

**Future consideration:** RACI matrix as a follow-on BA tool — deliberately deferred until SIPOC has been used for a while, since RACI's people × task shape is different enough from SIPOC's flat lists that it shouldn't share an abstraction sight-unseen.

---

### BL-008 · Replace Sandler Selling with MEDDIC
**Priority:** Medium | **Type:** Change (removes a methodology, changes default) | **Status:** ✅ Implemented

MEDDIC's stage engine was already fully built and generic — this was a removal + defaulting + demo-narrative change, no new AI work.

**Architecture**
- `server/constants.ts`: removed `sandler` from `METHODOLOGY_STAGES`; deleted its local `METHODOLOGY_LABELS` (it was dead code server-side — grep confirmed nothing in `server/` ever imported it).
- New `shared/methodologies.ts`: `METHODOLOGY_LABELS` now lives in exactly one place, imported by both `src/pages/dashboard.tsx` and available to server code, instead of being hand-duplicated in `dashboard.tsx`.
- `server/routes.ts`: `salesMethodology` zod enum is now `["meddic", "spin", "challenger"]`.
- `src/pages/studio-settings.tsx`: Sandler card removed from `SALES_METHODOLOGIES`.
- `server/storage.ts`: `getSettings()`'s first-run seed is now `values({ salesMethodology: "meddic" })` — new installs default to MEDDIC with no schema migration needed.
- `src/pages/dashboard.tsx`: `handleStartDemo`'s account-executive branch now PATCHes `salesMethodology: "meddic"` if unset before creating the demo session, so an existing install that predates the new default still shows the methodology tracker on a fresh AE demo.
- **Correctness fix — implemented differently than originally sketched:** rather than a one-time DB patch to clear stale `"sandler"` values, `featuresForRole()`'s `methodologyTracking` now checks `!!(salesMethodology && METHODOLOGY_STAGES[salesMethodology])` instead of mere truthiness, and the dashboard's fallback label check does the same against `METHODOLOGY_LABELS`. A stale `"sandler"` value degrades gracefully to "no methodology selected" everywhere, with no DB write required. Covered by a regression test in `tests/constants.test.ts`.

**AI changes**
- None — confirmed the stage engine and prompt builder are stage-id-agnostic.

**Demo**
- `AE_DEMO_CHUNKS` updated in both `src/pages/dashboard.tsx` and `scripts/generate-demo-audio.mjs` (kept in sync, as they were before). Edited chunks 5, 6, and 11 **in place** — same 12-chunk array, same speakers/indices — rather than inserting new chunks, specifically to avoid shifting every downstream `ae-demo-N.mp3` filename. Added: an explicit ask-and-answer for quantified success metrics (audit prep time, uptime target) covering **Metrics**, and a line where Jennifer commits to championing the deal through her own steering committee, covering **Champion**.
- **Follow-up — done:** `public/demo-audio/ae-demo-5.mp3`, `ae-demo-6.mp3`, and `ae-demo-11.mp3` were regenerated against the new dialogue via `npm run generate-demo-audio` (a paid TTS call, run only after explicit confirmation). Confirmed via fresh file timestamps/sizes.

**Docs / Tests**
- `tests/constants.test.ts`: swapped example literal to `"meddic"`; added a regression test asserting `METHODOLOGY_STAGES.sandler` is gone and that a stale `"sandler"` value now disables `methodologyTracking`.
- `tests/storage.test.ts`: added a test asserting a freshly created settings row defaults to `salesMethodology: "meddic"`.
- No SETUP.md/project-nri-brand.md changes needed — neither ever mentioned Sandler by name (verified by grep before editing).

---

### BL-009 · Copy button on every result panel
**Priority:** Medium | **Type:** UX | **Status:** ✅ Implemented

Every panel that shows AI-derived or transcript text (Transcript, Show Notes, Action Items,
Follow-Ups, Requirements, Pain Points, SIPOC, Key Terms, BANT, Methodology, Competitor
Mentions, Timeline Signals, Risk Flags, Similar Projects) gets a small copy-to-clipboard icon
button in its header, so the text can be grabbed for a doc/email/Slack message without manually
selecting it.

**Architecture**
- New `src/components/copy-button.tsx` — takes a `getText: () => string` (lazy, so it always
  copies current state rather than a stale snapshot) and renders an icon button that swaps to a
  checkmark for ~1.5s on success, using `navigator.clipboard.writeText`.
- Wired into panel headers in both `src/pages/dashboard.tsx` (live session) and
  `src/pages/session-detail.tsx` (post-session review), each with a small formatter turning that
  panel's structured data into plain text.

---

### BL-010 · SIPOC connection-linking wrap-up pass
**Priority:** Medium | **Type:** Feature (BA persona) | **Status:** ✅ Implemented

Live per-chunk SIPOC extraction classifies each mention into one of five independent buckets
(suppliers/inputs/process/outputs/customers) with no cross-referencing — it has no way to know
a supplier named in chunk 2 relates to an output named in chunk 6. Fix: a **post-session
refinement pass**, fired once the full transcript is available, that traces real
supplier→input→process→output→customer chains. Mirrors `generateSummary()`'s existing
fire-once-at-session-end shape rather than inventing a new pattern.

**Architecture**
- `shared/schema.ts`: new `SIPOCLink { supplier?, input?, process?, output?, customer?,
  evidence? }` (a link is one row, so its fields are singular — deliberately distinct from
  `SIPOCData`'s plural bucket names); `SIPOCData` gains optional `links?: SIPOCLink[]` and
  `linkedAt?: string`.
- `server/services/analysis.ts`: new `linkSipocElements(sessionId, transcript)` — sends the full
  transcript plus the already-extracted flat lists (as grounding/anchoring context) to the model,
  asks it to assert only clearly-supported links, explicitly allows partial rows and leaving
  items unlinked rather than forcing weak connections. Persists onto `session.sipocData.links`.
- `server/routes.ts`: fired as a fire-and-forget background call in `PATCH /api/sessions/:id/end`
  alongside the existing `generateSummary()` call. New standalone `POST
  /api/sessions/:id/link-sipoc` endpoint (mirrors `/generate-summary`) backs a manual retry
  button for sessions where the automatic pass hasn't finished yet, or older sessions that
  predate this feature.

**UI**
- `SipocBoard` accepts an optional `links` prop. When present, renders a "Confirmed Chains" row
  per link (reusing the five-color-column visual identity, one row = one real relationship) above
  a "Not Yet Linked" section listing any flat items no link references — nothing gets silently
  dropped. Falls back to today's independent-column view when links aren't present yet (always
  true during a live call, since linking only runs at session end).
- Session-detail SIPOC tab: a "Link Suppliers → Customers" button appears when the session is
  completed and has no links yet.

**Excel / Copy**
- `formatSipoc()` and the Excel "SIPOC" sheet both render linked rows first (one row per
  confirmed chain) when available, then a "Not Yet Linked" section for anything left over —
  otherwise fall back to the original independent-columns-padded-to-max-length format.

**Follow-up — visual clarity (done):** the first version of "Confirmed Chains" gave no visual
sense that a row's 5 cells belonged together (thin gridlines only). Redesigned with a numbered
badge per row, alternating row shading, a hover highlight across the full row, and connecting
chevrons that only render between two adjacent *filled* cells (a gap in the chain shows a faint
dot instead) — so the flow reads left-to-right only where the data actually continues.

**Follow-up — "customer" role misclassification (done):** a demo chunk mentioning both a general
onboarding document requirement and a specific supplier lost to slow onboarding got linked with
the lost supplier (Cascade Industrial Supply) labeled as the "customer" of the document-collection
process — confusing, since a lost/prospective supplier isn't a customer of anything.
`linkSipocElements`'s prompt now explicitly checks whether an entity is already playing a
supplier role (current or lost/prospective) before allowing it to be labeled "customer," and
leaves the field out rather than assigning a contradictory dual role. Verified against the real
API with the exact chunk that produced the confusing result before.

**Deliberately deferred:** generalizing this same "live per-chunk extraction + one full-context
wrap-up refinement pass" pattern to other roles' structured data — BANT reconciliation across
the whole call, Requirements/Pain Points dedup, Timeline Signals/Risk Flags consolidation,
Competitor Mentions cleanup. The pattern is proven out here; extending it to every role's data
is a much larger sweep better scoped as its own follow-on once this lands and holds up in use.

**Docs / Tests**
- `tests/format-copy-text.test.ts`: linked-chain rendering + Not-Yet-Linked filtering.
- `tests/export-excel.test.ts`: linked-row SIPOC sheet, and the Not-Yet-Linked section correctly
  omitted when every item is linked.
- No unit tests for `linkSipocElements`'s AI call itself, consistent with `analyzeText`/
  `generateSummary` — none of this codebase's OpenAI-calling functions are mocked/unit-tested;
  verified instead via the real API against a running server.

---

### BL-011 · Comprehensive, formatted Excel session export
**Priority:** Medium | **Type:** UX | **Status:** ✅ Implemented

The original Excel export (built alongside BL-007) only covered the three BA-specific
sections (Requirements, Pain Points, SIPOC) with plain unstyled rows. Rebuilt as a full
session export applicable to every role — one real Excel Table per section, color-coded
sheet tabs, and a cover sheet — rather than a BA-only feature.

**Sheets** (only included when that section has data, except the always-present core ones):
Overview (title/client/industry/date/duration/summary — a cover page, not a data table),
Transcript, Key Terms, Action Items, Follow-Ups, Similar Projects always appear; Requirements,
Pain Points, SIPOC, BANT, Methodology, Competitor Mentions, Timeline Signals, and Risk Flags
appear only when the session actually has that data — so an AE session doesn't get seven empty
BA/PM/SA tabs and vice versa.

**Architecture**
- `src/lib/export-excel.ts`: `exportSessionExcel()` (renamed from `exportBaTabsExcel`) and
  `buildSessionWorkbook()` (renamed from `buildBaTabsWorkbook`). Each non-SIPOC sheet goes
  through a shared `addTableSheet()` helper that renders a real Excel Table (`worksheet.addTable`,
  banded rows, filter buttons — not just styled cells) with a distinct ARGB tab color per
  section; an empty section still gets its sheet with headers and a "No data captured in this
  section" note rather than being blank and confusing. SIPOC keeps its own custom per-column
  coloring (to preserve the S/I/P/O/C visual identity) rather than using the generic table helper.
- Extracted **`src/lib/transcript.ts`**'s existing `parseAndMergeBlocks`/`formatElapsedTimestamp`
  (already used by the live `HighlightedTranscript` component) into both the PDF and Excel
  export's transcript rendering — previously `export-pdf.ts` had its own separate inline copy of
  near-identical block-parsing logic; now there's one shared, tested implementation instead of
  two independent ones silently drifting apart.
- `src/pages/session-detail.tsx`: menu item renamed "Export BA Tabs (Excel)" → "Export All
  (Excel)"; the `hasBaTabs` visibility gate was removed since the export is now useful
  regardless of role (matches how PDF/JSON exports have no gating either).

**Docs / Tests**
- `tests/export-excel.test.ts` rewritten against `buildSessionWorkbook`: always-present vs.
  conditional sheet presence, Overview content, distinct tab colors, the "no data" placeholder,
  transcript block-splitting, and the SIPOC linked/unlinked cases carried over from BL-010.
- Verified the generated `.xlsx` structure (Table + tab color) survives a real write/read
  round-trip through ExcelJS; actual visual polish in Excel/LibreOffice itself needs a human
  to eyeball, since the export only runs in a browser context (`document.createElement`) that
  can't be driven from a server-side check the way the AI features were.

**Follow-up — PDF/JSON parity:** the PDF export was missing all 8 role-specific sections
(Requirements, Pain Points, SIPOC, BANT, Methodology, Competitor Mentions, Timeline Signals,
Risk Flags) that Excel now covers — it only ever had Key Takeaway/Host & Guests/Key Terms/
Action Items/Follow-Ups/Similar Projects/Transcript. Added all 8 to `export-pdf.ts` via a new
`renderTableSection()` helper (page-break-aware, silently skips when a section has no data —
consistent with how the PDF's existing sections already behaved, unlike Excel's always-present
placeholder sheets). JSON already needed no changes — `exportSessionJson` is a raw
`JSON.stringify` of the full session, so every field was already present. SIPOC's linked/
unlinked row computation was pulled into a new shared `src/lib/sipoc-rows.ts` (`computeSipocRows`)
used by both the PDF and Excel exports instead of writing a third copy of that logic — `export-
excel.ts`'s `addSipocSheet` was refactored to use it too. New `tests/sipoc-rows.test.ts` (4
cases) and `tests/export-pdf.browser.test.ts` (jsdom-based smoke test confirming jsPDF/autoTable
run through every section, fully populated and fully empty, without throwing — deep pixel/layout
verification isn't practical for a generated PDF, so this checks "doesn't crash," not "looks
right").

---

### BL-012 · Consistent `client_title_date` export filenames
**Priority:** Low | **Type:** UX | **Status:** ✅ Implemented

All three export formats used only a slugified title (e.g. `procurement-requirements-
workshop.pdf`), making it hard to tell sessions apart in a downloads folder full of exports
from different clients/dates, and the PDF export additionally had its own unique `-notes` suffix.

**Architecture**
- New `src/lib/export-filename.ts`: `buildExportFilename()` produces `{client}_{title}_{date}`
  (client segment omitted when the session has none), date as `YYYY-MM-DD` so files sort
  chronologically. All three export functions (`exportSessionPdf`, `exportSessionJson`,
  `exportSessionExcel`) share this one implementation instead of each having their own inline
  slug logic, and now produce the exact same base filename — a session's PDF/JSON/Excel exports
  sit together in a folder, distinguished only by extension.

**Docs / Tests**
- `tests/export-filename.test.ts` (4 cases): client/title/date joining, missing-client handling,
  punctuation/whitespace slugification, `Date` object vs. string `createdAt`.

---

## Completed

| Item | Commit |
|------|--------|
| A-04: `getAppDataDir()` helper; macOS-correct log path; `mkdirSync` for log dir | (pending) |
| A-05: `lsof` → `ss` fallback in `killProcessOnPort` for Linux without lsof | (pending) |
| A-06: `enqueueForSession()` — per-session analysis queue preventing race conditions | (pending) |
| A-08: `max_completion_tokens` raised 2048 → 4096 | (pending) |
| A-09: `getStaticPromptContext()` — 5-min TTL cache + explicit invalidation middleware | (pending) |
| A-10: `safeArray<T>()` — null-safe JSON column accessor throughout `processAnalysis` | (pending) |
| A-11: Migration error handling tightened — only ignores `already exists`, re-throws rest | (pending) |
| A-15/A-16/A-17: rate limiting, session pagination, pre-migration DB backup | `9c011c8` |
| A-07: async analysis — 202 + jobId + client polling | `e3e4d6a` |
| A-23: session export — PDF + JSON from session detail header | `ff12650` |
| A-25: re-runnable setup wizard from Studio Settings | `cff0013` |
| A-19: configurable server port via `ONTOPIC_PORT` env var | `ca45d9c` |
| A-24: topic pruning — delete individual topics from session detail | `7ec2875` |
| A-22: voice profile reliability indicator | `5655e61` |
| A-20/A-21/A-03: real FFT visualizer, device hot-swap, Linux speaker capture | `d6a2e9f` |
| Role-specific 50/50 layouts for all 5 presales roles | `cd394f2` |
| Role-driven feature flags via `featuresForRole()` | `cd394f2` |
| New AI fields: competitor mentions, timeline signals, risk flags, requirements, pain points | `cd394f2` |
| `dedupeByText` extracted to `analysis-helpers` for testability | `cd394f2` |
| Fix `findLoopbackDevice` test assertions for `{ device, channelCount, mode }` return shape | `48a0c75` |
| WASAPI loopback Strategy 1 test coverage | `48a0c75` |
| NRI brand, AE demo voiceovers, Salesforce panels, UX polish | `24bbd64` |
