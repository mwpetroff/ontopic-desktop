/**
 * Windows Speaker Loopback — WASAPI + Stereo Mix fallback
 *
 * Strategy (in priority order):
 *
 * 1. WASAPI true loopback — open the default WASAPI output device as an input
 *    stream.  PortAudio's WASAPI backend supports this natively on Windows 10+:
 *    passing an output device ID to an input stream enables loopback capture
 *    without any virtual audio cable or Stereo Mix requirement.
 *
 * 2. Named loopback input device — look for Stereo Mix, VB-Audio Cable,
 *    VoiceMeeter, BlackHole, etc.  Stereo Mix requires explicit enablement in
 *    Windows Sound settings; the others require a driver install.
 *
 * Emits:
 *   "data"  — Buffer of raw 16-bit PCM samples at the configured sampleRate
 *   "error" — Error with a user-readable message if no loopback device can be opened
 */

const { EventEmitter } = require("events");

// Device name fragments that identify a loopback/mix capture source on Windows.
// Listed in priority order — first match wins.
const LOOPBACK_KEYWORDS = [
  "stereo mix",
  "what u hear",
  "wave out mix",
  "mix output",
  // VB-Audio Cable (https://vb-audio.com/Cable/)
  "cable output",
  // VoiceMeeter
  "voicemeeter output",
  "voicemeeter vaio",
  // Blackhole / other virtual cables
  "blackhole",
  "soundflower",
  // Generic fallback — any capture device with "loopback" in its name
  "loopback",
  "sum",
];

/**
 * Find the best available loopback source.
 *
 * Returns { device, channelCount } where channelCount is the number of input
 * channels to request (may come from maxOutputChannels for WASAPI loopback).
 *
 * @param {object} portAudio  naudiodon instance
 */
function findLoopbackDevice(portAudio = require("naudiodon")) {
  const devices = portAudio.getDevices();

  // ── Strategy 1: WASAPI true loopback ──────────────────────────────────────
  // Open the default WASAPI output device as a loopback input.
  // PortAudio's WASAPI backend (pa_win_wasapi.c) detects that the device is an
  // output and automatically switches to loopback capture mode.
  // Priority: default output first, then any WASAPI output.
  const wasapiOutputs = devices.filter(
    (d) => d.hostAPIName === "Windows WASAPI" && d.maxOutputChannels > 0
  );

  if (wasapiOutputs.length > 0) {
    // Prefer the device marked as the WASAPI default output (isDefaultOutput).
    // naudiodon / PortAudio sets defaultLowOutputLatency only on the default.
    const preferred =
      wasapiOutputs.find((d) => d.defaultLowOutputLatency > 0) ||
      wasapiOutputs[0];
    console.log(
      `[WasapiLoopbackCapture] WASAPI loopback candidate: "${preferred.name}" ` +
      `(id=${preferred.id}, outputCh=${preferred.maxOutputChannels})`
    );
    return { device: preferred, channelCount: Math.max(1, preferred.maxOutputChannels), mode: "wasapi-loopback" };
  }

  // ── Strategy 2: Named loopback/mix input device ────────────────────────────
  for (const keyword of LOOPBACK_KEYWORDS) {
    const match = devices.find(
      (d) => d.maxInputChannels > 0 && d.name.toLowerCase().includes(keyword)
    );
    if (match) {
      console.log(
        `[WasapiLoopbackCapture] named loopback device found: "${match.name}" ` +
        `(id=${match.id}) via keyword "${keyword}"`
      );
      return { device: match, channelCount: match.maxInputChannels, mode: "named-input" };
    }
  }

  // ── Diagnostics: log all devices so we know what's available ──────────────
  console.warn("[WasapiLoopbackCapture] No loopback device found. Available devices:");
  devices.forEach((d) =>
    console.warn(
      `  id=${d.id} "${d.name}" [${d.hostAPIName}] ` +
      `in=${d.maxInputChannels} out=${d.maxOutputChannels}`
    )
  );

  return null;
}

class WasapiLoopbackCapture extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number} [opts.sampleRate=16000]
   * @param {number} [opts.channels=1]
   * @param {object} [opts.portAudio]    naudiodon instance; defaults to require("naudiodon").
   *                                     Pass a mock here in tests to avoid loading the native addon.
   */
  constructor({ sampleRate = 16000, channels = 1, portAudio = require("naudiodon") } = {}) {
    super();
    this.sampleRate  = sampleRate;
    this.channels    = channels;
    this._portAudio  = portAudio;
    this._stream     = null;
  }

  async start() {
    if (this._stream) return;

    const result = findLoopbackDevice(this._portAudio);
    if (!result) {
      this.emit(
        "error",
        new Error(
          "No loopback capture device found.\n\n" +
          "To fix this on Windows, use one of:\n" +
          "  • VB-Audio Cable (free, works in corporate/GPO environments): https://vb-audio.com/Cable/\n" +
          "  • Enable Stereo Mix: right-click speaker icon → Sounds → Recording tab " +
            "→ right-click empty area → Show Disabled Devices → Enable Stereo Mix\n\n" +
          "Restart OnTopic after installing/enabling."
        )
      );
      return;
    }

    const { device, channelCount, mode } = result;

    try {
      this._stream = this._portAudio.AudioIO({
        inOptions: {
          channelCount:  Math.min(this.channels, channelCount),
          sampleFormat:  this._portAudio.SampleFormat16Bit,
          sampleRate:    this.sampleRate,
          deviceId:      device.id,
          closeOnError:  false,
        },
      });

      this._stream.on("data",  (chunk) => this.emit("data", chunk));
      this._stream.on("error", (err) => {
        // If WASAPI loopback mode failed, surface a clear error so the user
        // knows which fallback to use.
        const msg = mode === "wasapi-loopback"
          ? `WASAPI loopback failed on "${device.name}": ${err.message}. ` +
            "Install VB-Audio Cable (https://vb-audio.com/Cable/) or enable Stereo Mix " +
            "as a fallback."
          : err.message;
        this.emit("error", new Error(msg));
      });
      this._stream.start();

      console.log(
        `[WasapiLoopbackCapture] started — mode=${mode} device="${device.name}" ` +
        `(id=${device.id}) sampleRate=${this.sampleRate}`
      );
    } catch (err) {
      this._stream = null;
      const msg = mode === "wasapi-loopback"
        ? `WASAPI loopback open failed on "${device.name}": ${err.message}. ` +
          "Try installing VB-Audio Cable (https://vb-audio.com/Cable/) or enabling Stereo Mix."
        : err.message;
      this.emit("error", new Error(msg));
    }
  }

  stop() {
    if (!this._stream) return;
    this._stream.quit();
    this._stream = null;
    console.log("[WasapiLoopbackCapture] stopped");
  }
}

module.exports = { WasapiLoopbackCapture, findLoopbackDevice };
