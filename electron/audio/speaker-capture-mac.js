/**
   * macOS Speaker Loopback — CoreAudio + BlackHole Virtual Driver
   *
   * Implementation plan:
   *
   * Prerequisites (installed once via first-launch wizard):
   *   1. Install BlackHole 2ch (open source, MIT):
   *      https://github.com/ExistentialAudio/BlackHole
   *      Bundle the .pkg installer and run with admin prompt on first launch.
   *
   *   2. Create a macOS Multi-Output Device that routes to BOTH:
   *        a. The user's real output (speakers / headset)
   *        b. BlackHole 2ch (virtual loopback)
   *      This can be automated via the CoreAudio aggregate device API or
   *      via a Swift/ObjC helper binary bundled with the app.
   *
   *   3. OnTopic reads from the BlackHole input device (mirrors the output).
   *
   * Capture code:
   *   - Use naudiodon (PortAudio) — on macOS it enumerates CoreAudio devices
   *     including BlackHole. Find the device named "BlackHole 2ch" and open it
   *     for input capture.
   *   - OR use AVAudioEngine with AVAudioInputNode pointed at the BlackHole device.
   *
   * macOS Permissions:
   *   - Microphone: NSMicrophoneUsageDescription in Info.plist (standard prompt)
   *   - System audio: No OS permission required — BlackHole handles it via driver
   *
   * macOS 14+ Sonoma alternative:
   *   ScreenCaptureKit now supports audio-only capture of specific audio streams.
   *   This may eventually replace the BlackHole requirement. Evaluate for v2.
   */

  const { EventEmitter } = require("events");

  class CoreAudioLoopbackCapture extends EventEmitter {
    constructor({ sampleRate = 16000, channels = 1 } = {}) {
      super();
      this.sampleRate = sampleRate;
      this.channels   = channels;
    }

    async start() {
      // STUB — replace with naudiodon pointed at BlackHole device
      console.log("[CoreAudioLoopbackCapture] STUB — macOS CoreAudio + BlackHole goes here");

      // When implemented:
      // const portAudio = require("naudiodon");
      // const devices = portAudio.getDevices();
      // const blackhole = devices.find(d => d.name.includes("BlackHole"));
      // this._stream = portAudio.AudioIO({ inOptions: { deviceId: blackhole.id, ... } });
      // this._stream.on("data", (chunk) => this.emit("data", chunk));
      // this._stream.start();
    }

    stop() {
      this._stream?.quit();
      console.log("[CoreAudioLoopbackCapture] stopped");
    }
  }

  module.exports = { CoreAudioLoopbackCapture };
  