/**
 * MicCapture unit tests.
 *
 * Tests the start/stop lifecycle and event forwarding without touching any real
 * audio hardware. A mock portAudio object is injected via the constructor so the
 * native naudiodon addon is never loaded by the test runner.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { MicCapture } from "../electron/audio/mic-capture";

// ── Mock portAudio ────────────────────────────────────────────────────────────

class MockStream extends EventEmitter {
  start = vi.fn();
  quit  = vi.fn();
}

const SampleFormat16Bit = 16;

function makeMockPortAudio(stream: MockStream) {
  return {
    AudioIO:          vi.fn(() => stream),
    SampleFormat16Bit,
    getDevices:       vi.fn(() => [
      { id: 0, name: "Default Input",    maxInputChannels: 2, hostAPIName: "MME"    },
      { id: 1, name: "Microphone (USB)", maxInputChannels: 2, hostAPIName: "WASAPI" },
    ]),
  };
}

let mockStream: MockStream;
let mockPortAudio: ReturnType<typeof makeMockPortAudio>;

beforeEach(() => {
  mockStream    = new MockStream();
  mockPortAudio = makeMockPortAudio(mockStream);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MicCapture", () => {
  it("calls AudioIO with correct options on start", async () => {
    const mic = new MicCapture({ sampleRate: 16000, channels: 1, deviceId: -1, portAudio: mockPortAudio });
    await mic.start();

    expect(mockPortAudio.AudioIO).toHaveBeenCalledOnce();
    expect(mockPortAudio.AudioIO).toHaveBeenCalledWith({
      inOptions: {
        channelCount:  1,
        sampleFormat:  SampleFormat16Bit,
        sampleRate:    16000,
        deviceId:      -1,
        closeOnError:  false,
      },
    });
    expect(mockStream.start).toHaveBeenCalledOnce();
  });

  it("respects custom deviceId, sampleRate, and channels", async () => {
    const mic = new MicCapture({ sampleRate: 44100, channels: 2, deviceId: 1, portAudio: mockPortAudio });
    await mic.start();

    const opts = mockPortAudio.AudioIO.mock.calls[0][0] as any;
    expect(opts.inOptions.sampleRate).toBe(44100);
    expect(opts.inOptions.channelCount).toBe(2);
    expect(opts.inOptions.deviceId).toBe(1);
  });

  it("is idempotent — calling start twice creates only one stream", async () => {
    const mic = new MicCapture({ portAudio: mockPortAudio });
    await mic.start();
    await mic.start();
    expect(mockPortAudio.AudioIO).toHaveBeenCalledOnce();
  });

  it("forwards data events from the stream", async () => {
    const onData = vi.fn();
    const mic = new MicCapture({ portAudio: mockPortAudio });
    mic.on("data", onData);
    await mic.start();

    const pcm = Buffer.alloc(100);
    mockStream.emit("data", pcm);

    expect(onData).toHaveBeenCalledOnce();
    expect(onData).toHaveBeenCalledWith(pcm);
  });

  it("forwards error events from the stream", async () => {
    const onError = vi.fn();
    const mic = new MicCapture({ portAudio: mockPortAudio });
    mic.on("error", onError);
    await mic.start();

    const err = new Error("device disconnected");
    mockStream.emit("error", err);

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(err);
  });

  it("emits error and clears stream if AudioIO throws", async () => {
    mockPortAudio.AudioIO.mockImplementationOnce(() => { throw new Error("no device"); });

    const onError = vi.fn();
    const mic = new MicCapture({ portAudio: mockPortAudio });
    mic.on("error", onError);
    await mic.start();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toBe("no device");

    // After a failed start the stream slot is clear — can retry
    mockPortAudio.AudioIO.mockReturnValue(mockStream);
    await mic.start();
    expect(mockPortAudio.AudioIO).toHaveBeenCalledTimes(2);
  });

  it("calls quit on stop", async () => {
    const mic = new MicCapture({ portAudio: mockPortAudio });
    await mic.start();
    mic.stop();
    expect(mockStream.quit).toHaveBeenCalledOnce();
  });

  it("allows re-start after stop", async () => {
    const mic = new MicCapture({ portAudio: mockPortAudio });
    await mic.start();
    mic.stop();

    const mockStream2 = new MockStream();
    mockPortAudio.AudioIO.mockReturnValue(mockStream2);
    await mic.start();
    expect(mockPortAudio.AudioIO).toHaveBeenCalledTimes(2);
  });

  it("stop is idempotent", async () => {
    const mic = new MicCapture({ portAudio: mockPortAudio });
    await mic.start();
    mic.stop();
    expect(() => mic.stop()).not.toThrow();
    expect(mockStream.quit).toHaveBeenCalledOnce();
  });

  it("stop before start is a no-op", () => {
    const mic = new MicCapture({ portAudio: mockPortAudio });
    expect(() => mic.stop()).not.toThrow();
  });
});
