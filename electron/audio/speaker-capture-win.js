/**
 * Windows Speaker Loopback — Stereo Mix / WDM-KS
 *
 * Strategy: Windows exposes a "Stereo Mix" (or "What U Hear") capture device
 * via WDM-KS that mirrors everything being played through the default output.
 * This is the most reliable loopback approach with naudiodon/PortAudio on Windows
 * because it requires no special WASAPI flags and no custom native addon.
 *
 * Requirement: Stereo Mix must be enabled in Windows Sound settings.
 *   Right-click the speaker icon → Sounds → Recording tab
 *   → right-click in empty area → "Show Disabled Devices" → Enable "Stereo Mix"
 *
 * The first-launch setup wizard guides the user through enabling it if not found.
 *
 * Emits:
 *   "data"  — Buffer of raw 16-bit PCM samples at the configured sampleRate
 *   "error" — Error with a user-readable message if no loopback device is found
 */

const { EventEmitter } = require("events");
const portAudio = require("naudiodon");

// Device name fragments that identify a loopback/mix capture source on Windows.
// Listed in priority order — first match wins.
const LOOPBACK_KEYWORDS = [
  "stereo mix",
  "what u hear",
  "wave out mix",
  "mix output",
  "sum",
];

/**
 * Find the best available loopback input device.
 * Returns the DeviceInfo object or null if none found.
 */
function findLoopbackDevice() {
  const devices = portAudio.getDevices();
  for (const keyword of LOOPBACK_KEYWORDS) {
    const match = devices.find(
      (d) =>
        d.maxInputChannels > 0 &&
        d.name.toLowerCase().includes(keyword)
    );
    if (match) return match;
  }
  return null;
}

class WasapiLoopbackCapture extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number} [opts.sampleRate=16000]
   * @param {number} [opts.channels=1]
   */
  constructor({ sampleRate = 16000, channels = 1 } = {}) {
    super();
    this.sampleRate = sampleRate;
    this.channels   = channels;
    this._stream    = null;
  }

  async start() {
    if (this._stream) return;

    const device = findLoopbackDevice();
    if (!device) {
      this.emit(
        "error",
        new Error(
          "No loopback capture device found.\n\n" +
          "To enable Stereo Mix on Windows:\n" +
          "  1. Right-click the speaker icon in the taskbar\n" +
          "  2. Open Sounds → Recording tab\n" +
          "  3. Right-click in an empty area → Show Disabled Devices\n" +
          "  4. Right-click Stereo Mix → Enable\n\n" +
          "Then restart OnTopic."
        )
      );
      return;
    }

    try {
      this._stream = portAudio.AudioIO({
        inOptions: {
          // Cap channels to what the device supports
          channelCount: Math.min(this.channels, device.maxInputChannels),
          sampleFormat: portAudio.SampleFormat16Bit,
          sampleRate:   this.sampleRate,
          deviceId:     device.id,
          closeOnError: false,
        },
      });

      this._stream.on("data",  (chunk) => this.emit("data", chunk));
      this._stream.on("error", (err)   => this.emit("error", err));
      this._stream.start();

      console.log(`[WasapiLoopbackCapture] started — device: "${device.name}" (id=${device.id})`);
    } catch (err) {
      this._stream = null;
      this.emit("error", err);
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
