# OnTopic Desktop — Setup & Configuration Guide

## System Requirements

| | Minimum | Notes |
|---|---|---|
| **Node.js** | 18+ | 20 LTS or 22 LTS recommended |
| **npm** | 8+ | Comes with Node.js |
| **OS** | Windows 10 / 11 | macOS support planned (Phase 4) |
| **RAM** | 4 GB | 8 GB recommended (Electron + Express) |
| **Disk** | 500 MB | For node_modules + Electron binaries |

---

## First-Time Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd ontopic-desktop
npm install
```

> `npm install` automatically runs `electron-rebuild -w naudiodon` via the `postinstall` hook.
> This compiles naudiodon's native C++ code against Electron's embedded Node.js runtime.
> **Do not skip this step.** If you see a `NODE_MODULE_VERSION mismatch` error at startup,
> re-run: `npm run rebuild`

### 2. Configure your OpenAI API key

The recommended way is to set it through the app's **Studio Settings** page once running — it gets stored securely in the OS keychain via Electron `safeStorage`.

For development, you can also pre-set it in a `.env` file (never committed):

```bash
cp .env.example .env
```

Edit `.env`:
```
OPENAI_API_KEY=sk-proj-...
```

The `.env` file is read by:
- `electron/main.js` before spawning the Express server (in Electron mode)
- `server/index.ts` via `import "dotenv/config"` when running standalone

The safeStorage key (set via the UI) takes precedence over `.env`.

### 3. Verify setup

```bash
npm test
```

All 208 tests should pass. If any fail, see the [Troubleshooting](#troubleshooting) section.

---

## Running in Development

```bash
npm run dev
```

This starts three processes concurrently:

| Process | Port | Description |
|---|---|---|
| Vite dev server | 5173 | Frontend with HMR |
| Electron app | — | Loads http://localhost:5173 |
| Express backend | 3000 | Spawned by Electron's main process |

> **tsx does not hot-reload the server.** After changing any file in `server/`, you must fully
> quit and relaunch Electron for changes to take effect. On Windows, `Ctrl+C` in the terminal
> may leave a ghost `node.exe` holding port 3000 — if you see `EADDRINUSE` on restart, kill it:
> ```powershell
> Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
> ```

### Running the server standalone (without Electron)

```bash
npm run server
```

The server starts on port 3000 and reads `.env` from the project root. Useful for testing API
endpoints directly. The frontend is still served from Vite on port 5173 (run `npm run dev`
or just `vite` in a second terminal).

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | **Yes** | — | OpenAI API key for Whisper transcription and GPT analysis |
| `PORT` | No | `3000` | Express server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `ELECTRON` | No | — | Set to `"true"` by Electron main process; skips Vite/static serving |
| `DATABASE_PATH` | No | `%APPDATA%/OnTopic/database.sqlite` | Override SQLite file location (used by tests) |

---

## Windows-Specific: Speaker Capture

To capture remote meeting participant audio (Zoom, Teams, Webex, etc.), Windows needs a loopback capture device. OnTopic automatically detects any device whose name contains:

| Priority | Device name fragment | Source |
|---|---|---|
| 1 | `stereo mix` | Built-in Windows mixer (requires enabling) |
| 2 | `what u hear` | Some SoundBlaster cards |
| 3 | `wave out mix` | Older Realtek drivers |
| 4 | `mix output` | Various |
| 5 | `cable output` | **VB-Audio Cable** (recommended if no Stereo Mix) |
| 6 | `voicemeeter output` | VoiceMeeter |
| 7 | `voicemeeter vaio` | VoiceMeeter Banana/Potato |
| 8 | `loopback` | Generic virtual cables |

### Option A — Enable Stereo Mix (no extra software)

1. Right-click the speaker icon in the taskbar → **Sound settings**
2. Click **More sound settings** → **Recording** tab
3. Right-click in the device list → **Show Disabled Devices**
4. Right-click **Stereo Mix** → **Enable**

> Not all hardware has Stereo Mix. It is disabled on many modern laptops with Realtek audio.

### Option B — VB-Audio Cable (recommended, free)

1. Download and install [VB-Audio Cable](https://vb-audio.com/Cable/) (free)
2. In Windows Sound settings, set **CABLE Input** as your playback device (or use it alongside your normal speakers in a multi-output arrangement)
3. OnTopic detects it automatically — no further configuration needed

If neither is available, mic-only capture still works. The app will show a **"Speaker capture unavailable"** banner at the top of the session.

---

## macOS-Specific: Speaker Capture (BlackHole)

> **Note:** macOS speaker capture is not yet implemented (stub only). These instructions
> apply once Phase 4 is complete.

1. Install [BlackHole 2ch](https://github.com/ExistentialAudio/BlackHole) (free)
2. Open **Audio MIDI Setup** → Create a **Multi-Output Device** combining your speakers + BlackHole
3. Set the Multi-Output Device as your system output
4. OnTopic will detect BlackHole as the loopback input

---

## Linux-Specific: Speaker Capture (PulseAudio / PipeWire)

Implemented via `parec` against the detected PulseAudio/PipeWire monitor source (A-03).

PulseAudio monitor sources are automatically available — no setup needed on most desktop distros.
PipeWire (Fedora 34+, Ubuntu 22.04+) is also supported via the PulseAudio compatibility layer.

---

## Database

The app uses SQLite. The database file is created automatically on first launch.

| Environment | Location |
|---|---|
| Windows | `%APPDATA%\OnTopic\database.sqlite` |
| macOS | `~/Library/Application Support/OnTopic/database.sqlite` |
| Linux | `~/.local/share/OnTopic/database.sqlite` |
| Tests | Temporary file in OS temp dir (auto-deleted after tests) |

**Migrations** run automatically on startup via `drizzle-orm/better-sqlite3/migrator`.
If the database was created via `drizzle-kit push` (no migration history), migration errors
are silently ignored — the app functions normally.

**Reset the database** (deletes all sessions and settings):
```bash
# Windows
rm "$env:APPDATA\OnTopic\database.sqlite"

# macOS / Linux
rm ~/Library/"Application Support"/OnTopic/database.sqlite
```

The database is re-created and seeded with demo data on next launch.

---

## Key Dependencies

### Native Modules (require compilation)

| Package | Purpose | Rebuild Target |
|---|---|---|
| `naudiodon` | PortAudio wrapper for mic + loopback capture | **Electron** — rebuilt automatically via postinstall |
| `segfault-handler` | Crash reporter (naudiodon dependency) | **Electron** — rebuilt automatically via postinstall |
| `better-sqlite3` | Synchronous SQLite driver | **System Node.js** — must NOT be rebuilt for Electron |

> These modules have conflicting rebuild targets. The `postinstall` script rebuilds
> `naudiodon,segfault-handler` (naudiodon's native dependency). If `better-sqlite3` gets
> rebuilt for Electron (e.g., by `electron-rebuild` with no `-w` filter), tests and the
> server will fail. Fix with: `npm rebuild better-sqlite3`

### Backend
| Package | Purpose |
|---|---|
| `express` v5 | HTTP server framework |
| `drizzle-orm` | Type-safe ORM for SQLite |
| `drizzle-zod` | Auto-generate Zod schemas from Drizzle tables |
| `openai` v6 | ChatCompletion (GPT-4o-mini) + Whisper transcription |
| `dotenv` | Load `.env` file into `process.env` |
| `ws` | WebSocket support |
| `multer` | Audio file upload handling |
| `zod` | Runtime request validation |
| `express-session` | Session middleware (MemoryStore — single user, no persistence needed) |

### Frontend
| Package | Purpose |
|---|---|
| `react` v19 | UI library |
| `@tanstack/react-query` v5 | Server state, caching, background refetching |
| `wouter` | Lightweight client-side router |
| `@radix-ui/*` (15 packages) | Accessible headless UI components |
| `tailwindcss` | Utility-first CSS |
| `lucide-react` | Icon library |
| `recharts` | Chart library (analytics page) |
| `jspdf` + `html2canvas` | PDF export |
| `date-fns` | Date formatting |

### Electron / Desktop
| Package | Purpose |
|---|---|
| `electron` v31 | Desktop shell |
| `electron-store` | Persistent key-value store (legacy API key fallback) |
| `naudiodon` | PortAudio — mic input + Windows Stereo Mix loopback |

### Dev / Build
| Package | Purpose |
|---|---|
| `vite` v8 | Frontend bundler + HMR dev server |
| `@vitejs/plugin-react` | React Fast Refresh |
| `tsx` | TypeScript execution for server (no compile step in dev) |
| `electron-builder` | Cross-platform installer packaging |
| `@electron/rebuild` | Recompile native modules for Electron ABI |
| `vitest` v4 | Test runner |
| `drizzle-kit` | Migration generation + `drizzle-kit push` for dev |
| `concurrently` | Run Vite + Electron in parallel (`npm run dev`) |
| `wait-on` | Wait for Vite to be ready before launching Electron |

---

## Build for Distribution

```bash
npm run build:win    # Windows — produces .exe installer (NSIS)
npm run build:mac    # macOS  — produces .dmg
npm run build:linux  # Linux  — produces .AppImage
```

Output goes to `dist-electron/`. The build bundles:
- Electron runtime
- `dist/` (Vite production build of the frontend)
- `electron/` (main process + audio capture modules)
- Native modules (pre-compiled for the target platform)

> Code signing is not yet configured (Phase 7). Unsigned builds will show OS security warnings.

---

## Troubleshooting

### `NODE_MODULE_VERSION mismatch` at startup
naudiodon was compiled for the wrong Node.js ABI. Run:
```bash
npm run rebuild
```

### `better-sqlite3` tests fail after `npm install`
The module was accidentally rebuilt for Electron. Fix:
```bash
npm rebuild better-sqlite3
```
Then re-run `npm test` to confirm.

### `EADDRINUSE: address already in use 127.0.0.1:3000`
A ghost server process is still running from a previous session. Kill it:
```powershell
# Windows PowerShell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
```
```bash
# macOS / Linux
lsof -ti:3000 | xargs kill -9
```

### `demo-analyze` or `/api/sessions/:id/analyze` returns 500 with no detail
The server is running stale code (tsx doesn't hot-reload). Fully quit and relaunch the app.
The error detail is logged to `%APPDATA%\OnTopic\server.log`.

### Stereo Mix not detected on Windows
1. Check Stereo Mix is enabled (see [Windows Speaker Capture](#windows-specific-speaker-capture))
2. Check the device name in **Recording devices** — OnTopic scans for: `stereo mix`, `what u hear`, `wave out mix`, `mix output`, `cable output`, `voicemeeter output`, `loopback`
3. If your device uses a different name, install **VB-Audio Cable** (free) as the loopback source
4. Mic-only capture still works if no loopback device is found

### OpenAI API errors (401, 429, 500)
- **401**: Invalid API key — check `OPENAI_API_KEY` in `.env`
- **429**: Rate limit hit — the app retries automatically (3 attempts with exponential backoff); if persistent, check your OpenAI usage tier
- **500**: OpenAI server error — retried automatically; analysis falls back gracefully (empty terms returned, session is not broken)
