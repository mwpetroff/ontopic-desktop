/**
 * WasapiLoopbackCapture unit tests (Windows speaker loopback).
 *
 * Tests device detection logic and the start/stop lifecycle without touching any
 * real audio hardware. A mock portAudio object is injected via the constructor
 * and findLoopbackDevice() so the native naudiodon addon is never loaded.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { WasapiLoopbackCapture, findLoopbackDevice } from "../electron/audio/speaker-capture-win";

// ── Mock portAudio ────────────────────────────────────────────────────────────

class MockStream extends EventEmitter {
  start = vi.fn();
  quit  = vi.fn();
}

const SampleFormat16Bit = 16;

function makeMockPortAudio(stream: MockStream, devices: any[] = []) {
  return {
    AudioIO:           vi.fn(() => stream),
    SampleFormat16Bit,
    getDevices:        vi.fn(() => devices),
  };
}

let mockStream: MockStream;
let mockDevices: any[];
let mockPortAudio: ReturnType<typeof makeMockPortAudio>;

beforeEach(() => {
  mockStream    = new MockStream();
  mockDevices   = [];
  mockPortAudio = makeMockPortAudio(mockStream, mockDevices);
});

// ── findLoopbackDevice ────────────────────────────────────────────────────────

describe("findLoopbackDevice", () => {
  it("returns null when no devices are present", () => {
    expect(findLoopbackDevice(mockPortAudio)).toBeNull();
  });

  it("returns null when no device matches any loopback keyword", () => {
    mockDevices.push({ id: 0, name: "Microphone (USB)", maxInputChannels: 2 });
    expect(findLoopbackDevice(mockPortAudio)).toBeNull();
  });

  it("finds a device named 'Stereo Mix' (case-insensitive)", () => {
    mockDevices.push({ id: 5, name: "Stereo Mix (Realtek)", maxInputChannels: 2 });
    expect(findLoopbackDevice(mockPortAudio)?.id).toBe(5);
  });

  it("finds a device named 'What U Hear'", () => {
    mockDevices.push({ id: 3, name: "What U Hear (SoundBlaster)", maxInputChannels: 2 });
    expect(findLoopbackDevice(mockPortAudio)?.id).toBe(3);
  });

  it("finds a device named 'Wave Out Mix'", () => {
    mockDevices.push({ id: 2, name: "Wave Out Mix", maxInputChannels: 1 });
    expect(findLoopbackDevice(mockPortAudio)?.id).toBe(2);
  });

  it("ignores output-only devices (maxInputChannels === 0)", () => {
    mockDevices.push({ id: 1, name: "Stereo Mix",  maxInputChannels: 0 });
    mockDevices.push({ id: 2, name: "What U Hear", maxInputChannels: 2 });
    // stereo mix is output-only — what u hear should match instead
    expect(findLoopbackDevice(mockPortAudio)?.id).toBe(2);
  });

  it("returns the highest-priority keyword match first", () => {
    // "what u hear" is lower priority than "stereo mix"
    mockDevices.push({ id: 10, name: "What U Hear", maxInputChannels: 2 });
    mockDevices.push({ id: 11, name: "Stereo Mix",  maxInputChannels: 2 });
    expect(findLoopbackDevice(mockPortAudio)?.id).toBe(11);
  });
});

// ── WasapiLoopbackCapture ─────────────────────────────────────────────────────

describe("WasapiLoopbackCapture", () => {
  it("emits an error with setup instructions when no loopback device is found", async () => {
    const onError = vi.fn();
    const cap = new WasapiLoopbackCapture({ portAudio: mockPortAudio });
    cap.on("error", onError);
    await cap.start();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toMatch(/stereo mix/i);
    expect(mockPortAudio.AudioIO).not.toHaveBeenCalled();
  });

  it("opens AudioIO with the loopback device id when found", async () => {
    mockDevices.push({ id: 7, name: "Stereo Mix (HD Audio)", maxInputChannels: 2 });
    const cap = new WasapiLoopbackCapture({ sampleRate: 16000, channels: 1, portAudio: mockPortAudio });
    await cap.start();

    expect(mockPortAudio.AudioIO).toHaveBeenCalledOnce();
    const opts = mockPortAudio.AudioIO.mock.calls[0][0] as any;
    expect(opts.inOptions.deviceId).toBe(7);
    expect(opts.inOptions.sampleRate).toBe(16000);
    expect(opts.inOptions.sampleFormat).toBe(SampleFormat16Bit);
    expect(mockStream.start).toHaveBeenCalledOnce();
  });

  it("caps channelCount to device maxInputChannels", async () => {
    mockDevices.push({ id: 4, name: "Stereo Mix", maxInputChannels: 1 });
    const cap = new WasapiLoopbackCapture({ sampleRate: 16000, channels: 2, portAudio: mockPortAudio });
    await cap.start();

    const opts = mockPortAudio.AudioIO.mock.calls[0][0] as any;
    expect(opts.inOptions.channelCount).toBe(1);
  });

  it("is idempotent — calling start twice opens only one stream", async () => {
    mockDevices.push({ id: 4, name: "Stereo Mix", maxInputChannels: 2 });
    const cap = new WasapiLoopbackCapture({ portAudio: mockPortAudio });
    await cap.start();
    await cap.start();
    expect(mockPortAudio.AudioIO).toHaveBeenCalledOnce();
  });

  it("forwards data events from the stream", async () => {
    mockDevices.push({ id: 4, name: "Stereo Mix", maxInputChannels: 2 });
    const onData = vi.fn();
    const cap = new WasapiLoopbackCapture({ portAudio: mockPortAudio });
    cap.on("data", onData);
    await cap.start();

    const pcm = Buffer.alloc(3200);
    mockStream.emit("data", pcm);

    expect(onData).toHaveBeenCalledOnce();
    expect(onData).toHaveBeenCalledWith(pcm);
  });

  it("forwards error events from the stream", async () => {
    mockDevices.push({ id: 4, name: "Stereo Mix", maxInputChannels: 2 });
    const onError = vi.fn();
    const cap = new WasapiLoopbackCapture({ portAudio: mockPortAudio });
    cap.on("error", onError);
    await cap.start();

    mockStream.emit("error", new Error("device lost"));
    expect(onError).toHaveBeenCalledOnce();
  });

  it("emits error and clears stream if AudioIO throws", async () => {
    mockDevices.push({ id: 4, name: "Stereo Mix", maxInputChannels: 2 });
    mockPortAudio.AudioIO.mockImplementationOnce(() => { throw new Error("open failed"); });

    const onError = vi.fn();
    const cap = new WasapiLoopbackCapture({ portAudio: mockPortAudio });
    cap.on("error", onError);
    await cap.start();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toBe("open failed");

    // After failure the stream slot is clear — can retry
    mockPortAudio.AudioIO.mockReturnValue(mockStream);
    await cap.start();
    expect(mockPortAudio.AudioIO).toHaveBeenCalledTimes(2);
  });

  it("calls quit on stop", async () => {
    mockDevices.push({ id: 4, name: "Stereo Mix", maxInputChannels: 2 });
    const cap = new WasapiLoopbackCapture({ portAudio: mockPortAudio });
    await cap.start();
    cap.stop();
    expect(mockStream.quit).toHaveBeenCalledOnce();
  });

  it("stop is idempotent", async () => {
    mockDevices.push({ id: 4, name: "Stereo Mix", maxInputChannels: 2 });
    const cap = new WasapiLoopbackCapture({ portAudio: mockPortAudio });
    await cap.start();
    cap.stop();
    expect(() => cap.stop()).not.toThrow();
    expect(mockStream.quit).toHaveBeenCalledOnce();
  });

  it("stop before start is a no-op", () => {
    const cap = new WasapiLoopbackCapture({ portAudio: mockPortAudio });
    expect(() => cap.stop()).not.toThrow();
  });
});
