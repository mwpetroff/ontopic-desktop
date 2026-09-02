# OnTopic Desktop

**A real-time PreSales Consulting Companion — native desktop edition**

> Adds system-level audio capture so OnTopic works as a silent companion during any meeting — Zoom, Teams, Webex, Google Meet — tapping directly into the OS audio stack. Both the host (mic) and remote participants (speaker loopback) are captured and transcribed independently.

## Platform Support

| OS | Status | Speaker Capture Method |
|---|---|---|
| **Windows 10 / 11** | ✅ Fully supported | Stereo Mix, VB-Audio Cable, VoiceMeeter, or any "loopback" device |
| **macOS** | 🔜 Planned (Phase 4) — deferred, needs a Mac build environment | BlackHole virtual audio driver |
| **Linux** | ✅ Implemented | `parec` against the detected PulseAudio/PipeWire monitor source |

## What's Different from the Web App

| Feature | Web App | Desktop App |
|---|---|---|
| Microphone capture | Browser getUserMedia | OS audio API (naudiodon / PortAudio) |
| Speaker capture | Not possible | WASAPI loopback (Win) / BlackHole (Mac) / PulseAudio (Linux) |
| Speaker labeling | Single-stream diarization | Clean 2-stream split (mic = you, speaker = them) |
| Database | PostgreSQL (hosted) | SQLite (`%APPDATA%\OnTopic\database.sqlite`) |
| Auth | Replit OpenID Connect | Always-authenticated local user (real auth planned) |
| API key | Replit secrets | Stored in OS keychain via Electron safeStorage |
| Meeting app requirement | Browser tab | Works alongside any app |
| Distribution | Web URL | Installer (.exe / .dmg / .AppImage) |

## Architecture

```
Electron Main Process
  ├── Single-instance lock          prevents duplicate app windows
  ├── Express server (port 3000)    spawned as child process via tsx
  │     ├── SQLite via better-sqlite3 + Drizzle ORM
  │     ├── Auth stub (always authenticated)
  │     └── All original API routes unchanged
  ├── MicCapture                    naudiodon (PortAudio) — selected or default input device
  ├── SpeakerCapture                WASAPI loopback (Win) / BlackHole (Mac) / parec (Linux)
  ├── AudioMixer                    labels PCM chunks "mic" or "speaker", fires onChunk every 5s
  ├── IPC Bridge                    pushes audio:chunk events to renderer
  └── Electron safeStorage          encrypts OpenAI API key in OS keychain

Electron Renderer (Vite + React)
  ├── Proxies /api → localhost:3000  retries on 502 (startup race)
  ├── useAudioCapture               replaces getUserMedia; receives IPC audio chunks
  ├── Role-specific layouts         50/50 video+tool split tailored per role (SA/SE/PM/BA/AE)
  ├── Low-audio warning             alerts after 10 s of silence during a live session
  └── All existing OnTopic UI       sessions, topics, partners, competencies, analytics
```

## Prerequisites

- **Node.js 18+** (20 LTS or 22 LTS recommended)
- **Windows 10 / 11:** Enable **Stereo Mix** in Sound → Recording devices, **or** install [VB-Audio Cable](https://vb-audio.com/Cable/) (free) for speaker loopback
- **macOS** _(future)_: Install [BlackHole](https://github.com/ExistentialAudio/BlackHole) — prompted on first launch
- **Linux** _(future)_: PulseAudio or PipeWire — no setup needed on modern desktop distros

## Development

```bash
npm install        # Also rebuilds naudiodon for the installed Electron version (postinstall hook)
npm run dev        # Starts Vite (port 5173) + Electron (which spawns Express on port 3000)
```

> **Native module note:** `naudiodon` is a native addon compiled against Electron's embedded Node.js runtime. `npm install` handles this via the `postinstall` hook (`electron-rebuild -w naudiodon`). If you see a "NODE_MODULE_VERSION mismatch" crash at startup, run `npm run rebuild`. `better-sqlite3` stays compiled for system Node.js so tests and the Express server work normally.

On first launch the app auto-creates `%APPDATA%\OnTopic\database.sqlite` and seeds it with sample data.

The OpenAI API key is stored securely in the OS keychain via Electron `safeStorage` and set through the Studio Settings UI. You can also pre-set it via `.env` for development:

```
OPENAI_API_KEY=sk-...
```

## Testing

```bash
npm test           # Run full test suite (vitest, 358 tests)
npm run test:watch # Watch mode
```

Tests use an isolated temporary SQLite database and never touch the production database.

| Test file | What it covers |
|---|---|
| `analysis-helpers.test.ts` | Speaker resolution, sentiment aggregation, BANT merge, methodology stages, `applySipocUpdates`, `persistSessionUpdates` DB writes, `dedupeByText` |
| `constants.test.ts` | `featuresForRole` for all 5 roles, salesMethodology flag toggling, stale-methodology regression guard |
| `analytics.test.ts` | Competency match scoring, topic similarity detection |
| `schema.test.ts` | Drizzle-Zod insert schemas, field stripping, JSON array columns |
| `storage.test.ts` | Full CRUD lifecycle for all entities against real SQLite, settings defaults |
| `transcript.test.ts` | Block parsing, timestamp formatting, speaker accumulation |
| `validation.test.ts` | Zod validation schemas for API request bodies |
| `audio-mixer.test.ts` | PCM buffering, chunk sizing, label isolation, stop/flush |
| `mic-capture.test.ts` | MicCapture lifecycle, mock portAudio, event emitters |
| `speaker-capture-win.test.ts` | Windows loopback — WASAPI output strategy, named device lookup (Stereo Mix, VB-Cable, VoiceMeeter), error handling |
| `auth-stub.test.ts` | Auth endpoints (login, logout, /api/auth/user) |
| `auth-utils.test.ts` | `isUnauthorizedError` classification |
| `date.test.ts` | `formatDate`/`formatDuration` display helpers |
| `queryClient.test.ts` | TanStack Query retry/retryDelay policy (502/503/504 startup races) |
| `speaker-colors.test.ts` | Deterministic speaker → color assignment |
| `speaker-match.test.ts` | Voice-profile speaker matching |
| `use-audio-capture.browser.test.ts` | `useAudioCapture` web (non-Electron) fallback path |
| `format-copy-text.test.ts` | Plain-text formatters behind every panel's copy button |
| `sipoc-rows.test.ts` | Shared SIPOC linked/unlinked row computation (PDF + Excel exports) |
| `export-excel.test.ts` | `buildSessionWorkbook` — sheet presence/absence per role, tab colors, SIPOC linked/unlinked rendering |
| `export-pdf.browser.test.ts` | `exportSessionPdf` smoke test — every section populated, and none populated, without throwing |
| `export-filename.test.ts` | `client_title_date` filename slug shared by PDF/JSON/Excel exports |

> **After any `npm install`:** Run `npm test` to verify `better-sqlite3` wasn't accidentally rebuilt for Electron. If tests fail with a MODULE_VERSION error, run `npm rebuild better-sqlite3`.

## Build

```bash
npm run build:win    # Windows NSIS installer
npm run build:mac    # macOS DMG
npm run build:linux  # Linux AppImage
```

## Roadmap

- [x] Phase 1: Electron shell + project scaffold
- [x] Phase 2: Microphone capture via naudiodon
- [x] Phase 3: WASAPI loopback speaker capture — Windows (Stereo Mix + VB-Cable + VoiceMeeter)
- [x] Phase 2.5: Frontend migrated from web app + SQLite backend
- [x] API key stored in OS keychain via Electron safeStorage
- [x] Single-instance lock + port conflict recovery
- [x] Role-specific 50/50 layouts (SA/SE/PM/BA/AE) + low-audio warning
- [ ] Phase 4: BlackHole + CoreAudio — macOS (deferred, needs a Mac build environment)
- [x] Phase 5: PulseAudio monitor — Linux (via `parec`)
- [ ] Phase 6: Local Whisper (audio stays on-device)
- [ ] Phase 7: Code signing + auto-update + distribution

## Key Files

| File | Purpose |
|---|---|
| `electron/main.js` | BrowserWindow, tray, single-instance lock, IPC handlers, audio lifecycle, spawns Express |
| `electron/preload.js` | contextBridge — exposes `window.electronAudio.*` to renderer |
| `electron/audio/mic-capture.js` | naudiodon — selected or default input device capture at 16 kHz |
| `electron/audio/speaker-capture-win.js` | Windows loopback via naudiodon: Stereo Mix, VB-Cable, VoiceMeeter, or any device containing "loopback" |
| `electron/audio/speaker-capture-mac.js` | macOS stub (BlackHole — Phase 4) |
| `electron/audio/speaker-capture-linux.js` | Linux — `parec` against the detected PulseAudio/PipeWire monitor source |
| `electron/audio/audio-mixer.js` | Buffers PCM, labels chunks "mic"/"speaker", fires onChunk every 5 s |
| `server/index.ts` | Express server entry — auth, routes, SQLite startup |
| `server/auth.ts` | Always-true auth stub (login/logout/me routes + isAuthenticated middleware) |
| `server/db.ts` | better-sqlite3 + Drizzle ORM, DB path from `APPDATA/OnTopic/` |
| `server/storage.ts` | DatabaseStorage class — all entity CRUD |
| `shared/schema.ts` | Drizzle SQLite schema + Zod insert schemas |
| `src/hooks/use-audio-capture.ts` | React hook replacing getUserMedia — receives IPC audio chunks |
| `src/lib/queryClient.ts` | TanStack Query client — retries 502/503/504 automatically at startup |
| `src/pages/dashboard.tsx` | Live session UI — role-specific layouts (SA/SE/PM/BA/AE), HighlightedTranscript, low-audio warning |
| `server/constants.ts` | `featuresForRole()` — maps each role to its AI feature flags; role label/focus/summary copy |

## Technical Plan

See [docs/desktop-audio-capture-plan.md](docs/desktop-audio-capture-plan.md) for the full audio architecture.

See [SETUP.md](SETUP.md) for the full dependency, configuration, and troubleshooting guide.
