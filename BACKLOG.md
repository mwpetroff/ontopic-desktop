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

**Demo**
- Correction from the original sketch: the BA (correspondent) role has its own dedicated demo — `BA_DEMO_CHUNKS` in `src/pages/dashboard.tsx`, "Procurement Requirements Workshop" (Rachel Torres et al. at Northgate Group) — not the generic "Cloud Migration Review" script, which is actually the **engineer** role's demo. The procurement script already reads like a rough SIPOC (suppliers being onboarded, invoices/POs as inputs, approval workflows as process, audit trails as outputs, procurement leadership as customers), so no new recordings were added — validate coverage after a manual demo run and only add lines for a category that stays empty.

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
- **Follow-up required, not done here:** `public/demo-audio/ae-demo-5.mp3`, `ae-demo-6.mp3`, and `ae-demo-11.mp3` already exist on disk and now say the old dialogue while the transcript streams the new text. Regenerating them requires running `npm run generate-demo-audio` with a real `OPENAI_API_KEY` (a paid TTS call) — not run as part of this change; delete those three files and re-run the script when ready.

**Docs / Tests**
- `tests/constants.test.ts`: swapped example literal to `"meddic"`; added a regression test asserting `METHODOLOGY_STAGES.sandler` is gone and that a stale `"sandler"` value now disables `methodologyTracking`.
- `tests/storage.test.ts`: added a test asserting a freshly created settings row defaults to `salesMethodology: "meddic"`.
- No SETUP.md/project-nri-brand.md changes needed — neither ever mentioned Sandler by name (verified by grep before editing).

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
