/**
   * Speaker / Loopback Capture — Platform Router
   *
   * Dynamically loads the correct platform implementation:
   *   Windows  → WASAPI Loopback via native addon
   *   macOS    → CoreAudio via BlackHole virtual device
   *   Linux    → PulseAudio monitor source
   */

  function SpeakerCapture(options) {
    const platform = process.platform;

    if (platform === "win32") {
      const { WasapiLoopbackCapture } = require("./speaker-capture-win");
      return new WasapiLoopbackCapture(options);
    } else if (platform === "darwin") {
      const { CoreAudioLoopbackCapture } = require("./speaker-capture-mac");
      return new CoreAudioLoopbackCapture(options);
    } else {
      const { PulseAudioMonitorCapture } = require("./speaker-capture-linux");
      return new PulseAudioMonitorCapture(options);
    }
  }

  module.exports = { SpeakerCapture };
  