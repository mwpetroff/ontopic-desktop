# NRI North America OnTopic — Product Backlog

## BL-001 · Keep React and Electron versions always in sync
**Priority:** High | **Type:** Process / Engineering

Ensure that feature parity, documentation, and unit tests are maintained across both the React web version and the Electron desktop shell at all times.

**Scope:**
- Any feature added to the React frontend must be verified functional in Electron (IPC, file paths, CSP, offline behaviour)
- CLAUDE.md and SETUP.md must reflect both runtime targets
- Unit tests must cover paths exercised in both environments (e.g. API base URL differences, `window.electronAudio` presence checks)
- CI / build scripts should run both `npm test` (Node/Vitest) and a smoke build of the Electron package
- Checklist item added to PR template: "Tested in Electron dev mode?"

---

## BL-002 · Demo features worth promoting to the real product
**Priority:** Medium | **Type:** Feature / Discovery

Features built specifically for the demo experience that have value in the production product and should be evaluated for full implementation.

| Demo feature | Production consideration |
|---|---|
| Word-by-word transcript streaming (timed to audio) | Real transcription already streams; ensure the live transcript panel scrolls and reveals text incrementally rather than appending whole chunks |
| Explicit speaker override per segment | Expose a "correct speaker" affordance in the live transcript so users can fix misattributions in real time |
| Named persona voices (TTS per speaker) | Not applicable to production audio capture, but the speaker-colour / label system could be surfaced more prominently |
| Unnamed "Speaker N" auto-labelling | Already works in production via `resolveSpeaker`; consider adding a one-click "Name this speaker" prompt in the transcript UI |
| Realistic sales-call script with NDA, action items, BANT flow | Use as a reference for onboarding copy and demo environment for prospects |
| Demo session auto-cleanup (reference project teardown) | Extend to let users "reset demo data" from Settings without a full reinstall |

---

## BL-003 · Salesforce Opportunity box on the Account Executive live session screen
**Priority:** High | **Type:** Feature**Status:** ✅ Implemented (v0.1 — read-only, derived from BANT + session data)

A 4th panel in the AE-mode pinned top row that surfaces key Salesforce Opportunity fields as they are extracted live from the call. Fields auto-populate from BANT data, speaker detection, and session metadata.

**Fields (v0.1):**
- Opportunity Name (from session title)
- Account (from clientName)
- Stage (static "Discovery" for now; future: derived from methodology stage)
- Amount (from BANT budget)
- Close Date (from BANT timeline)
- Primary Contact (from first identified speaker)
- Decision Maker (from BANT authority)

**Future iterations:**
- Editable inline fields
- Stage picker tied to methodology progress
- "Copy to clipboard" / "Push to Salesforce" from the live session panel
- Salesforce OAuth integration (see BL-005)

---

## BL-004 · Salesforce Opportunity tab on the Sessions / Session Detail page
**Priority:** High | **Type:** Feature | **Status:** ✅ Implemented (v0.1 — read-only + non-functional Push button)

A dedicated "Salesforce Opp" tab in the session detail view that aggregates the opportunity data from the completed session and provides a "Push to Salesforce" button.

**v0.1 behaviour:**
- Tab appears on all completed sessions
- Data derived from session fields (BANT, speakers, action items, title, client)
- "Push to Salesforce" button shows a "Coming soon" toast

**Future iterations:**
- Salesforce Connected App OAuth flow
- Field mapping configuration (user can choose which SFDC fields map to which session fields)
- Two-way sync: pull existing Opp from SFDC to pre-populate session metadata
- Activity / Call Log creation in addition to Opportunity update

---

## BL-005 · Salesforce OAuth integration
**Priority:** Low (depends on BL-003 / BL-004) | **Type:** Integration

Full Salesforce Connected App integration so the "Push to Salesforce" button in BL-004 actually creates/updates an Opportunity record.

**Scope:**
- OAuth 2.0 Connected App setup (client credentials stored via Electron `safeStorage`)
- REST API: `PATCH /services/data/v59.0/sobjects/Opportunity/{id}`
- Field mapping UI in Settings
- Error handling for permission / validation failures
- Sandbox vs. production org toggle

---

## BL-006 · React / Electron sync — unit test coverage gaps
**Priority:** Medium | **Type:** Engineering (child of BL-001)

Current test suite (177 tests) covers server-side logic. Missing coverage:

- `useAudioCapture` hook behaviour when `window.electronAudio` is absent (web fallback path)
- `processDemoChunk` word-streaming and audio fallback logic
- `resolveSpeaker` edge cases (NEW_SPEAKER, voiceMatch override, consecutive same-speaker)
- Salesforce data derivation logic (once extracted to a shared helper)
- Session-detail tab rendering for sessions with/without BANT data
