/**
 * Electron Preload Script
 *
 * Exposes a safe, narrow API to the renderer via contextBridge.
 * The renderer (React app) calls window.electronAudio.* instead of
 * directly touching Node.js or Electron APIs.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAudio", {
  // ── Device Enumeration ────────────────────────────────────────────────────
  // Returns all available input (mic) devices: [{ id, name, hostAPIName }]
  listDevices: () => ipcRenderer.invoke("devices:list"),

  // ── Control ───────────────────────────────────────────────────────────────
  // opts: { micDeviceId?: number }  (-1 or omit = system default)
  startCapture: (opts) => ipcRenderer.invoke("capture:start", opts),
  stopCapture:  ()     => ipcRenderer.invoke("capture:stop"),
  getStatus:    ()     => ipcRenderer.invoke("capture:status"),
  getPlatform:  ()     => ipcRenderer.invoke("platform:get"),

  // ── Events ────────────────────────────────────────────────────────────────
  onAudioChunk: (cb) => {
    const handler = (_event, data) => cb(data);
    ipcRenderer.on("audio:chunk", handler);
    return () => ipcRenderer.removeListener("audio:chunk", handler);
  },

  onCaptureStatus: (cb) => {
    const handler = (_event, data) => cb(data);
    ipcRenderer.on("capture:status", handler);
    return () => ipcRenderer.removeListener("capture:status", handler);
  },

  // Fired when a capture stream encounters a device error (e.g. Stereo Mix
  // not enabled). data: { source: "mic" | "speaker", message: string }
  onCaptureError: (cb) => {
    const handler = (_event, data) => cb(data);
    ipcRenderer.on("capture:error", handler);
    return () => ipcRenderer.removeListener("capture:error", handler);
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  getApiKey: ()    => ipcRenderer.invoke("settings:getApiKey"),
  setApiKey: (key) => ipcRenderer.invoke("settings:setApiKey", key),
});
