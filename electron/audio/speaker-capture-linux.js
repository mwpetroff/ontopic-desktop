/**
   * Linux Speaker Loopback — PulseAudio / PipeWire Monitor Source
   *
   * Implementation plan:
   *
   * PulseAudio automatically creates a "monitor source" for every sink (output).
   * The monitor source name is: <sink_name>.monitor
   *
   * Steps:
   *   1. Find the default sink: `pactl info | grep "Default Sink"`
   *   2. Find its monitor source: append ".monitor" to the sink name
   *   3. Open the monitor source for recording via:
   *        - naudiodon (PortAudio with PulseAudio backend)
   *        - OR: node-record-lpcm16 with `arecord -D pulse` or `parec`
   *
   * PipeWire (Fedora 35+, Ubuntu 22.04+):
   *   PipeWire is a drop-in PulseAudio replacement. The same monitor source
   *   approach works identically — no code changes needed.
   *
   * No extra drivers or permissions required.
   * User must be in the "audio" group (default on Ubuntu/Fedora desktops).
   *
   * Alternative: spawn a `parec` child process and pipe stdout:
   *   parec --device=<monitor_source> --format=s16le --rate=16000 --channels=1
   */

  const { EventEmitter } = require("events");
  const { execSync } = require("child_process");

  class PulseAudioMonitorCapture extends EventEmitter {
    constructor({ sampleRate = 16000, channels = 1 } = {}) {
      super();
      this.sampleRate = sampleRate;
      this.channels   = channels;
      this._process   = null;
    }

    _getMonitorSource() {
      try {
        const info = execSync("pactl info 2>/dev/null").toString();
        const match = info.match(/Default Sink: (.+)/);
        if (match) return match[1].trim() + ".monitor";
      } catch {}
      return "auto_null.monitor"; // fallback
    }

    async start() {
      // STUB — replace with real parec spawn or naudiodon implementation
      const monitorSource = this._getMonitorSource();
      console.log("[PulseAudioMonitorCapture] STUB — monitor source:", monitorSource);

      // When implemented (parec approach):
      // const { spawn } = require("child_process");
      // this._process = spawn("parec", [
      //   "--device=" + monitorSource,
      //   "--format=s16le",
      //   "--rate=" + this.sampleRate,
      //   "--channels=" + this.channels
      // ]);
      // this._process.stdout.on("data", (chunk) => this.emit("data", chunk));
    }

    stop() {
      this._process?.kill();
      this._process = null;
      console.log("[PulseAudioMonitorCapture] stopped");
    }
  }

  module.exports = { PulseAudioMonitorCapture };
  