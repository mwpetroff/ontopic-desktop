// @vitest-environment jsdom
/**
 * BL-006: useAudioCapture web fallback path (jsdom environment)
 *
 * When window.electronAudio is absent the hook must return safe defaults
 * and never throw — this covers the browser / non-Electron path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioCapture } from "../src/hooks/use-audio-capture";

beforeEach(() => {
  // Ensure no Electron shim leaks between tests.
  delete (window as any).electronAudio;
});

describe("useAudioCapture — web (non-Electron) fallback", () => {
  it("returns isElectron=false when window.electronAudio is absent", () => {
    const { result } = renderHook(() => useAudioCapture());
    expect(result.current.isElectron).toBe(false);
  });

  it("returns isCapturing=false initially", () => {
    const { result } = renderHook(() => useAudioCapture());
    expect(result.current.isCapturing).toBe(false);
  });

  it("returns audioLevel=0 initially", () => {
    const { result } = renderHook(() => useAudioCapture());
    expect(result.current.audioLevel).toBe(0);
  });

  it("startCapture throws when Electron is unavailable", async () => {
    const { result } = renderHook(() => useAudioCapture());
    await expect(
      act(() => result.current.startCapture(() => {}))
    ).rejects.toThrow("Electron audio not available");
  });

  it("stopCapture resolves without throwing when Electron is unavailable", async () => {
    const { result } = renderHook(() => useAudioCapture());
    await expect(act(() => result.current.stopCapture())).resolves.not.toThrow();
  });

  it("platform is null when Electron is unavailable", () => {
    const { result } = renderHook(() => useAudioCapture());
    expect(result.current.platform).toBeNull();
  });

  it("devices is undefined when Electron is unavailable", () => {
    const { result } = renderHook(() => useAudioCapture());
    expect(result.current.devices).toBeUndefined();
  });

  it("captureErrors is empty array initially", () => {
    const { result } = renderHook(() => useAudioCapture());
    expect(result.current.captureErrors).toEqual([]);
  });

  it("refreshDevices resolves without throwing when Electron is unavailable", async () => {
    const { result } = renderHook(() => useAudioCapture());
    await expect(act(() => result.current.refreshDevices())).resolves.not.toThrow();
  });

  it("dismissCaptureError does not throw", () => {
    const { result } = renderHook(() => useAudioCapture());
    expect(() => result.current.dismissCaptureError("mic")).not.toThrow();
  });
});
