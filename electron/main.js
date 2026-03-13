/**
   * OnTopic Desktop — Electron Main Process
   *
   * Responsibilities:
   *  - Create and manage the BrowserWindow
   *  - Start the Express backend as a child process (or inline)
   *  - Initialize system-level audio capture (mic + speaker loopback)
   *  - Bridge audio data to the renderer via IPC
   *  - Handle app lifecycle (tray icon, minimize-to-tray, auto-update)
   */

  const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require("electron");
  const path = require("path");
  const { MicCapture } = require("./audio/mic-capture");
  const { SpeakerCapture } = require("./audio/speaker-capture");
  const { AudioMixer } = require("./audio/audio-mixer");

  const isDev = process.env.NODE_ENV === "development";

  let mainWindow = null;
  let tray = null;
  let audioMixer = null;
  let isCapturing = false;

  // ─── Window ──────────────────────────────────────────────────────────────────

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      title: "OnTopic",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // Required for audio native modules
      },
    });

    const startUrl = isDev
      ? "http://localhost:5173"              // Vite dev server
      : `file://${path.join(__dirname, "../dist/index.html")}`; // Production build

    mainWindow.loadURL(startUrl);

    if (isDev) mainWindow.webContents.openDevTools();

    mainWindow.on("closed", () => { mainWindow = null; });
  }

  // ─── Tray ─────────────────────────────────────────────────────────────────────

  function createTray() {
    // TODO: replace with actual icon asset
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: "Open OnTopic", click: () => mainWindow?.show() },
      { label: "Stop Capture", click: stopCapture },
      { type: "separator" },
      { label: "Quit", role: "quit" },
    ]);
    tray.setToolTip("OnTopic — Active");
    tray.setContextMenu(contextMenu);
  }

  // ─── Audio Capture ────────────────────────────────────────────────────────────

  async function startCapture() {
    if (isCapturing) return;
    isCapturing = true;

    audioMixer = new AudioMixer({
      sampleRate: 16000,
      channels: 1,
      chunkMs: 5000, // 5-second chunks → Whisper transcription
      onChunk: (chunk, label) => {
        // Send PCM chunk to renderer for transcription
        mainWindow?.webContents.send("audio:chunk", { buffer: chunk, label });
      },
    });

    const mic = new MicCapture({ sampleRate: 16000, channels: 1 });
    const speaker = new SpeakerCapture({ sampleRate: 16000, channels: 1 });

    mic.on("data", (pcm) => audioMixer.push("mic", pcm));
    speaker.on("data", (pcm) => audioMixer.push("speaker", pcm));

    await mic.start();
    await speaker.start();

    mainWindow?.webContents.send("capture:status", { active: true });
  }

  function stopCapture() {
    if (!isCapturing) return;
    isCapturing = false;
    audioMixer?.stop();
    audioMixer = null;
    mainWindow?.webContents.send("capture:status", { active: false });
  }

  // ─── IPC Handlers ─────────────────────────────────────────────────────────────

  ipcMain.handle("capture:start", async () => { await startCapture(); return { ok: true }; });
  ipcMain.handle("capture:stop",  ()  => { stopCapture(); return { ok: true }; });
  ipcMain.handle("capture:status", () => ({ active: isCapturing }));

  ipcMain.handle("platform:get", () => process.platform); // "win32" | "darwin" | "linux"

  // ─── App Lifecycle ────────────────────────────────────────────────────────────

  app.whenReady().then(() => {
    createWindow();
    createTray();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (!mainWindow) createWindow();
  });

  app.on("before-quit", () => stopCapture());
  