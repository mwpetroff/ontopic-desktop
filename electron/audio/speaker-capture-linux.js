"use strict";
/**
 * Linux Speaker Loopback — PulseAudio / PipeWire Monitor Source
 *
 * PulseAudio (and PipeWire's PulseAudio compatibility layer) automatically
 * creates a "<sink>.monitor" source for every output sink.  We capture it
 * with `parec`, which is part of the pulseaudio-utils package.
 *
 * Emits:
 *   "data"  — Buffer of raw 16-bit LE PCM at the configured sampleRate
 *   "error" — Error with a user-readable message
 */

const { EventEmitter } = require("events");
const { execSync, spawn } = require("child_process");

class PulseAudioMonitorCapture extends EventEmitter {
  constructor({ sampleRate = 16000, channels = 1 } = {}) {
    super();
    this.sampleRate = sampleRate;
    this.channels   = channels;
    this._process   = null;
  }

  _getMonitorSource() {
    try {
      const info = execSync("pactl info 2>/dev/null", { timeout: 3000 }).toString();
      const match = info.match(/Default Sink:\s*(.+)/);
      if (match) return match[1].trim() + ".monitor";
    } catch {}
    return null;
  }

  _checkAudioGroup() {
    try {
      const groups = execSync("groups 2>/dev/null", { timeout: 2000 }).toString();
      // "audio" and "pulse-access" are the two groups that grant PulseAudio access.
      return groups.includes("audio") || groups.includes("pulse-access");
    } catch {
      return true; // assume OK if the groups command is unavailable
    }
  }

  async start() {
    const monitorSource = this._getMonitorSource();
    if (!monitorSource) {
      this.emit(
        "error",
        new Error(
          "Could not detect PulseAudio/PipeWire monitor source. " +
          "Is PulseAudio running? Try: pactl info"
        )
      );
      return;
    }

    if (!this._checkAudioGroup()) {
      this.emit(
        "error",
        new Error(
          "User is not in the 'audio' group. " +
          "Fix: sudo usermod -aG audio $USER  (then log out and back in)"
        )
      );
      return;
    }

    this._process = spawn("parec", [
      `--device=${monitorSource}`,
      "--format=s16le",
      `--rate=${this.sampleRate}`,
      `--channels=${this.channels}`,
      "--latency-msec=50",
    ]);

    this._process.stdout.on("data", (chunk) => this.emit("data", chunk));

    this._process.stderr.on("data", (data) => {
      console.warn("[PulseAudioMonitorCapture] parec:", data.toString().trim());
    });

    this._process.on("error", (err) => {
      if (err.code === "ENOENT") {
        this.emit(
          "error",
          new Error(
            "'parec' not found. Install with: sudo apt install pulseaudio-utils"
          )
        );
      } else {
        this.emit("error", err);
      }
    });

    this._process.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[PulseAudioMonitorCapture] parec exited with code ${code}`);
      }
    });

    console.log(`[PulseAudioMonitorCapture] started — device: ${monitorSource}`);
  }

  stop() {
    if (this._process) {
      this._process.kill("SIGTERM");
      this._process = null;
    }
    console.log("[PulseAudioMonitorCapture] stopped");
  }
}

module.exports = { PulseAudioMonitorCapture };
