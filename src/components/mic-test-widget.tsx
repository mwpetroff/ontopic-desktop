/**
 * MicTestWidget — Teams/Zoom-style microphone configuration and test panel.
 *
 * Uses the browser's getUserMedia + Web Audio AnalyserNode for real-time level
 * metering (works in both Electron renderer and plain browser). Device IDs from
 * the browser API match the physical hardware used by naudiodon in live sessions.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, MicOff, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

// ── Level meter ───────────────────────────────────────────────────────────────

const SEGMENTS = 24;
const YELLOW_AT = 16; // segments ≥ this index are yellow
const RED_AT    = 21; // segments ≥ this index are red

function LevelBar({ level }: { level: number }) {
  const lit = Math.round(level * SEGMENTS);
  return (
    <div className="flex items-end gap-0.5 h-6" role="meter" aria-valuenow={Math.round(level * 100)} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const isLit = i < lit;
        // Segments grow slightly taller toward the right (like a real VU meter)
        const heightPct = 40 + Math.floor((i / SEGMENTS) * 60);
        const color = isLit
          ? i >= RED_AT    ? "bg-destructive"
          : i >= YELLOW_AT ? "bg-yellow-500"
          :                  "bg-emerald-500"
          : "bg-muted";
        return (
          <div
            key={i}
            className={`flex-1 rounded-sm transition-colors duration-75 ${color}`}
            style={{ height: `${heightPct}%` }}
          />
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AudioInputDevice {
  deviceId: string;
  label: string;
}

const TEST_SECONDS = 10;

export function MicTestWidget() {
  const [devices, setDevices]           = useState<AudioInputDevice[]>([]);
  const [selectedId, setSelectedId]     = useState<string>("");
  const [isTesting, setIsTesting]       = useState(false);
  const [level, setLevel]               = useState(0);
  const [peakDetected, setPeakDetected] = useState(false);
  const [secondsLeft, setSecondsLeft]   = useState(0);
  const [error, setError]               = useState<string | null>(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);

  const streamRef   = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef     = useRef<number>(0);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Device enumeration ────────────────────────────────────────────────────

  const enumerateDevices = useCallback(async (requestPermission = false) => {
    try {
      let inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "audioinput"
      );

      const needsPermission = inputs.some((d) => !d.label);
      if (needsPermission && !requestPermission) {
        setPermissionNeeded(true);
        // Show unlabeled placeholders so the UI isn't empty
        setDevices(inputs.map((d, i) => ({ deviceId: d.deviceId, label: `Microphone ${i + 1}` })));
        return;
      }

      if (needsPermission) {
        // Momentarily open a stream to trigger the OS permission dialog
        const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
        tmp.getTracks().forEach((t) => t.stop());
        inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "audioinput"
        );
      }

      const mapped = inputs.map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${i + 1}`,
      }));
      setDevices(mapped);
      setPermissionNeeded(false);
      setError(null);

      setSelectedId((prev) => prev || mapped[0]?.deviceId || "");
    } catch {
      setError("Microphone access was denied. Grant permission to test your mic.");
      setPermissionNeeded(true);
    }
  }, []);

  useEffect(() => {
    enumerateDevices(false);
    const onChange = () => enumerateDevices(false);
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", onChange);
      stopTest();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Test controls ─────────────────────────────────────────────────────────

  const stopTest = useCallback(() => {
    if (animRef.current)  { cancelAnimationFrame(animRef.current); animRef.current = 0; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    setIsTesting(false);
    setLevel(0);
    setSecondsLeft(0);
  }, []);

  const startTest = useCallback(async () => {
    stopTest();
    setError(null);
    setPeakDetected(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedId ? { deviceId: { exact: selectedId } } : true,
      });
      streamRef.current = stream;

      // Re-enumerate to get proper labels after permission is granted
      if (permissionNeeded) enumerateDevices(false);

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.25;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsTesting(true);
      setSecondsLeft(TEST_SECONDS);

      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) { stopTest(); return 0; }
          return s - 1;
        });
      }, 1000);

      const tick = () => {
        const an = analyserRef.current;
        if (!an) return;
        const buf = new Float32Array(an.frequencyBinCount);
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.min(1, Math.sqrt(sum / buf.length) * 7);
        setLevel(rms);
        if (rms > 0.04) setPeakDetected(true);
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError("Could not open the selected microphone. Try a different device.");
    }
  }, [selectedId, stopTest, permissionNeeded, enumerateDevices]);

  // ── Derived UI state ──────────────────────────────────────────────────────

  const isSpeaking = level > 0.04;

  const statusText = isTesting
    ? isSpeaking ? "Hearing you" : "Speak now\u2026"
    : peakDetected ? "Microphone is working" : "Ready to test";

  const statusColor = isTesting
    ? isSpeaking ? "text-emerald-500" : "text-muted-foreground"
    : peakDetected ? "text-emerald-500" : "text-muted-foreground";

  const StatusIcon = peakDetected && !isTesting ? CheckCircle2 : Mic;

  return (
    <Card className="p-4 space-y-4">
      {/* ── Device selector ── */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium block">Microphone device</label>
        <div className="flex gap-2">
          <Select
            value={selectedId}
            onValueChange={setSelectedId}
            disabled={isTesting || devices.length === 0}
          >
            <SelectTrigger className="h-9 text-sm flex-1" data-testid="select-mic-device">
              <SelectValue placeholder={devices.length === 0 ? "No microphones found" : "Select microphone\u2026"} />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isTesting && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => enumerateDevices(true)}
              title="Refresh device list"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Level meter ── */}
      <div className="space-y-2">
        <LevelBar level={level} />
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${statusColor}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            <span>{statusText}</span>
          </div>
          {isTesting && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {secondsLeft}s
            </span>
          )}
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-destructive hover:text-destructive"
            onClick={() => enumerateDevices(true)}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* ── Action button ── */}
      <Button
        variant={isTesting ? "outline" : "default"}
        size="sm"
        className="h-9 w-full"
        onClick={isTesting ? stopTest : startTest}
        data-testid="button-mic-test"
      >
        {isTesting ? (
          <>
            <MicOff className="h-3.5 w-3.5 mr-1.5" />
            Stop test
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5 mr-1.5" />
            Test microphone
          </>
        )}
      </Button>

      {/* ── Instruction ── */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {isTesting
          ? `Speak normally into your microphone. The meter should move as you talk. Test stops automatically after ${TEST_SECONDS} seconds.`
          : "Select your microphone and click Test to verify it is picking up sound correctly before starting a session."}
      </p>
    </Card>
  );
}
