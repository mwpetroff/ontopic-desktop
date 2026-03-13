# OnTopic Desktop

  **A real-time PreSales Consulting Companion — native desktop edition**

  > Migrated from the [OnTopic web app](https://github.com/mwpetroff/ontopic-web). Adds system-level audio capture so OnTopic works as a silent companion during any meeting — Zoom, Teams, Webex, Google Meet, or any other conferencing tool — by tapping directly into the OS audio stack.

  ## What's Different from the Web App

  | Feature | Web App | Desktop App |
  |---|---|---|
  | Microphone capture | Browser getUserMedia | OS audio API (naudiodon) |
  | Speaker capture | ❌ Not possible | ✅ WASAPI loopback (Win) / BlackHole (Mac) / PulseAudio monitor (Linux) |
  | Speaker labeling | Single-stream diarization | Clean 2-stream split (mic = you, speaker = them) |
  | Meeting app requirement | Browser tab | Works alongside any app |
  | Transcription | Cloud (Whisper API) | Cloud or local (whisper.cpp) |
  | Distribution | Web URL | Installer (.exe / .dmg / .AppImage) |

  ## Architecture

  ```
  Electron Main Process
    ├── MicCapture       → naudiodon (all platforms)
    ├── SpeakerCapture   → WASAPI (Win) / BlackHole (Mac) / PulseAudio (Linux)
    ├── AudioMixer       → labels chunks as "mic" or "speaker", fires onChunk
    └── IPC Bridge       → sends audio chunks to renderer via ipcMain

  Electron Renderer (React)
    ├── useAudioCapture  → replaces getUserMedia, listens for IPC chunks
    └── [All existing OnTopic UI unchanged]
  ```

  ## Platform Audio Setup

  ### Windows
  No extra setup. WASAPI loopback captures your default playback device automatically.

  ### macOS
  Requires [BlackHole](https://github.com/ExistentialAudio/BlackHole) virtual audio driver (installed on first launch).

  ### Linux
  Requires PulseAudio or PipeWire (standard on all modern desktop distros). No extra setup.

  ## Development

  ```bash
  npm install
  npm run dev   # Starts Vite dev server + Electron
  ```

  ## Build

  ```bash
  npm run build:win    # Windows NSIS installer
  npm run build:mac    # macOS DMG
  npm run build:linux  # Linux AppImage
  ```

  ## Roadmap

  - [x] Phase 1: Electron shell + project scaffold
  - [ ] Phase 2: Microphone via IPC (replace getUserMedia)
  - [ ] Phase 3: WASAPI loopback — Windows
  - [ ] Phase 4: BlackHole + CoreAudio — macOS
  - [ ] Phase 5: PulseAudio monitor — Linux
  - [ ] Phase 6: Local Whisper (optional, audio stays on-device)
  - [ ] Phase 7: Code signing + auto-update + distribution

  ## Technical Plan

  See [docs/desktop-audio-capture-plan.md](docs/desktop-audio-capture-plan.md) for the full architecture and implementation details.
  