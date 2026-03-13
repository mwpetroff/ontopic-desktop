/**
   * Windows Speaker Loopback — WASAPI
   *
   * Implementation plan:
   *
   * 1. Write a C++ native Node addon (node-addon-api) that:
   *    - Calls IMMDeviceEnumerator::GetDefaultAudioEndpoint(eRender, ...)
   *    - Opens IAudioClient in loopback mode (AUDCLNT_STREAMFLAGS_LOOPBACK)
   *    - Reads frames via IAudioCaptureClient::GetBuffer
   *    - Resamples to 16 kHz mono if needed (using Windows MF resampler or libresample)
   *    - Streams raw PCM to JS via a Node.js readable stream
   *
   * 2. OR: use naudiodon with PortAudio WASAPI backend
   *    PortAudio 19 supports WASAPI loopback via:
   *    paWASAPI_AutoConvert | paWASAPI_UseDefaultDevice | paWASAPI_ThreadPriority
   *    and paWasapiJackConnectionChanged callback.
   *
   * Key Windows APIs:
   *   - IMMDeviceEnumerator (mmdeviceapi.h)
   *   - IAudioClient, IAudioCaptureClient (audioclient.h)
   *   - AUDCLNT_STREAMFLAGS_LOOPBACK (0x00020000)
   *
   * Bluetooth headsets:
   *   - When set as default playback device, WASAPI loopback captures automatically.
   *   - HSP/HFP profile downgrade (8 kHz mono) is a BT protocol limit, not an app limit.
   *   - Use A2DP sink (high-quality) for playback; mic uses HFP separately.
   */

  const { EventEmitter } = require("events");

  class WasapiLoopbackCapture extends EventEmitter {
    constructor({ sampleRate = 16000, channels = 1 } = {}) {
      super();
      this.sampleRate = sampleRate;
      this.channels   = channels;
    }

    async start() {
      // STUB — replace with native addon or naudiodon WASAPI loopback
      console.log("[WasapiLoopbackCapture] STUB — Windows WASAPI loopback goes here");

      // When implemented, this will emit "data" events with PCM chunks:
      // this._addon.startLoopback((pcmChunk) => this.emit("data", pcmChunk));
    }

    stop() {
      // this._addon?.stop();
      console.log("[WasapiLoopbackCapture] stopped");
    }
  }

  module.exports = { WasapiLoopbackCapture };
  