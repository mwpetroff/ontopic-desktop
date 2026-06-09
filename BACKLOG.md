# OnTopic Desktop — Backlog

---

## Architecture — P0: Blocks macOS / Linux shipping

> **macOS items (A-01, A-02, A-13) are deferred until a Mac build environment is available.** All context is preserved below so they can be picked up without re-investigation.

| # | Item | Notes |
|---|------|-------|
| A-01 | **macOS speaker capture** *(deferred — needs Mac)* | Bundle BlackHole installer; call Swift/ObjC helper to create Multi-Output Device via CoreAudio; open BlackHole 2ch via naudiodon. `speaker-capture-mac.js` is a no-op stub. The setup wizard opens a GitHub wiki — needs to instead bundle and silently install the .pkg. Requires `NSMicrophoneUsageDescription` (see A-02). |
| A-02 | **macOS entitlements** *(deferred — needs Mac)* | Add `NSMicrophoneUsageDescription` + `com.apple.security.device.audio-input` entitlement to `electron-builder.yml`. App will be rejected by Gatekeeper without this. Also add `com.apple.security.files.user-selected.read-write` if the aggregate-device setup helper writes to system audio prefs. |
| A-03 | **Linux speaker capture** | Implement `parec` spawn or naudiodon PulseAudio backend. `speaker-capture-linux.js` has `_getMonitorSource()` implemented but never called — the `parec` spawn code is in comments on lines 52-59. Detect PulseAudio vs PipeWire (`pactl info`). Check `audio` group membership (`groups | grep audio`) and emit a clear error if missing. |
| ~~A-04~~ | ~~Platform-conditional server spawn~~ | ✅ Done — extracted `getAppDataDir()` helper; `loadEnvFile()` and `startServer()` log path both use it. Spawn itself was already platform-conditional. |
| ~~A-05~~ | ~~Platform-conditional port cleanup~~ | ✅ Done — `killProcessOnPort` Unix branch now tries `lsof` first, falls back to `ss` (iproute2) for minimal Linux. `mkdirSync` added for log directory. |

---

## Architecture — P1: Correctness and reliability

| # | Item | Notes |
|---|------|-------|
| ~~A-06~~ | ~~Session analysis queue~~ | ✅ Done — `enqueueForSession()` serializes `/analyze` and `/demo-analyze` per `sessionId` using a chained Promise map. |
| A-07 | **Analysis async response** | `/analyze` blocks the HTTP connection for the full Whisper + GPT round-trip (2–8 s). Return `202 + jobId` immediately; deliver result via polling or SSE. Prevents UI retry storms on slow calls. |
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
| A-15 | **Rate limiting on `/analyze`** | No throttle on the analysis endpoint. A user or a bug can spam it and run up OpenAI costs. Add per-session request throttle. |
| A-16 | **Pagination on sessions list** | `getAllSessions()` returns the full table. Add `limit`/`offset` to storage, route, and UI. |
| A-17 | **Database backup before migration** | Copy `.sqlite` → `.sqlite.bak` before `migrate()` runs so a bad migration doesn't destroy user data. |

---

## Architecture — P3: Quality of life

| # | Item | Notes |
|---|------|-------|
| A-18 | **Database encryption at rest** | The SQLite file containing transcripts, BANT data, and client details is plaintext. Use SQLCipher or a key derived from `safeStorage` to protect sensitive meeting data on shared machines. |
| A-19 | **Configurable ports and timeouts** | Port 3000, port 5173, server startup timeout, and chunk size are hardcoded across 5+ files. Consolidate into a single config file. |
| A-20 | **Audio level visualization fix** | `use-audio-capture.ts` synthesizes a flat `fill(-100 + level * 100)` spectrum instead of FFT. Replace with Web Audio API `AnalyserNode` for real frequency bars. |
| A-21 | **Device hot-swap** | `useAudioCapture` doesn't react to `deviceId` changes after `startCapture()` is called. Detect the change and restart the stream without a manual stop/start. |
| A-22 | **Voice profile confidence feedback** | The UI has no indication of whether a profile has enough training samples. Expose sample count + confidence score so users know when speaker identification is reliable. |
| A-23 | **Session export** | Export transcript, action items, BANT, and sentiment as PDF / JSON / CSV. |
| A-24 | **Topic pruning** | Topics accumulate unbounded per session. Cap at a configurable limit; merge near-duplicates on save. |
| A-25 | **Re-runnable setup wizard** | The platform setup check runs only once (`wizardCompleted` flag). Add a menu item to re-run it for troubleshooting audio issues. |

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
| Role-specific 50/50 layouts for all 5 presales roles | `cd394f2` |
| Role-driven feature flags via `featuresForRole()` | `cd394f2` |
| New AI fields: competitor mentions, timeline signals, risk flags, requirements, pain points | `cd394f2` |
| `dedupeByText` extracted to `analysis-helpers` for testability | `cd394f2` |
| Fix `findLoopbackDevice` test assertions for `{ device, channelCount, mode }` return shape | `48a0c75` |
| WASAPI loopback Strategy 1 test coverage | `48a0c75` |
| NRI brand, AE demo voiceovers, Salesforce panels, UX polish | `24bbd64` |
