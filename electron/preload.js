/**
   * Electron Preload Script
   *
   * Exposes a safe, narrow API to the renderer via contextBridge.
   * The renderer (React app) calls window.electronAudio.* instead of
   * directly touching Node.js or Electron APIs.
   */

  const { contextBridge, ipcRenderer } = require("electron");

  contextBridge.exposeInMainWorld("electronAudio", {
    // ── Control ──────────────────────────────────────────────────────────────
    startCapture: () => ipcRenderer.invoke("capture:start"),
    stopCapture:  () => ipcRenderer.invoke("capture:stop"),
    getStatus:    () => ipcRenderer.invoke("capture:status"),
    getPlatform:  () => ipcRenderer.invoke("platform:get"),

    // ── Events ───────────────────────────────────────────────────────────────
    onAudioChunk: (cb) => {
      const handler = (_event, data) => cb(data);
      ipcRenderer.on("audio:chunk", handler);
      return () => ipcRenderer.removeListener("audio:chunk", handler);   // unsubscribe
    },

    onCaptureStatus: (cb) => {
      const handler = (_event, data) => cb(data);
      ipcRenderer.on("capture:status", handler);
      return () => ipcRenderer.removeListener("capture:status", handler);
    },
  });
  