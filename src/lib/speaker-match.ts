import type { VoiceProfile } from "@shared/schema";

interface FrequencyProfile {
  averageSpectrum: number[];
  sampleCount: number;
}

export interface SpeakerMatch {
  profileId: number;
  profileName: string;
  profileTitle?: string;
  confidence: number;
}

const MATCH_THRESHOLD = 0.55;
const SPECTRUM_BINS = 128;
const MIN_SNAPSHOTS = 3;
const SILENCE_FLOOR = -90;

function sanitize(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(val, SILENCE_FLOOR);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length, SPECTRUM_BINS);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const valA = sanitize(a[i]) + 100;
    const valB = sanitize(b[i]) + 100;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0 || !Number.isFinite(denom)) return 0;
  const result = dotProduct / denom;
  return Number.isFinite(result) ? Math.max(0, Math.min(1, result)) : 0;
}

function averageSnapshots(snapshots: number[][]): number[] {
  if (snapshots.length === 0) return [];
  const len = Math.min(snapshots[0].length, SPECTRUM_BINS);
  const avg = new Array(len).fill(0);
  for (const snap of snapshots) {
    for (let i = 0; i < len; i++) {
      avg[i] += sanitize(snap[i] ?? 0) / snapshots.length;
    }
  }
  return avg;
}

export function matchSpeaker(
  chunkSnapshots: number[][],
  profiles: VoiceProfile[]
): SpeakerMatch | null {
  if (chunkSnapshots.length < MIN_SNAPSHOTS || profiles.length === 0) return null;

  const activeProfiles = profiles.filter(p => p.isActive);
  if (activeProfiles.length === 0) return null;

  const chunkAvg = averageSnapshots(chunkSnapshots);
  if (chunkAvg.length === 0) return null;

  let bestMatch: SpeakerMatch | null = null;
  let bestScore = 0;

  for (const profile of activeProfiles) {
    const freqData = profile.frequencyData as FrequencyProfile | null;
    if (!freqData?.averageSpectrum || freqData.averageSpectrum.length === 0) continue;

    const similarity = cosineSimilarity(chunkAvg, freqData.averageSpectrum);
    if (similarity > bestScore && similarity >= MATCH_THRESHOLD) {
      bestScore = similarity;
      bestMatch = {
        profileId: profile.id,
        profileName: profile.name,
        profileTitle: profile.title || undefined,
        confidence: similarity,
      };
    }
  }

  return bestMatch;
}
