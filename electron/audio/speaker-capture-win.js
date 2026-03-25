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
 * Find the best available loopback input device.
 * Returns the DeviceInfo object or null if none found.
 *
 * @param {object} [portAudio]  naudiodon instance; defaults to require("naudiodon").
 */
function findLoopbackDevice(portAudio = require("naudiodon")) {
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

    const device = findLoopbackDevice(this._portAudio);
    if (!device) {
      this.emit(
        "error",
        new Error(
          "No loopback capture device found. Enable Stereo Mix in Windows Sound settings (Recording tab → Show Disabled Devices → Enable Stereo Mix), or install VB-Audio Cable."
        )
      );
      return;
    }

    try {
      this._stream = this._portAudio.AudioIO({
        inOptions: {
          // Cap channels to what the device supports
          channelCount: Math.min(this.channels, device.maxInputChannels),
          sampleFormat: this._portAudio.SampleFormat16Bit,
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
