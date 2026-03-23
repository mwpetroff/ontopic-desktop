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
    };
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseAudioCaptureOptions {
  onChunk:         (buffer: ArrayBuffer, label: "mic" | "speaker") => void;
  onStatusChange?: (active: boolean) => void;
  onError?:        (source: "mic" | "speaker", message: string) => void;
}

export function useAudioCapture({ onChunk, onStatusChange, onError }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [platform, setPlatform]       = useState<string | null>(null);
  const [isElectron, setIsElectron]   = useState(false);
  const [devices, setDevices]         = useState<AudioDevice[]>([]);

  const unsubChunkRef  = useRef<(() => void) | null>(null);
  const unsubStatusRef = useRef<(() => void) | null>(null);
  const unsubErrorRef  = useRef<(() => void) | null>(null);

  useEffect(() => {
    const electron = window.electronAudio;
    if (!electron) return; // Running in browser — audio capture not available

    setIsElectron(true);

    electron.getPlatform().then((p) => {
      console.log("[useAudioCapture] platform:", p);
      setPlatform(p);
    });

    electron.listDevices().then((list) => {
      console.log("[useAudioCapture] devices:", list.map((d) => `${d.id}:${d.name}`).join(", "));
      setDevices(list);
    });

    console.log("[useAudioCapture] subscribing to audio:chunk");
    unsubChunkRef.current = electron.onAudioChunk(({ buffer, label }) => {
      console.log(`[useAudioCapture] chunk received — label=${label} bytes=${buffer.byteLength}`);
      onChunk(buffer, label);
    });

    unsubStatusRef.current = electron.onCaptureStatus(({ active }) => {
      console.log("[useAudioCapture] capture status:", active);
      setIsCapturing(active);
      onStatusChange?.(active);
    });

    unsubErrorRef.current = electron.onCaptureError(({ source, message }) => {
      console.error(`[useAudioCapture] capture error [${source}]:`, message);
      onError?.(source, message);
    });

    electron.getStatus().then(({ active }) => {
      console.log("[useAudioCapture] initial status:", active);
      setIsCapturing(active);
    });

    return () => {
      unsubChunkRef.current?.();
      unsubStatusRef.current?.();
      unsubErrorRef.current?.();
    };
  }, []);

  const start = useCallback(async (micDeviceId?: number) => {
    if (!window.electronAudio) return;
    await window.electronAudio.startCapture(
      micDeviceId !== undefined ? { micDeviceId } : undefined
    );
  }, []);

  const stop = useCallback(async () => {
    if (!window.electronAudio) return;
    await window.electronAudio.stopCapture();
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!window.electronAudio) return;
    const list = await window.electronAudio.listDevices();
    setDevices(list);
  }, []);

  return { isCapturing, start, stop, platform, isElectron, devices, refreshDevices };
}
