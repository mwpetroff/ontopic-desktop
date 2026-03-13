/**
   * useAudioCapture — Desktop version
   *
   * Replaces the browser's getUserMedia approach.
   *
   * In the Electron desktop app, audio capture happens in the main process.
   * This hook listens for audio chunks pushed via IPC from the main process
   * and feeds them into the existing transcription pipeline unchanged.
   *
   * The downstream transcription, analysis, BANT tracking, and all other
   * features receive the same data format as the web version.
   *
   * Speaker labels:
   *   - "mic"     → local user (the AE/consultant)
   *   - "speaker" → remote participants (the prospect/client)
   */

  import { useEffect, useRef, useState } from "react";

  declare global {
    interface Window {
      electronAudio?: {
        startCapture: () => Promise<{ ok: boolean }>;
        stopCapture:  () => Promise<{ ok: boolean }>;
        getStatus:    () => Promise<{ active: boolean }>;
        getPlatform:  () => Promise<string>;
        onAudioChunk: (cb: (data: { buffer: ArrayBuffer; label: "mic" | "speaker" }) => void) => () => void;
        onCaptureStatus: (cb: (data: { active: boolean }) => void) => () => void;
      };
    }
  }

  interface UseAudioCaptureOptions {
    onChunk: (buffer: ArrayBuffer, label: "mic" | "speaker") => void;
    onStatusChange?: (active: boolean) => void;
  }

  export function useAudioCapture({ onChunk, onStatusChange }: UseAudioCaptureOptions) {
    const [isCapturing, setIsCapturing] = useState(false);
    const [platform, setPlatform]       = useState<string | null>(null);
    const [isElectron, setIsElectron]   = useState(false);
    const unsubChunkRef  = useRef<(() => void) | null>(null);
    const unsubStatusRef = useRef<(() => void) | null>(null);

    useEffect(() => {
      const electron = window.electronAudio;
      if (!electron) return; // Running in browser — use legacy getUserMedia hook instead

      setIsElectron(true);
      electron.getPlatform().then(setPlatform);

      // Subscribe to audio chunks from main process
      unsubChunkRef.current = electron.onAudioChunk(({ buffer, label }) => {
        onChunk(buffer, label);
      });

      // Subscribe to capture status changes
      unsubStatusRef.current = electron.onCaptureStatus(({ active }) => {
        setIsCapturing(active);
        onStatusChange?.(active);
      });

      // Check initial status
      electron.getStatus().then(({ active }) => setIsCapturing(active));

      return () => {
        unsubChunkRef.current?.();
        unsubStatusRef.current?.();
      };
    }, []);

    const start = async () => {
      if (!window.electronAudio) return;
      await window.electronAudio.startCapture();
    };

    const stop = async () => {
      if (!window.electronAudio) return;
      await window.electronAudio.stopCapture();
    };

    return { isCapturing, start, stop, platform, isElectron };
  }
  