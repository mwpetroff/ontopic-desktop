# OnTopic Desktop

**A real-time PreSales Consulting Companion — native desktop edition**

> Migrated from the [OnTopic web app](https://github.com/mwpetroff/ontopic-web). Adds system-level audio capture so OnTopic works as a silent companion during any meeting — Zoom, Teams, Webex, Google Meet, or any other conferencing tool — by tapping directly into the OS audio stack.

## What's Different from the Web App

| Feature | Web App | Desktop App |
|---|---|---|
| Microphone capture | Browser getUserMedia | OS audio API (naudiodon / PortAudio) |
| Speaker capture | Not possible | WASAPI loopback (Win) / BlackHole (Mac) / PulseAudio (Linux) |
| Speaker labeling | Single-stream diarization | Clean 2-stream split (mic = you, speaker = them) |
| Database | PostgreSQL (hosted) | SQLite (`%APPDATA%\OnTopic\database.sqlite`) |
| Auth | Replit OpenID Connect | Always-authenticated local user (real auth planned) |
| API key | Replit secrets | Stored locally via electron-store |
| Meeting app requirement | Browser tab | Works alongside any app |
| Distribution | Web URL | Installer (.exe / .dmg / .AppImage) |

## Architecture

```
Electron Main Process
  ├── Express server (port 3000)   spawned as child process via tsx
  │     ├── SQLite via better-sqlite3 + Drizzle ORM
  │     ├── Auth stub (always authenticated)
  │     └── All original API routes unchanged
  ├── MicCapture                   naudiodon (PortAudio) — default input device
  ├── SpeakerCapture               WASAPI loopback (Win) / BlackHole (Mac) / parec (Linux)
  ├── AudioMixer                   labels PCM chunks as "mic" or "speaker", fires onChunk
  ├── IPC Bridge                   pushes audio:chunk events to renderer
  └── electron-store               persists OpenAI API key across sessions

Electron Renderer (Vite + React)
  ├── Proxies /api → localhost:3000
  ├── useAudioCapture              replaces getUserMedia; receives IPC audio chunks
  └── All existing OnTopic UI      sessions, topics, partners, competencies, analytics
```

## Prerequisites

- Node.js 18+
- Windows: Enable **Stereo Mix** in Sound settings → Recording devices (for speaker loopback)
- macOS: Install [BlackHole](https://github.com/ExistentialAudio/BlackHole) (prompted on first launch)
- Linux: PulseAudio or PipeWire (standard on modern desktop distros)

## Development

```bash
npm install        # Also rebuilds naudiodon for the installed Electron version (postinstall hook)
npm run dev        # Starts Vite (port 5173) + Electron (which spawns Express on port 3000)
```

> **Native module note:** `naudiodon` is a native addon and must be compiled against Electron's embedded Node.js runtime, not the system Node.js. `npm install` handles this automatically via the `postinstall` hook (`electron-rebuild -w naudiodon`). If you ever see a "NODE_MODULE_VERSION mismatch" crash at startup, run `npm run rebuild` to fix it. `better-sqlite3` stays compiled for system Node.js so the test suite and the spawned Express server continue to work normally.

On first launch the app auto-creates `%APPDATA%\OnTopic\database.sqlite` and seeds it with sample data.

Set your OpenAI API key in the app's Settings panel — it is stored via `electron-store` and passed to the Express server at startup.

## Testing

```bash
npm test           # Run full test suite (vitest, 177 tests)
npm run test:watch # Watch mode
```

Tests use an isolated temporary SQLite database and never touch the production database.

| Test file | What it covers |
|---|---|
| `analysis-helpers.test.ts` | Speaker resolution, sentiment aggregation, BANT merge, methodology stages |
| `analytics.test.ts` | Competency match scoring, topic similarity detection |
| `schema.test.ts` | Drizzle-Zod insert schemas, field stripping, JSON array columns |
| `storage.test.ts` | Full CRUD lifecycle for all entities against real SQLite |
| `transcript.test.ts` | Block parsing, timestamp formatting, speaker accumulation |
| `validation.test.ts` | Zod validation schemas for API request bodies |
| `audio-mixer.test.ts` | PCM buffering, chunk sizing, label isolation, stop/flush |
| `auth-stub.test.ts` | Auth endpoints (login, logout, /api/auth/user) |

## Build

```bash
npm run build:win    # Windows NSIS installer
npm run build:mac    # macOS DMG
npm run build:linux  # Linux AppImage
```

## Roadmap

- [x] Phase 1: Electron shell + project scaffold
- [x] Phase 2: Microphone capture via naudiodon
- [x] Phase 3: WASAPI loopback speaker capture — Windows
- [x] Phase 2.5: Frontend migrated from web app + SQLite backend
- [ ] Phase 4: BlackHole + CoreAudio — macOS
- [ ] Phase 5: PulseAudio monitor — Linux
- [ ] Phase 6: Local Whisper (audio stays on-device)
- [ ] Phase 7: Code signing + auto-update + distribution

## Key Files

| File | Purpose |
|---|---|
| `electron/main.js` | BrowserWindow, tray, IPC handlers, audio lifecycle, spawns Express |
| `electron/preload.js` | contextBridge — exposes `window.electronAudio.*` to renderer |
| `electron/audio/mic-capture.js` | naudiodon default input device capture |
| `electron/audio/speaker-capture-win.js` | WASAPI loopback via naudiodon device ID |
| `electron/audio/audio-mixer.js` | Buffers PCM, labels chunks, fires onChunk every N ms |
| `server/index.ts` | Express server entry — auth, routes, SQLite startup |
| `server/auth.ts` | Always-true auth stub (login/logout/me routes + isAuthenticated middleware) |
| `server/db.ts` | better-sqlite3 + Drizzle ORM, DB path from `APPDATA/OnTopic/` |
| `server/storage.ts` | DatabaseStorage class — all entity CRUD |
| `shared/schema.ts` | Drizzle SQLite schema + Zod insert schemas |
| `src/hooks/use-audio-capture.ts` | React hook replacing getUserMedia — receives IPC audio chunks |

## Technical Plan

See [docs/desktop-audio-capture-plan.md](docs/desktop-audio-capture-plan.md) for the full audio architecture.
