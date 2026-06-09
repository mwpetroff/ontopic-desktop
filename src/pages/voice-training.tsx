import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import { useToast } from "@/hooks/use-toast";
import {
  UserCircle,
  Mic,
  Square,
  Plus,
  Trash2,
  CheckCircle,
  Shield,
  Volume2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import type { VoiceProfile } from "@shared/schema";

const TRAINING_PHRASES = [
  "The quick brown fox jumps over the lazy dog.",
  "I'm reviewing the cloud infrastructure deployment plan.",
  "Let's discuss the Kubernetes cluster configuration.",
  "We need to evaluate the security posture of the application.",
  "The CI/CD pipeline needs optimization for faster deployments.",
];

function profileReliability(sampleCount: number): {
  label: string;
  className: string;
  Icon: typeof ShieldQuestion;
  title: string;
} {
  if (sampleCount === 0) return { label: "Untrained", className: "text-muted-foreground", Icon: ShieldQuestion, title: "No samples recorded — voice matching is disabled for this profile." };
  if (sampleCount < 3) return { label: "Low", className: "text-red-500 dark:text-red-400", Icon: ShieldAlert, title: `${sampleCount} sample${sampleCount > 1 ? "s" : ""} — record at least 3 for reliable matching.` };
  if (sampleCount < 6) return { label: "Fair", className: "text-amber-500 dark:text-amber-400", Icon: ShieldAlert, title: `${sampleCount} samples — accuracy improves with more recordings.` };
  if (sampleCount < 10) return { label: "Good", className: "text-emerald-500 dark:text-emerald-400", Icon: ShieldCheck, title: `${sampleCount} samples — reasonably accurate.` };
  return { label: "Excellent", className: "text-emerald-600 dark:text-emerald-400", Icon: ShieldCheck, title: `${sampleCount} samples — high accuracy.` };
}

export default function VoiceTraining() {
  const [profileName, setProfileName] = useState("My Voice");
  const [profileTitle, setProfileTitle] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [samplesCollected, setSamplesCollected] = useState(0);
  const [frequencySnapshots, setFrequencySnapshots] = useState<number[][]>([]);
  const { toast } = useToast();

  const { data: profiles = [], isLoading } = useQuery<VoiceProfile[]>({
    queryKey: ["/api/voice-profiles"],
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: { name: string; title?: string; frequencyData: unknown; isActive: boolean }) => {
      const res = await apiRequest("POST", "/api/voice-profiles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      toast({ title: "Voice profile created", description: "Your voice profile has been saved." });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/voice-profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
    },
  });

  const activateProfileMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/voice-profiles/${id}`, { isActive: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
    },
  });

  const onFrequencyData = useCallback((data: Float32Array) => {
    const snapshot = Array.from(data.slice(0, 128));
    setFrequencySnapshots(prev => [...prev, snapshot]);
  }, []);

  const audioCapture = useAudioCapture({ onFrequencyData, intervalMs: 10000 });

  const handleStartRecording = async () => {
    try {
      setFrequencySnapshots([]);
      setSamplesCollected(0);
      setCurrentPhrase(0);
      await audioCapture.startCapture();
      setIsRecording(true);
    } catch {
      toast({
        title: "Microphone access required",
        description: "Please allow microphone access to train your voice profile.",
        variant: "destructive",
      });
    }
  };

  const handleNextPhrase = () => {
    setSamplesCollected(prev => prev + 1);
    if (currentPhrase < TRAINING_PHRASES.length - 1) {
      setCurrentPhrase(prev => prev + 1);
    } else {
      handleFinishTraining();
    }
  };

  const handleFinishTraining = () => {
    audioCapture.stopCapture();
    setIsRecording(false);

    const avgFrequency = frequencySnapshots.length > 0
      ? frequencySnapshots.reduce((acc, snap) => {
          snap.forEach((val, i) => {
            acc[i] = (acc[i] || 0) + val / frequencySnapshots.length;
          });
          return acc;
        }, new Array(128).fill(0))
      : [];

    createProfileMutation.mutate({
      name: profileName,
      title: profileTitle.trim() || undefined,
      isActive: true,
      frequencyData: {
        averageSpectrum: avgFrequency,
        sampleCount: samplesCollected + 1,
        timestamp: Date.now(),
      },
    });
  };

  const handleCancelRecording = () => {
    audioCapture.stopCapture();
    setIsRecording(false);
    setFrequencySnapshots([]);
    setSamplesCollected(0);
    setCurrentPhrase(0);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold" data-testid="text-page-title">Voice Training</h1>
          </div>
          <Badge variant="secondary">{profiles.length} profiles</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-2xl mx-auto space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold mb-1">Train Your Voice Profile</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Record your voice reading a few sample phrases. This helps the app learn your voice characteristics so it can focus on capturing terms from other speakers during meetings.
                </p>
              </div>
            </div>

            {!isRecording ? (
              <div className="space-y-3">
                <Input
                  placeholder="Your name..."
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  onFocus={() => { if (profileName === "My Voice") setProfileName(""); }}
                  onBlur={() => { if (!profileName.trim()) setProfileName("My Voice"); }}
                  data-testid="input-profile-name"
                />
                <Input
                  placeholder="Title / role (e.g. Solutions Architect)"
                  value={profileTitle}
                  onChange={(e) => setProfileTitle(e.target.value)}
                  data-testid="input-profile-title"
                />
                <Button
                  onClick={handleStartRecording}
                  className="w-full"
                  data-testid="button-start-training"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Start Voice Training
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center py-2">
                  <AudioVisualizer
                    level={audioCapture.audioLevel}
                    isActive={true}
                    size={100}
                  />
                </div>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    Read this phrase aloud ({currentPhrase + 1}/{TRAINING_PHRASES.length}):
                  </p>
                  <p className="text-sm font-medium text-foreground px-4 py-3 bg-muted/50 rounded-md" data-testid="text-training-phrase">
                    "{TRAINING_PHRASES[currentPhrase]}"
                  </p>
                </div>

                <div className="flex items-center gap-3 justify-between">
                  <div className="flex gap-1">
                    {TRAINING_PHRASES.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-6 rounded-full transition-colors ${
                          i <= currentPhrase ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {samplesCollected} samples
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleCancelRecording}
                    className="flex-1"
                    data-testid="button-cancel-training"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleNextPhrase}
                    className="flex-1"
                    data-testid="button-next-phrase"
                  >
                    {currentPhrase < TRAINING_PHRASES.length - 1 ? (
                      <>Next Phrase</>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        Finish
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <div>
            <h3 className="text-sm font-semibold mb-3">Saved Profiles</h3>
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))
              ) : profiles.length === 0 ? (
                <Card className="p-8 text-center">
                  <Volume2 className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No voice profiles yet. Train your voice to enable speaker filtering.
                  </p>
                </Card>
              ) : (
                profiles.map((profile) => (
                  <Card
                    key={profile.id}
                    className="p-4 flex items-center gap-3"
                    data-testid={`card-profile-${profile.id}`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted shrink-0">
                      <UserCircle className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{profile.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {profile.title && <span>{profile.title} · </span>}
                        {profile.sampleCount} sample{profile.sampleCount !== 1 ? "s" : ""}
                      </p>
                      {(() => {
                        const { label, className, Icon, title } = profileReliability(profile.sampleCount);
                        return (
                          <div className={`flex items-center gap-1 mt-0.5 text-[10px] font-medium ${className}`} title={title} data-testid={`profile-reliability-${profile.id}`}>
                            <Icon className="h-3 w-3" />
                            {label}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {profile.isActive ? (
                        <Badge className="text-xs">Active</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => activateProfileMutation.mutate(profile.id)}
                          data-testid={`button-activate-profile-${profile.id}`}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteProfileMutation.mutate(profile.id)}
                        data-testid={`button-delete-profile-${profile.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
