/**
 * AudioMixer unit tests.
 *
 * These cover the pure buffering/chunking logic without touching any audio
 * hardware. The mixer receives raw PCM buffers and fires onChunk when enough
 * data has accumulated to fill one chunk.
 */
import { describe, it, expect, vi } from "vitest";
import { AudioMixer } from "../electron/audio/audio-mixer";

const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = 2; // 16-bit PCM
const CHUNK_MS = 100; // small chunk for fast tests
const CHUNK_BYTES = (SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * CHUNK_MS) / 1000; // 3200

function makePcm(bytes: number): Buffer {
  return Buffer.alloc(bytes, 0);
}

describe("AudioMixer", () => {
  it("fires onChunk when exactly one chunk of data arrives", () => {
    const onChunk = vi.fn();
    const mixer = new AudioMixer({ sampleRate: SAMPLE_RATE, channels: CHANNELS, chunkMs: CHUNK_MS, onChunk });
    mixer.push("mic", makePcm(CHUNK_BYTES));
    expect(onChunk).toHaveBeenCalledOnce();
    expect(onChunk).toHaveBeenCalledWith(expect.any(Buffer), "mic");
  });

  it("does not fire until a full chunk accumulates", () => {
    const onChunk = vi.fn();
    const mixer = new AudioMixer({ sampleRate: SAMPLE_RATE, channels: CHANNELS, chunkMs: CHUNK_MS, onChunk });
    mixer.push("mic", makePcm(CHUNK_BYTES - 1));
    expect(onChunk).not.toHaveBeenCalled();
  });

  it("fires multiple times when several chunks worth of data arrives at once", () => {
    const onChunk = vi.fn();
    const mixer = new AudioMixer({ sampleRate: SAMPLE_RATE, channels: CHANNELS, chunkMs: CHUNK_MS, onChunk });
    mixer.push("mic", makePcm(CHUNK_BYTES * 3));
    expect(onChunk).toHaveBeenCalledTimes(3);
  });

  it("accumulates partial buffers across multiple push calls", () => {
    const onChunk = vi.fn();
    const mixer = new AudioMixer({ sampleRate: SAMPLE_RATE, channels: CHANNELS, chunkMs: CHUNK_MS, onChunk });
    mixer.push("mic", makePcm(CHUNK_BYTES / 2));
    expect(onChunk).not.toHaveBeenCalled();
    mixer.push("mic", makePcm(CHUNK_BYTES / 2));
    expect(onChunk).toHaveBeenCalledOnce();
  });

  it("tracks mic and speaker labels independently", () => {
    const chunks: Array<{ label: string }> = [];
    const mixer = new AudioMixer({
      sampleRate: SAMPLE_RATE, channels: CHANNELS, chunkMs: CHUNK_MS,
      onChunk: (_buf, label) => chunks.push({ label }),
    });
    mixer.push("mic", makePcm(CHUNK_BYTES));
    mixer.push("speaker", makePcm(CHUNK_BYTES));
    expect(chunks).toHaveLength(2);
    expect(chunks[0].label).toBe("mic");
    expect(chunks[1].label).toBe("speaker");
  });

  it("fired chunks are exactly chunkBytes in size", () => {
    const sizes: number[] = [];
    const mixer = new AudioMixer({
      sampleRate: SAMPLE_RATE, channels: CHANNELS, chunkMs: CHUNK_MS,
      onChunk: (buf) => sizes.push(buf.length),
    });
    mixer.push("mic", makePcm(CHUNK_BYTES * 2 + 100));
    expect(sizes).toHaveLength(2);
    expect(sizes[0]).toBe(CHUNK_BYTES);
    expect(sizes[1]).toBe(CHUNK_BYTES);
  });

  it("flushes remaining data on stop and fires onChunk", () => {
    const onChunk = vi.fn();
    const mixer = new AudioMixer({ sampleRate: SAMPLE_RATE, channels: CHANNELS, chunkMs: CHUNK_MS, onChunk });
    mixer.push("mic", makePcm(CHUNK_BYTES / 2));
    expect(onChunk).not.toHaveBeenCalled();
    mixer.stop();
    expect(onChunk).toHaveBeenCalledOnce();
  });

  it("ignores push calls after stop", () => {
    const onChunk = vi.fn();
    const mixer = new AudioMixer({ sampleRate: SAMPLE_RATE, channels: CHANNELS, chunkMs: CHUNK_MS, onChunk });
    mixer.stop();
    mixer.push("mic", makePcm(CHUNK_BYTES));
    expect(onChunk).not.toHaveBeenCalled();
  });

  it("does not fire onChunk if no data was pushed before stop", () => {
    const onChunk = vi.fn();
    const mixer = new AudioMixer({ sampleRate: SAMPLE_RATE, channels: CHANNELS, chunkMs: CHUNK_MS, onChunk });
    mixer.stop();
    expect(onChunk).not.toHaveBeenCalled();
  });
});
