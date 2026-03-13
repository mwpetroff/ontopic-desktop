/**
   * Microphone Capture (all platforms)
   *
   * Uses naudiodon (PortAudio Node binding) to capture the default
   * input device at 16 kHz mono — the format Whisper expects.
   *
   * Emits "data" events with raw PCM Buffer chunks.
   */

  const { EventEmitter } = require("events");

  class MicCapture extends EventEmitter {
    constructor({ sampleRate = 16000, channels = 1 } = {}) {
      super();
      this.sampleRate = sampleRate;
      this.channels   = channels;
      this._stream    = null;
    }

    async start() {
      // TODO: replace stub with real naudiodon implementation
      // const portAudio = require("naudiodon");
      // this._stream = portAudio.AudioIO({
      //   inOptions: {
      //     channelCount: this.channels,
      //     sampleFormat: portAudio.SampleFormat16Bit,
      //     sampleRate: this.sampleRate,
      //     deviceId: -1,  // -1 = default input device
      //     closeOnError: false,
      //   }
      // });
      // this._stream.on("data", (chunk) => this.emit("data", chunk));
      // this._stream.start();

      console.log("[MicCapture] STUB — real naudiodon capture goes here");
    }

    stop() {
      this._stream?.quit();
      this._stream = null;
    }
  }

  module.exports = { MicCapture };
  