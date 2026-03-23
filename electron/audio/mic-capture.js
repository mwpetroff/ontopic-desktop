/**
 * Microphone Capture (all platforms)
 *
 * Uses naudiodon (PortAudio) to capture the selected (or default) input device
 * at 16 kHz mono — the format Whisper expects.
 *
 * Emits:
 *   "data"  — Buffer of raw 16-bit PCM samples
 *   "error" — Error if the stream fails to open or encounters a device error
 */

const { EventEmitter } = require("events");
const portAudio = require("naudiodon");

class MicCapture extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number} [opts.sampleRate=16000]
   * @param {number} [opts.channels=1]
   * @param {number} [opts.deviceId=-1]  -1 = system default input device
   */
  constructor({ sampleRate = 16000, channels = 1, deviceId = -1 } = {}) {
    super();
    this.sampleRate = sampleRate;
    this.channels   = channels;
    this.deviceId   = deviceId;
    this._stream    = null;
  }

  async start() {
    if (this._stream) return; // already running

    try {
      this._stream = portAudio.AudioIO({
        inOptions: {
          channelCount:   this.channels,
          sampleFormat:   portAudio.SampleFormat16Bit,
          sampleRate:     this.sampleRate,
          deviceId:       this.deviceId,
          closeOnError:   false,
        },
      });

      this._stream.on("data",  (chunk) => this.emit("data", chunk));
      this._stream.on("error", (err)   => this.emit("error", err));
      this._stream.start();

      const deviceName = this.deviceId === -1
        ? "default"
        : portAudio.getDevices().find(d => d.id === this.deviceId)?.name ?? `id=${this.deviceId}`;
      console.log(`[MicCapture] started — device: ${deviceName}`);
    } catch (err) {
      this._stream = null;
      this.emit("error", err);
    }
  }

  stop() {
    if (!this._stream) return;
    this._stream.quit();
    this._stream = null;
    console.log("[MicCapture] stopped");
  }
}

module.exports = { MicCapture };
