import { useState, useEffect, useCallback, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Volume2, AlertCircle, RefreshCw } from "lucide-react";

interface AudioInputDevice {
  deviceId: string;
  label: string;
}

interface MicrophoneSelectorProps {
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
}

export function MicrophoneSelector({ selectedDeviceId, onDeviceChange }: MicrophoneSelectorProps) {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testLevel, setTestLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const testTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enumerateDevices = useCallback(async (requestPermission = false) => {
    try {
      let allDevices = await navigator.mediaDevices.enumerateDevices();
      let audioInputs = allDevices.filter(d => d.kind === "audioinput");

      const hasLabels = audioInputs.some(d => d.label);
      if (!hasLabels && audioInputs.length > 0) {
        if (!requestPermission) {
          setNeedsPermission(true);
          const unlabeledDevices = audioInputs.map((d, i) => ({
            deviceId: d.deviceId,
            label: `Microphone ${i + 1}`,
          }));
          setDevices(unlabeledDevices);
          setError(null);
          if (unlabeledDevices.length > 0 && !selectedDeviceId) {
            onDeviceChange(unlabeledDevices[0].deviceId);
          }
          return;
        }

        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(t => t.stop());

        allDevices = await navigator.mediaDevices.enumerateDevices();
        audioInputs = allDevices.filter(d => d.kind === "audioinput");
      }

      const mapped = audioInputs.map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${i + 1}`,
      }));

      setDevices(mapped);
      setError(null);
      setNeedsPermission(false);

      if (mapped.length > 0 && !selectedDeviceId) {
        onDeviceChange(mapped[0].deviceId);
      }
    } catch (err) {
      setError("Microphone access denied. Please allow microphone permissions in your browser.");
      setDevices([]);
      setNeedsPermission(true);
    }
  }, [selectedDeviceId, onDeviceChange]);

  useEffect(() => {
    enumerateDevices(false);

    const handler = () => enumerateDevices(false);
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handler);
    };
  }, [enumerateDevices]);

  const stopTest = useCallback(() => {
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setTestLevel(0);
    setIsTesting(false);
  }, []);

  const startTest = useCallback(async () => {
    stopTest();

    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (needsPermission) {
        enumerateDevices(false);
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsTesting(true);
      setError(null);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const data = new Float32Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);
        setTestLevel(Math.min(1, rms * 5));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      testTimeoutRef.current = setTimeout(() => {
        stopTest();
      }, 5000);
    } catch (err) {
      setError("Could not access the selected microphone.");
      setIsTesting(false);
    }
  }, [selectedDeviceId, stopTest, needsPermission, enumerateDevices]);

  useEffect(() => {
    return () => stopTest();
  }, [stopTest]);

  const handleRetryPermission = useCallback(() => {
    setError(null);
    enumerateDevices(true);
  }, [enumerateDevices]);

  if (devices.length <= 1 && !error) {
    return null;
  }

  const levelPercent = Math.round(testLevel * 100);
  const levelColor =
    levelPercent > 60 ? "bg-destructive" :
    levelPercent > 30 ? "bg-primary" :
    levelPercent > 5 ? "bg-primary/70" :
    "bg-muted";

  return (
    <div className="space-y-2" data-testid="microphone-selector">
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRetryPermission}
            className="h-6 px-2 ml-auto"
            data-testid="button-retry-mic-permission"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {devices.length > 1 && (
        <div className="flex items-center gap-2">
          <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={selectedDeviceId} onValueChange={onDeviceChange}>
            <SelectTrigger className="h-9 text-sm flex-1" data-testid="select-microphone">
              <SelectValue placeholder="Select microphone..." />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId} data-testid={`mic-option-${device.deviceId}`}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={isTesting ? stopTest : startTest}
            className="shrink-0"
            data-testid="button-test-microphone"
          >
            {isTesting ? (
              <>
                <Volume2 className="h-3.5 w-3.5 mr-1.5" />
                Stop
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5 mr-1.5" />
                Test
              </>
            )}
          </Button>
        </div>
      )}

      {isTesting && (
        <div className="space-y-1" data-testid="mic-test-meter">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-75 ${levelColor}`}
                style={{ width: `${Math.max(2, levelPercent)}%` }}
              />
            </div>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 tabular-nums min-w-[3rem] justify-center">
              {levelPercent > 5 ? "Receiving" : "Silent"}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Speak into your microphone — you should see the meter respond. Test runs for 5 seconds.
          </p>
        </div>
      )}
    </div>
  );
}
