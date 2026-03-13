/**
   * Audio Mixer
   *
   * Receives PCM chunks from two streams (mic + speaker loopback),
   * labels them by source, buffers into chunks of configurable duration,
   * and fires onChunk callbacks for downstream transcription.
   *
   * Speaker labels:
   *   - "mic"     → the local user (always known)
   *   - "speaker" → remote participant(s) — further diarized by Whisper
   *
   * This dual-stream design gives us clean speaker separation before
   * Whisper even sees the audio, dramatically improving diarization accuracy.
   */

  class AudioMixer {
    constructor({ sampleRate = 16000, channels = 1, chunkMs = 5000, onChunk } = {}) {
      this.sampleRate = sampleRate;
      this.channels   = channels;
      this.chunkMs    = chunkMs;
      this.onChunk    = onChunk;

      // Bytes per chunk: sampleRate * channels * 2 (16-bit) * (chunkMs / 1000)
      this.chunkBytes = Math.floor(sampleRate * channels * 2 * (chunkMs / 1000));

      this._buffers = { mic: Buffer.alloc(0), speaker: Buffer.alloc(0) };
      this._active  = true;
    }

    /**
     * Push a raw PCM Buffer into the mixer for a given source label.
     * When the buffer reaches chunkBytes, it fires onChunk and resets.
     */
    push(label, pcm) {
      if (!this._active) return;
      if (!this._buffers[label]) this._buffers[label] = Buffer.alloc(0);

      this._buffers[label] = Buffer.concat([this._buffers[label], pcm]);

      while (this._buffers[label].length >= this.chunkBytes) {
        const chunk = this._buffers[label].slice(0, this.chunkBytes);
        this._buffers[label] = this._buffers[label].slice(this.chunkBytes);
        this.onChunk?.(chunk, label);
      }
    }

    /** Flush any remaining buffered audio and stop. */
    stop() {
      this._active = false;
      for (const [label, buf] of Object.entries(this._buffers)) {
        if (buf.length > 0) this.onChunk?.(buf, label);
      }
      this._buffers = {};
    }
  }

  module.exports = { AudioMixer };
  