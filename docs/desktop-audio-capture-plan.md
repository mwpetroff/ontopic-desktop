# OnTopic Desktop — System-Level Audio Capture
## Technical Planning Document

**Purpose:** Define the architecture, technology choices, platform requirements, and implementation roadmap for converting OnTopic from a browser-based web app into a native desktop application capable of capturing microphone input and speaker/headset output at the OS level, independent of any specific meeting application.

---

## 1. The Core Problem

The current OnTopic web app uses the browser's `getUserMedia` API, which only captures the microphone the browser is given permission to access. This means:

- It cannot hear the **remote participants** (the audio coming through speakers/headset)
- If you're in Zoom, Teams, or Webex, OnTopic only hears *your* side of the call
- No browser API can legitimately tap into another app's audio stream
- Speaker/output audio is entirely off-limits in a browser context

**The goal:** capture *both* streams simultaneously:

| Stream | Source | Current Status |
|---|---|---|
| Microphone input | Physical mic or headset mic | ✅ Works via browser |
| Speaker/headset output | Remote participants talking through speakers or BT headset | ❌ Not possible in browser |

To get both, we need to run outside the browser sandbox — i.e., as a **native desktop application**.

---

## 2. Desktop Framework Options

### Option A — Electron (Recommended)
**What it is:** Packages a Chromium browser + Node.js runtime into a native .exe / .app / .deb bundle. The existing OnTopic React frontend runs *as-is* inside Electron. Only the audio capture layer changes.

**Why it fits OnTopic:**
- Zero frontend rewrite. All the React, shadcn, TanStack Query code stays the same.
- Node.js native modules (via `node-addon-api`) give direct OS audio API access
- Ships as a single installable app on Windows, macOS, Linux
- Auto-update support built in
- Large ecosystem, mature tooling (electron-builder, electron-forge)

**Tradeoffs:**
- Heavier bundle (~150–300 MB) because it bundles Chromium
- Higher memory footprint than a pure native app
- Chromium sandbox must be partially disabled for audio hardware access

### Option B — Tauri
**What it is:** Rust-based desktop wrapper. Uses the OS's built-in WebView (not Chromium), and Rust for the native backend.

**Tradeoffs vs. Electron:**
- Smaller bundle (~10–30 MB), lower memory usage
- Audio capture requires writing Rust (using `cpal` or `rodio` crates)
- WebView rendering is inconsistent across OS versions (especially Windows)
- Smaller ecosystem for audio tooling
- Higher development effort for audio layer

**Verdict:** Electron is the right call for OnTopic given the existing codebase. Tauri would make sense for a fresh rebuild. Proceed with Electron.

---

## 3. How System-Level Audio Capture Works (Per Platform)

This is the most technically complex part. Each OS has a different audio subsystem.

### 3A. Windows — WASAPI Loopback

Windows Audio Session API (WASAPI) has a built-in **loopback mode** that lets any process tap the audio being sent to a playback device (speakers, headset, Bluetooth) as a read-only mirror.

**How it works:**
1. Enumerate audio endpoints (e.g., "Headset (Bluetooth)", "Speakers (Realtek)")
2. Open the default playback device in **loopback mode** — this gives raw PCM samples of everything being played through that device
3. Simultaneously open the default capture device (microphone) in normal capture mode
4. Both streams run as separate threads; PCM data is pushed into a buffer

**Key Windows APIs:**
- `IMMDeviceEnumerator` → enumerates audio devices
- `IAudioClient` with `AUDCLNT_STREAMFLAGS_LOOPBACK` → loopback capture
- `IAudioCaptureClient` → reads captured PCM frames

**Node.js / Electron implementation path:**
- Write a native Node addon using `node-addon-api` (C++) that wraps WASAPI
- Or use the npm package `naudiodon` (based on PortAudio) — PortAudio 19 supports WASAPI loopback on Windows
- Or use `node-record-lpcm16` with PortAudio backend

**Bluetooth headsets on Windows:**
- When the headset is set as the default audio device, WASAPI loopback automatically captures what's routed to it — no special handling needed
- Edge case: some headsets switch to a lower-quality "hands-free" profile (HSP/HFP) when used for both mic and playback simultaneously. This is a Bluetooth protocol limitation, not an app limitation.

---

### 3B. macOS — CoreAudio + Virtual Audio Driver

macOS **does not** have a native loopback mode. Apple intentionally blocked system audio capture in 10.15 Catalina (removing Soundflower-style kernel extensions). The solution is a **virtual audio driver** installed as a system extension.

**Two-part architecture required:**

**Part 1 — Virtual Audio Device (installed once by the user):**
The app ships and installs a macOS Audio Server Plugin (`.driver` bundle). This creates a virtual audio device visible in System Preferences → Sound. Examples of the same pattern:
- BlackHole (open source, MIT license — can bundle and redistribute)
- Loopback by Rogue Amoeba (commercial, cannot bundle)
- SoundSource (same)

**Recommended: Bundle BlackHole or write a minimal Audio Server Plugin**

The virtual driver creates a "virtual output" device. The user (or the app) sets the system audio output to this virtual device (or uses macOS Multi-Output to route to *both* real speakers and the virtual device simultaneously).

**Part 2 — App reads from the virtual device:**
The OnTopic Electron app reads audio from the virtual input corresponding to the virtual output. Using CoreAudio's `AudioQueue` or `AVAudioEngine`:

```
Real Audio Output Device (headset)
        ↕  Multi-Output Route
Virtual Audio Driver (BlackHole 2ch)
        ↓
OnTopic reads this virtual input → gets speaker audio PCM
```

**Microphone capture on macOS:**
Standard `AVCaptureDevice` / `AVAudioEngine` — no special handling, same as browser.

**macOS permissions required:**
- Microphone: standard `NSMicrophoneUsageDescription` in Info.plist → user prompt on first launch
- System audio: requires the virtual driver to be installed + user grants the route in System Preferences. Starting macOS 14 Sonoma, there is a new `ScreenCaptureKit` audio-only capture path that may allow loopback without a virtual driver — worth evaluating as it matures.

**Node.js / Electron implementation path:**
- Use `naudiodon` (PortAudio) — on macOS it enumerates CoreAudio devices, including virtual ones
- Ship BlackHole as a bundled installer, run it silently on first launch with admin prompt
- App sets up the Multi-Output device programmatically via CoreAudio API or a small Swift/ObjC helper

---

### 3C. Linux — PulseAudio / PipeWire Monitor Sources

Linux has the most straightforward loopback mechanism. PulseAudio (and its modern successor PipeWire) automatically creates a **monitor source** for every audio sink (output device). A monitor source is a read-only mirror of everything playing through that sink.

**How it works:**
1. Query PulseAudio for the default sink (e.g., `bluez_sink.XX.a2dp_sink` for Bluetooth headset)
2. Find its corresponding monitor source (`bluez_sink.XX.a2dp_sink.monitor`)
3. Open the monitor source for recording — you get the speaker audio as PCM
4. Simultaneously record from the default source (microphone)

**No special drivers or permissions needed on most distros** (user must be in the `audio` group, which is default on Ubuntu/Fedora).

**Node.js / Electron implementation path:**
- `pactl list sources` to enumerate monitor sources
- `node-record-lpcm16` or `naudiodon` with PulseAudio backend
- PipeWire is a drop-in PulseAudio replacement on modern Fedora/Ubuntu 22.04+ — same API works

---

## 4. Unified Audio Capture Architecture

Given the three platforms, here's the unified design inside the Electron main process:

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│                                                             │
│  ┌──────────────────┐     ┌──────────────────────────────┐  │
│  │  MicCapture       │     │  SpeakerCapture              │  │
│  │  (all platforms)  │     │  Windows: WASAPI loopback    │  │
│  │  naudiodon /      │     │  macOS: CoreAudio + virtual  │  │
│  │  node-record      │     │  Linux: PulseAudio monitor   │  │
│  └────────┬─────────┘     └──────────────┬───────────────┘  │
│           │  PCM                          │  PCM             │
│           └──────────┬────────────────────┘                  │
│                      ▼                                       │
│            ┌──────────────────┐                              │
│            │  AudioMixer       │                              │
│            │  • Merge streams  │                              │
│            │  • Diarization   │                              │
│            │  • 16kHz mono    │                              │
│            │  • Chunking      │                              │
│            └────────┬─────────┘                              │
│                     │  Audio chunks (ArrayBuffer)             │
│                     ▼                                        │
│            ┌──────────────────┐                              │
│            │  IPC Bridge      │ ←── ipcMain.handle()         │
│            └────────┬─────────┘                              │
└─────────────────────┼───────────────────────────────────────┘
                      │ ipcRenderer
┌─────────────────────┼───────────────────────────────────────┐
│              Electron Renderer (React app)                   │
│                     ▼                                        │
│            ┌──────────────────┐                              │
│            │  useAudioStream   │  (replaces getUserMedia)    │
│            │  hook            │                              │
│            └────────┬─────────┘                              │
│                     │                                        │
│            ┌────────▼─────────┐                              │
│            │  Existing        │                              │
│            │  Transcription + │                              │
│            │  Analysis        │                              │
│            │  Pipeline        │                              │
│            └──────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

**Key design principle:** The React frontend changes minimally. The `useAudioCapture` hook that currently calls `navigator.mediaDevices.getUserMedia()` is replaced by an IPC listener that receives audio chunks from the main process. Everything downstream (transcription, analysis, BANT tracking, etc.) stays identical.

---

## 5. Speaker Diarization — Knowing Who Said What

With two separate audio streams (mic vs speaker output), you get a natural speaker split:
- Stream 1 = the local user (mic)
- Stream 2 = the remote participant(s) (speaker output)

This is actually *better* than what meeting apps provide. Current challenges with single-stream diarization:
- When both sides talk simultaneously, the streams overlap
- AI has to guess speaker boundaries from acoustic patterns

With dual-stream capture:
- Label Stream 1 = "You" (or the configured host name)
- Label Stream 2 = "Remote" initially, then resolve to individual speakers via Whisper's diarization or a second-pass model
- Overlap detection: when both streams have audio above noise floor simultaneously, flag as "cross-talk"

---

## 6. Transcription Pipeline Changes

Currently, OnTopic sends audio to Whisper via the OpenAI API. The desktop version can:

**Option A — Keep cloud transcription (OpenAI Whisper API):**
- Same as current, just fed from system audio instead of browser mic
- Lowest effort, best accuracy
- Requires internet connection

**Option B — Local Whisper (whisper.cpp or faster-whisper):**
- Run transcription entirely on-device via a bundled model
- `whisper.cpp` has Node.js bindings (`nodejs-whisper` npm package)
- Models: `base` (~140 MB), `small` (~460 MB), `medium` (~1.5 GB)
- No API costs, works offline, no audio leaves the device
- Transcription runs on CPU (or GPU if available)
- Latency: ~2-5 seconds on a modern laptop for 10-second chunks using `small` model

**Option C — Hybrid:**
- Use local Whisper for real-time transcription (low latency, private)
- Send de-identified transcript text to OpenAI GPT for analysis (BANT, topics, sentiment)
- Only text leaves the device, not audio

**Recommendation:** Option C is the best fit for enterprise/compliance-sensitive users (financial services, legal, healthcare). Audio never leaves the device.

---

## 7. What Changes vs. What Stays the Same

| Component | Change Required | Notes |
|---|---|---|
| React frontend (UI) | Minimal | Replace `getUserMedia` hook only |
| Express backend (API routes) | None | Packaged alongside Electron |
| PostgreSQL database | None | Ships as SQLite for local storage, or keeps Postgres for server mode |
| Transcription pipeline | Moderate | Add local Whisper option; IPC replaces MediaRecorder |
| Analysis (BANT, topics, etc.) | None | Receives same transcript text |
| Authentication | Change | Replit Auth replaced with local auth or OAuth |
| Audio capture | Major (new) | The native audio layer described above |
| Distribution | New | electron-builder for .exe/.dmg/.AppImage |

---

## 8. Platform-Specific Installation Requirements

### Windows
- No extra drivers needed
- User grants microphone permission on first launch (Windows privacy settings)
- App installs as standard `.exe` via NSIS or WiX installer
- Bluetooth audio works automatically via WASAPI

### macOS
- **First launch wizard required:**
  1. Prompt to install the virtual audio driver (BlackHole) — requires admin password
  2. Guide user to set up Multi-Output device in System Preferences (or automate via CoreAudio API)
  3. Prompt for microphone permission
- Ships as a notarized `.dmg`
- Apple Silicon (M1/M2/M3) and Intel both supported via universal binary

### Linux
- No extra drivers if PulseAudio or PipeWire is running (true for all mainstream desktop distros)
- Ships as `.AppImage` (no installation needed) or `.deb`/`.rpm`
- Flatpak distribution possible via Flathub for wider reach

---

## 9. Privacy & Security Considerations

System audio capture is sensitive. Design principles:

1. **No audio storage by default** — audio is processed in real-time and discarded. Only the transcript text is stored.
2. **Visual recording indicator** — persistent UI indicator (like a red dot) while audio capture is active. Cannot be hidden.
3. **One-click stop** — system tray icon allows immediate audio capture stop from outside the app window.
4. **Consent notice** — first-launch dialog clearly states what audio is captured and where it goes.
5. **Local processing mode** — if Option C (hybrid/local Whisper) is used, a prominent "Audio never leaves this device" badge.
6. **No screen capture** — the app only captures audio streams, not video or screen content.

---

## 10. Technology Stack Summary

| Layer | Technology |
|---|---|
| Desktop wrapper | Electron 30+ |
| Frontend | Existing React/TypeScript (unchanged) |
| Backend | Existing Express (packaged in Electron main) |
| Local database | SQLite via better-sqlite3 (replaces Postgres for local mode) |
| Audio capture (all platforms) | naudiodon (PortAudio) + platform-specific native addon |
| Windows loopback | WASAPI via node-addon-api (C++ addon) |
| macOS loopback | CoreAudio + BlackHole virtual driver |
| Linux loopback | PulseAudio monitor source via naudiodon |
| Local transcription | whisper.cpp via nodejs-whisper (optional) |
| Cloud transcription | OpenAI Whisper API (existing) |
| Build & distribution | electron-builder |
| Auto-update | electron-updater |

---

## 11. Phased Implementation Roadmap

### Phase 1 — Electron Shell (2–3 weeks)
- Wrap existing app in Electron
- Package Express backend in main process
- Replace SQLite for local DB
- Verify all existing features work inside Electron
- Set up electron-builder for Windows + macOS + Linux

### Phase 2 — Microphone via IPC (1 week)
- Replace `getUserMedia` with Electron IPC audio channel
- Capture mic via naudiodon in main process
- Verify transcription pipeline unchanged

### Phase 3 — Speaker/Loopback Capture — Windows (2 weeks)
- Implement WASAPI loopback native addon
- Dual-stream AudioMixer
- Test with Zoom, Teams, Webex on Windows

### Phase 4 — Speaker/Loopback Capture — macOS (2–3 weeks)
- Bundle BlackHole driver installer
- First-launch setup wizard
- CoreAudio multi-output routing
- Test on macOS 13/14, Intel + Apple Silicon

### Phase 5 — Speaker/Loopback Capture — Linux (1 week)
- PulseAudio monitor source detection
- Test on Ubuntu 22.04, Fedora 39

### Phase 6 — Local Whisper (Optional, 2 weeks)
- Integrate nodejs-whisper with bundled `small` model
- Hybrid mode: local transcription + cloud analysis
- Model download UI on first launch

### Phase 7 — Polish & Distribution (2 weeks)
- Code signing (Windows EV cert, macOS Developer ID)
- Auto-update infrastructure
- System tray integration
- Privacy indicator UX
- Installer UX / first-launch wizard

**Total estimated timeline: 12–16 weeks** for a full-featured v1.0 across all three platforms.

---

## 12. Key Open Questions Before Committing

1. **Target platforms priority** — Windows first? macOS-only? All three simultaneously?
2. **Audio privacy stance** — Should local-only processing (no audio to cloud) be the default or an option?
3. **Distribution model** — Direct download (.exe/.dmg), Mac App Store (which restricts audio APIs), or both?
4. **Existing Replit Auth** — Replace with email/password local auth, or keep as a login-to-sync feature for cloud backup?
5. **Whisper model bundling** — Bundle the `small` model (~460 MB, adds to installer size) or download on first run?
6. **Multi-user / team** — Is this a single-user local tool, or does it sync data to a shared server across a sales team?

---

*Document version: 1.0 — March 2026*
