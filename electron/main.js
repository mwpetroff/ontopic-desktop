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
  const net  = require("net");
  const { spawn } = require("child_process");
  const portAudio = require("naudiodon");
  const { MicCapture } = require("./audio/mic-capture");
  const { SpeakerCapture } = require("./audio/speaker-capture");
  const { AudioMixer } = require("./audio/audio-mixer");

  const isDev = process.env.NODE_ENV === "development";

  // ─── Settings Store ───────────────────────────────────────────────────────────
  // electron-store is ESM-only in v9+; use dynamic import.
  let store = null;
  async function getStore() {
    if (!store) {
      const { default: Store } = await import("electron-store");
      store = new Store({
        schema: {
          openaiApiKey: { type: "string", default: "" },
        },
      });
    }
    return store;
  }

  let mainWindow = null;
  let tray = null;
  let audioMixer = null;
  let isCapturing = false;
  let serverProcess = null;

  // ─── Config file loading ──────────────────────────────────────────────────────
  // Reads OPENAI_API_KEY (and any other vars) from a .env file.
  // Looks in the project root first (dev), then %APPDATA%/OnTopic/ (prod).

  function loadEnvFile() {
    const { config: dotenvConfig } = require("dotenv");
    const appData =
      process.env.APPDATA ||
      (process.platform === "darwin"
        ? path.join(process.env.HOME, "Library", "Application Support")
        : path.join(process.env.HOME, ".local", "share"));

    const candidates = [
      path.resolve(__dirname, "../.env"),                      // project root (dev)
      path.join(appData, "OnTopic", ".env"),                   // user data dir (prod)
    ];

    for (const envPath of candidates) {
      const result = dotenvConfig({ path: envPath, override: false });
      if (!result.error) {
        console.log(`[main] Loaded config from ${envPath}`);
        return;
      }
    }
  }

  loadEnvFile();

  // ─── Express Backend ──────────────────────────────────────────────────────────

  async function startServer() {
    // API key: .env file takes priority; electron-store is a legacy fallback.
    const s = await getStore();
    const apiKey = process.env.OPENAI_API_KEY || s.get("openaiApiKey") || "";

    const serverScript = path.resolve(__dirname, "../server/index.ts");
    // On Windows child_process.spawn cannot execute bash wrapper scripts directly;
    // use tsx.cmd instead and avoid shell:true (which adds cmd.exe quoting complexity).
    const tsxExt    = process.platform === "win32" ? ".cmd" : "";
    const tsxBin    = path.resolve(__dirname, `../node_modules/.bin/tsx${tsxExt}`);

    const logPath = path.join(
      process.env.APPDATA || path.join(process.env.HOME, ".local", "share"),
      "OnTopic", "server.log"
    );

    serverProcess = spawn(tsxBin, [serverScript], {
      env: {
        ...process.env,
        NODE_ENV: isDev ? "development" : "production",
        PORT: "3000",
        ELECTRON: "true",
        OPENAI_API_KEY: apiKey,
        SERVER_LOG_PATH: logPath,
      },
      // Pipe output so we can also write to a log file.
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Tee server output: forward to Electron console + write to log file.
    const { createWriteStream } = require("fs");
    const logStream = createWriteStream(logPath, { flags: "a" });
    logStream.write(`\n\n=== Server started ${new Date().toISOString()} ===\n`);
    serverProcess.stdout.on("data", (d) => { process.stdout.write(d); logStream.write(d); });
    serverProcess.stderr.on("data", (d) => { process.stderr.write(d); logStream.write(d); });

    serverProcess.on("error", (err) => {
      console.error("[main] Failed to start server process:", err.message);
    });

    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[main] Server process exited with code ${code}`);
      }
    });

    console.log("[main] Express server starting on port 3000");
  }

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

  async function startCapture({ micDeviceId = -1 } = {}) {
    if (isCapturing) return;
    isCapturing = true;

    audioMixer = new AudioMixer({
      sampleRate: 16000,
      channels: 1,
      chunkMs: 5000, // 5-second chunks → Whisper transcription
      onChunk: (chunk, label) => {
        if (mainWindow) {
          mainWindow.webContents.send("audio:chunk", { buffer: chunk, label });
          console.log(`[main] audio:chunk sent — label=${label} bytes=${chunk.length}`);
        } else {
          console.warn("[main] audio:chunk dropped — no renderer window");
        }
      },
    });

    const mic = new MicCapture({ sampleRate: 16000, channels: 1, deviceId: micDeviceId });
    const speaker = new SpeakerCapture({ sampleRate: 16000, channels: 1 });

    mic.on("data",  (pcm) => audioMixer.push("mic", pcm));
    mic.on("error", (err) => {
      console.error("[main] MicCapture error:", err.message);
      mainWindow?.webContents.send("capture:error", { source: "mic", message: err.message });
    });

    speaker.on("data",  (pcm) => audioMixer.push("speaker", pcm));
    speaker.on("error", (err) => {
      console.error("[main] SpeakerCapture error:", err.message);
      mainWindow?.webContents.send("capture:error", { source: "speaker", message: err.message });
    });

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

  ipcMain.handle("capture:start", async (_e, opts) => {
    console.log("[main] IPC capture:start — opts:", opts);
    await startCapture(opts);
    return { ok: true };
  });

  ipcMain.handle("capture:stop", () => {
    console.log("[main] IPC capture:stop");
    stopCapture();
    return { ok: true };
  });

  ipcMain.handle("capture:status", () => {
    console.log("[main] IPC capture:status — active:", isCapturing);
    return { active: isCapturing };
  });

  ipcMain.handle("platform:get", () => process.platform);

  // ─── API Key Management ───────────────────────────────────────────────────────

  ipcMain.handle("settings:getApiKey", async () => {
    const s = await getStore();
    return s.get("openaiApiKey") || "";
  });

  ipcMain.handle("settings:setApiKey", async (_e, key) => {
    const s = await getStore();
    s.set("openaiApiKey", key);
    // Restart server so it picks up the new key immediately.
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    await startServer();
    console.log("[main] API key updated — server restarted");
    return { ok: true };
  });

  // Return all input devices so the renderer can present a "choose mic" UI.
  // Each entry: { id, name, hostAPIName }
  ipcMain.handle("devices:list", () => {
    const all = portAudio.getDevices();
    const inputs = all
      .filter((d) => d.maxInputChannels > 0)
      .map(({ id, name, hostAPIName }) => ({ id, name, hostAPIName }));
    console.log(`[main] IPC devices:list — returning ${inputs.length} input devices`);
    return inputs;
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Resolves once TCP port is accepting connections, or rejects after timeoutMs.
   */
  function waitForPort(port, { timeoutMs = 15000, intervalMs = 200 } = {}) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      (function attempt() {
        const sock = net.connect({ port, host: "127.0.0.1" });
        sock.once("connect", () => { sock.destroy(); resolve(); });
        sock.once("error",   () => {
          sock.destroy();
          if (Date.now() >= deadline) {
            reject(new Error(`Port ${port} not ready after ${timeoutMs}ms`));
          } else {
            setTimeout(attempt, intervalMs);
          }
        });
      })();
    });
  }

  // ─── App Lifecycle ────────────────────────────────────────────────────────────

  app.whenReady().then(async () => {
    await startServer();
    createTray();
    try {
      await waitForPort(3000);
    } catch (err) {
      console.error("[main] Server did not start in time:", err.message);
    }
    createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (!mainWindow) createWindow();
  });

  app.on("before-quit", () => {
    stopCapture();
    if (serverProcess) {
      // On Windows, killing a .cmd wrapper with .kill() doesn't reach the
      // underlying Node process.  Use taskkill /T /F to kill the whole tree.
      if (process.platform === "win32") {
        require("child_process").spawnSync("taskkill", ["/pid", String(serverProcess.pid), "/t", "/f"]);
      } else {
        serverProcess.kill("SIGTERM");
      }
      serverProcess = null;
    }
  });
  