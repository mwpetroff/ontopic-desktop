/**
 * useAudioCapture — Desktop (Electron) version
 *
 * Replaces the browser's getUserMedia approach. Audio capture happens in the
 * main process; this hook receives labeled PCM chunks via IPC and feeds them
 * into the existing transcription pipeline unchanged.
 *
 * Speaker labels:
 *   "mic"     → local user (AE / consultant)
 *   "speaker" → remote participants (prospect / client)
 *
 * API surface intentionally matches the legacy browser hook so that
 * dashboard.tsx requires no changes:
 *   - useAudioCapture({ intervalMs?, deviceId?, onFrequencyData? })
 *   - returns { startCapture(cb), stopCapture(), audioLevel, isCapturing, ... }
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AudioDevice {
  id: number;
  name: string;
  hostAPIName: string;
}

declare global {
  interface Window {
    electronAudio?: {
      listDevices:     () => Promise<AudioDevice[]>;
      startCapture:    (opts?: { micDeviceId?: number }) => Promise<{ ok: boolean }>;
      stopCapture:     () => Promise<{ ok: boolean }>;
      getStatus:       () => Promise<{ active: boolean }>;
      getPlatform:     () => Promise<string>;
      onAudioChunk:    (cb: (data: { buffer: ArrayBuffer; label: "mic" | "speaker" }) => void) => () => void;
      onCaptureStatus: (cb: (data: { active: boolean }) => void) => () => void;
      onCaptureError:  (cb: (data: { source: "mic" | "speaker"; message: string }) => void) => () => void;
      getApiKey:       () => Promise<string>;
      setApiKey:       (key: string) => Promise<void>;
    };
  }
}

// ── WAV encoding ──────────────────────────────────────────────────────────────

/**
 * Wrap raw 16-bit little-endian PCM in a minimal WAV container.
 * naudiodon emits signed 16-bit LE samples at the configured sampleRate.
 */
function pcmToWavBlob(pcm: ArrayBuffer, sampleRate = 16000, channels = 1): Blob {
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.byteLength;
  const header = new ArrayBuffer(44);
  const v = new DataView(header);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0,  "RIFF");
  v.setUint32(4,  36 + dataSize, true);  // chunk size
  writeStr(8,  "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);             // PCM sub-chunk size
  v.setUint16(20, 1, true);              // PCM format
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  v.setUint32(40, dataSize, true);

  return new Blob([header, pcm], { type: "audio/wav" });
}

/**
 * Compute RMS audio level from a 16-bit signed PCM buffer, normalised to [0, 1].
 */
function rmsLevel(pcm: ArrayBuffer): number {
  const samples = new Int16Array(pcm);
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += (samples[i] / 32768) ** 2;
  return Math.sqrt(sum / samples.length);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseAudioCaptureOptions {
  /** Ignored in Electron mode — chunk timing is controlled by the main process. */
  intervalMs?: number;
  deviceId?: number;
  onFrequencyData?: (data: Float32Array) => void;
}

export interface CaptureError {
  source: "mic" | "speaker";
  message: string;
}

export function useAudioCapture({ deviceId, onFrequencyData }: UseAudioCaptureOptions = {}) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [audioLevel, setAudioLevel]   = useState(0);
  const [platform, setPlatform]       = useState<string | null>(null);
  const [isElectron, setIsElectron]   = useState(false);
  const [devices, setDevices]         = useState<AudioDevice[]>();
  const [captureErrors, setCaptureErrors] = useState<CaptureError[]>([]);

  // Callback stored by startCapture; called with a WAV Blob per PCM chunk.
  const chunkCallbackRef = useRef<((blob: Blob) => void) | null>(null);

  const unsubChunkRef  = useRef<(() => void) | null>(null);
  const unsubStatusRef = useRef<(() => void) | null>(null);
  const unsubErrorRef  = useRef<(() => void) | null>(null);

  useEffect(() => {
    const electron = window.electronAudio;
    if (!electron) return; // Running in plain browser — no-op

    setIsElectron(true);

    electron.getPlatform().then((p) => setPlatform(p));
    electron.listDevices().then((list) => setDevices(list));

    unsubChunkRef.current = electron.onAudioChunk(({ buffer, label }) => {
      const level = rmsLevel(buffer);
      setAudioLevel(level);

      // Feed frequency visualizer if requested (synthesise a flat spectrum from RMS)
      if (onFrequencyData) {
        const fakeFreq = new Float32Array(128).fill(-100 + level * 100);
        onFrequencyData(fakeFreq);
      }

      if (chunkCallbackRef.current) {
        const blob = pcmToWavBlob(buffer, 16000, 1);
        chunkCallbackRef.current(blob);
      }
    });

    unsubStatusRef.current = electron.onCaptureStatus(({ active }) => {
      setIsCapturing(active);
      if (!active) setAudioLevel(0);
    });

    unsubErrorRef.current = electron.onCaptureError(({ source, message }) => {
      console.warn(`[useAudioCapture] capture warning [${source}]:`, message);
      setCaptureErrors((prev) => {
        // Deduplicate by source — only keep the latest error per source
        const filtered = prev.filter((e) => e.source !== source);
        return [...filtered, { source, message }];
      });
    });

    electron.getStatus().then(({ active }) => setIsCapturing(active));

    return () => {
      unsubChunkRef.current?.();
      unsubStatusRef.current?.();
      unsubErrorRef.current?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCapture = useCallback(async (callback: (blob: Blob) => void) => {
    if (!window.electronAudio) throw new Error("Electron audio not available");
    setCaptureErrors([]);
    chunkCallbackRef.current = callback;
    await window.electronAudio.startCapture(
      deviceId !== undefined ? { micDeviceId: deviceId } : undefined
    );
  }, [deviceId]);

  const stopCapture = useCallback(async () => {
    chunkCallbackRef.current = null;
    setAudioLevel(0);
    await window.electronAudio?.stopCapture();
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!window.electronAudio) return;
    const list = await window.electronAudio.listDevices();
    setDevices(list);
  }, []);

  const dismissCaptureError = useCallback((source: "mic" | "speaker") => {
    setCaptureErrors((prev) => prev.filter((e) => e.source !== source));
  }, []);

  return { isCapturing, startCapture, stopCapture, audioLevel, platform, isElectron, devices, refreshDevices, captureErrors, dismissCaptureError };
}
