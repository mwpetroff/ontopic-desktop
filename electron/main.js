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

  const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, safeStorage } = require("electron");
  const path = require("path");
  const net  = require("net");
  const { spawn } = require("child_process");
  const portAudio = require("naudiodon");
  const { MicCapture } = require("./audio/mic-capture");
  const { SpeakerCapture } = require("./audio/speaker-capture");
  const { AudioMixer } = require("./audio/audio-mixer");
  const { runSetupWizardIfNeeded } = require("./setup-wizard");

  const isDev = process.env.NODE_ENV === "development";

  // ─── Settings Store ───────────────────────────────────────────────────────────
  // electron-store is ESM-only in v9+; use dynamic import.
  let store = null;
  async function getStore() {
    if (!store) {
      const { default: Store } = await import("electron-store");
      store = new Store({
        schema: {
          // openaiApiKeyEncrypted: safeStorage blob stored as base64.
          // Legacy plaintext openaiApiKey is migrated on first access.
          openaiApiKeyEncrypted: { type: "string", default: "" },
          wizardCompleted:       { type: "boolean", default: false },
        },
      });

      // ─── One-time migration: plaintext → encrypted ──────────────────────
      // If the old plaintext key exists, encrypt it and delete the old field.
      const legacy = store.get("openaiApiKey");
      if (legacy && safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(legacy).toString("base64");
        store.set("openaiApiKeyEncrypted", encrypted);
        store.delete("openaiApiKey");
        console.log("[main] Migrated openaiApiKey to safeStorage encryption.");
      }
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

    // Only check project root in dev mode. In production the .env file
    // is not present and all config comes from safeStorage.
    const candidates = isDev
      ? [path.resolve(__dirname, "../.env")]
      : [path.join(appData, "OnTopic", ".env")];

    for (const envPath of candidates) {
      const result = dotenvConfig({ path: envPath, override: false });
      if (!result.error) {
        console.log(`[main] Loaded config from ${envPath} (dev override)`);
        return;
      }
    }
  }

  loadEnvFile();

  // ─── Express Backend ──────────────────────────────────────────────────────────

  // ─── Secure key helpers ───────────────────────────────────────────────────────

  async function getDecryptedApiKey() {
    const s = await getStore();
    const blob = s.get("openaiApiKeyEncrypted");
    if (blob && safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(Buffer.from(blob, "base64"));
      } catch (e) {
        console.error("[main] Failed to decrypt API key:", e.message);
      }
    }
    // Fallback: if safeStorage unavailable or blob corrupt, return nothing.
    return "";
  }

  async function startServer() {
    // Priority: .env OPENAI_API_KEY (dev override) > safeStorage encrypted key.
    const storedKey = await getDecryptedApiKey();
    const apiKey = process.env.OPENAI_API_KEY || storedKey;

    const serverScript = path.resolve(__dirname, "../server/index.ts");
    const tsxBin = path.resolve(__dirname, "../node_modules/.bin/tsx");

    // On Windows, Node.js 20+ blocks spawning .cmd files directly (security restriction).
    // Use cmd.exe /c to invoke the .cmd wrapper explicitly instead.
    const spawnCmd  = process.platform === "win32" ? "cmd.exe" : tsxBin;
    const spawnArgs = process.platform === "win32"
      ? ["/c", tsxBin + ".cmd", serverScript]
      : [serverScript];

    const logPath = path.join(
      process.env.APPDATA || path.join(process.env.HOME, ".local", "share"),
      "OnTopic", "server.log"
    );

    serverProcess = spawn(spawnCmd, spawnArgs, {
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
      title: "NRI North America | OnTopic",
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


    mainWindow.on("closed", () => { mainWindow = null; });
  }

  // ─── Tray ─────────────────────────────────────────────────────────────────────

  function createTray() {
    const iconPath = path.join(__dirname, "assets/tray-icon.png");
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: "Open NRI OnTopic", click: () => mainWindow?.show() },
      { label: "Stop Capture", click: stopCapture },
      { type: "separator" },
      { label: "Quit", role: "quit" },
    ]);
    tray.setToolTip("NRI North America OnTopic — Active");
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

    mic.on("data",  (pcm) => audioMixer?.push("mic", pcm));
    mic.on("error", (err) => {
      console.error("[main] MicCapture error:", err.message);
      mainWindow?.webContents.send("capture:error", { source: "mic", message: err.message });
    });

    speaker.on("data",  (pcm) => audioMixer?.push("speaker", pcm));
    speaker.on("error", (err) => {
      console.warn("[main] SpeakerCapture unavailable:", err.message);
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
    return await getDecryptedApiKey();
  });

  ipcMain.handle("settings:setApiKey", async (_e, key) => {
    const s = await getStore();
    const trimmed = (key || "").trim();
    if (trimmed && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(trimmed).toString("base64");
      s.set("openaiApiKeyEncrypted", encrypted);
    } else {
      // safeStorage unavailable (rare — headless Linux) — store cleared text
      // wrapped in a minimal base64 to keep the same field type.
      s.set("openaiApiKeyEncrypted", Buffer.from(trimmed).toString("base64"));
      if (trimmed) console.warn("[main] safeStorage unavailable — key stored as base64 only.");
    }
    // Restart server so it picks up the new key immediately.
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    await startServer();
    console.log("[main] API key updated — server restarted");
    return { ok: true };
  });

  ipcMain.handle("settings:validateApiKey", async (_e, key) => {
    // Make a minimal OpenAI API call to verify the key without incurring cost.
    try {
      const https = require("https");
      await new Promise((resolve, reject) => {
        const req = https.request(
          { hostname: "api.openai.com", path: "/v1/models", method: "GET",
            headers: { Authorization: `Bearer ${key}`, "User-Agent": "OnTopic/1.0" } },
          (res) => {
            if (res.statusCode === 200) resolve(true);
            else reject(new Error(`HTTP ${res.statusCode}`));
          }
        );
        req.on("error", reject);
        req.end();
      });
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e.message };
    }
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

  /**
   * Returns true if something is currently listening on the given TCP port.
   */
  function isPortInUse(port) {
    return new Promise((resolve) => {
      const sock = net.connect({ port, host: "127.0.0.1" });
      sock.once("connect", () => { sock.destroy(); resolve(true); });
      sock.once("error",   () => { sock.destroy(); resolve(false); });
    });
  }

  /**
   * Attempt to kill any process currently holding the given TCP port.
   * On Windows uses netstat + taskkill; on Unix uses lsof + kill.
   * Fails silently — caller should re-check with waitForPort.
   */
  async function killProcessOnPort(port) {
    const { execSync } = require("child_process");
    try {
      if (process.platform === "win32") {
        // netstat -ano lists all TCP connections with PIDs in the last column.
        const out = execSync(`netstat -ano`, { encoding: "utf8", timeout: 5000 });
        const lines = out.split("\n");
        const pids = new Set();
        for (const line of lines) {
          // Match lines with LISTENING on the target port.
          const m = line.match(/:${port}\s.*LISTENING\s+(\d+)/);
          if (m) pids.add(m[1]);
        }
        for (const pid of pids) {
          try {
            execSync(`taskkill /PID ${pid} /T /F`, { timeout: 5000 });
            console.log(`[main] Killed stale process PID=${pid} holding port ${port}`);
          } catch {}
        }
      } else {
        // lsof -ti returns just the PIDs for processes listening on the port.
        const pids = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8", timeout: 5000 })
          .split("\n")
          .map(s => s.trim())
          .filter(Boolean);
        for (const pid of pids) {
          try {
            execSync(`kill -9 ${pid}`, { timeout: 5000 });
            console.log(`[main] Killed stale process PID=${pid} holding port ${port}`);
          } catch {}
        }
      }
      // Give the OS a moment to release the port.
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.warn(`[main] killProcessOnPort(${port}) failed:`, e.message);
    }
  }

  // ─── Single-instance lock ─────────────────────────────────────────────────────
  // Prevent a second copy of the app from opening. If the user tries to launch
  // a second instance, focus the already-running window instead.
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.log("[main] Another instance is already running — quitting.");
    app.quit();
  } else {
    app.on("second-instance", (_event, _argv, _cwd) => {
      // A second launch was attempted. Restore and focus the existing window.
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }

  // ─── App Lifecycle ────────────────────────────────────────────────────────────

  app.whenReady().then(async () => {
    // ─── Content Security Policy ──────────────────────────────────────────────
    // In dev, Vite HMR requires 'unsafe-eval' so we allow it but scope sources
    // tightly.  In production the policy is strict — no eval, no inline scripts.
    const { session } = require("electron");
    const devCSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:5173",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' http://localhost:3000 ws://localhost:3000 http://localhost:5173 ws://localhost:5173 https://api.openai.com",
      "font-src 'self' data: https://fonts.gstatic.com",
    ].join("; ");
    const prodCSP = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://api.openai.com",
      "font-src 'self' data: https://fonts.gstatic.com",
    ].join("; ");
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [isDev ? devCSP : prodCSP],
        },
      });
    });

    const s = await getStore();

    // Kill any stale process that's already holding port 3000 (e.g. a leftover
    // server from a previous crashed session) before trying to spawn a new one.
    if (await isPortInUse(3000)) {
      console.log("[main] Port 3000 is already in use — attempting to clear it...");
      await killProcessOnPort(3000);
      if (await isPortInUse(3000)) {
        console.warn("[main] Port 3000 still in use after kill attempt — server may fail to start.");
      } else {
        console.log("[main] Port 3000 cleared successfully.");
      }
    }

    await startServer();
    createTray();
    try {
      await waitForPort(3000);
    } catch (err) {
      console.error("[main] Server did not start in time:", err.message);
    }
    createWindow();
    // Run setup wizard on first launch (after window is created so dialogs have a parent).
    await runSetupWizardIfNeeded(mainWindow, s);
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
  