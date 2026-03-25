/**
 * matchSpeaker unit tests.
 *
 * Tests the pure speaker-identification logic in src/lib/speaker-match.ts without
 * any audio hardware or DB. VoiceProfile objects are constructed inline.
 */
import { describe, it, expect } from "vitest";
import { matchSpeaker } from "../src/lib/speaker-match";
import type { VoiceProfile } from "../shared/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<VoiceProfile> & { id: number; name: string }): VoiceProfile {
  return {
    title: null,
    isActive: true,
    sampleCount: 10,
    frequencyData: null,
    createdAt: new Date(),
    ...overrides,
  };
}

/** Builds a 128-bin spectrum by cycling through the given values. */
function makeSpectrum(values: number[]): number[] {
  return Array.from({ length: 128 }, (_, i) => values[i % values.length]);
}

// Three identical snapshots of a flat 0 dB spectrum — reliably above threshold.
const flatSnapshots = Array.from({ length: 3 }, () => makeSpectrum([0]));
const flatSpectrum  = makeSpectrum([0]);

/**
 * Single-bin spike spectrum: 100 dB at one bin, silence everywhere else.
 * Two spikes at *different* bins produce cosine similarity ~0.31 (well below 0.55)
 * because the +100 dB floor shift used in cosineSimilarity scales the off-bins
 * to 10 while the spike bin hits 200, making the vectors nearly orthogonal.
 */
function makeSpikeSpectrum(spikeBin: number, bins = 128): number[] {
  return Array.from({ length: bins }, (_, i) => (i === spikeBin ? 100 : -90));
}

// Snapshots with spike at bin 0; profile spectrum with spike at bin 1.
// cos([200,10,10,...], [10,200,10,...]) ≈ 0.31 < 0.55 → no match expected.
const spikeAt0Snapshots = Array.from({ length: 3 }, () => makeSpikeSpectrum(0));
const spikeAt1Spectrum  = makeSpikeSpectrum(1);

// ── matchSpeaker ──────────────────────────────────────────────────────────────

describe("matchSpeaker", () => {
  it("returns null when chunkSnapshots has fewer than 3 entries", () => {
    const profile = makeProfile({ id: 1, name: "Alice", frequencyData: { averageSpectrum: flatSpectrum, sampleCount: 5 } });
    expect(matchSpeaker([], [profile])).toBeNull();
    expect(matchSpeaker([flatSpectrum], [profile])).toBeNull();
    expect(matchSpeaker([flatSpectrum, flatSpectrum], [profile])).toBeNull();
  });

  it("returns null when profiles array is empty", () => {
    expect(matchSpeaker(flatSnapshots, [])).toBeNull();
  });

  it("returns null when all profiles are inactive", () => {
    const profile = makeProfile({
      id: 1, name: "Alice", isActive: false,
      frequencyData: { averageSpectrum: flatSpectrum, sampleCount: 5 },
    });
    expect(matchSpeaker(flatSnapshots, [profile])).toBeNull();
  });

  it("returns null when no active profile has frequencyData", () => {
    const profile = makeProfile({ id: 1, name: "Alice", frequencyData: null });
    expect(matchSpeaker(flatSnapshots, [profile])).toBeNull();
  });

  it("returns null when active profile has an empty averageSpectrum", () => {
    const profile = makeProfile({
      id: 1, name: "Alice",
      frequencyData: { averageSpectrum: [], sampleCount: 0 },
    });
    expect(matchSpeaker(flatSnapshots, [profile])).toBeNull();
  });

  it("returns null when cosine similarity is below the 0.55 threshold", () => {
    // Spike at bin 1 in the profile vs spike at bin 0 in the chunk snapshots:
    // cosine ≈ 0.31 — both below the MATCH_THRESHOLD of 0.55.
    const profile = makeProfile({
      id: 1, name: "Alice",
      frequencyData: { averageSpectrum: spikeAt1Spectrum, sampleCount: 5 },
    });
    expect(matchSpeaker(spikeAt0Snapshots, [profile])).toBeNull();
  });

  it("returns a SpeakerMatch when similarity is at or above threshold", () => {
    const profile = makeProfile({
      id: 7, name: "Bob",
      frequencyData: { averageSpectrum: flatSpectrum, sampleCount: 5 },
    });
    const result = matchSpeaker(flatSnapshots, [profile]);
    expect(result).not.toBeNull();
    expect(result?.profileId).toBe(7);
    expect(result?.profileName).toBe("Bob");
    expect(result?.confidence).toBeGreaterThanOrEqual(0.55);
    expect(result?.confidence).toBeLessThanOrEqual(1);
  });

  it("returns profileTitle when the matched profile has a title", () => {
    const profile = makeProfile({
      id: 1, name: "Alice", title: "Account Executive",
      frequencyData: { averageSpectrum: flatSpectrum, sampleCount: 5 },
    });
    expect(matchSpeaker(flatSnapshots, [profile])?.profileTitle).toBe("Account Executive");
  });

  it("returns profileTitle as undefined when profile.title is null", () => {
    const profile = makeProfile({
      id: 1, name: "Alice", title: null,
      frequencyData: { averageSpectrum: flatSpectrum, sampleCount: 5 },
    });
    expect(matchSpeaker(flatSnapshots, [profile])?.profileTitle).toBeUndefined();
  });

  it("picks the best-matching profile among multiple active ones", () => {
    const goodProfile = makeProfile({
      id: 2, name: "Bob",
      frequencyData: { averageSpectrum: flatSpectrum, sampleCount: 5 },
    });
    // Spike at a different bin → low cosine similarity vs flatSnapshots
    const weakProfile = makeProfile({
      id: 3, name: "Charlie",
      frequencyData: { averageSpectrum: spikeAt1Spectrum, sampleCount: 5 },
    });
    const result = matchSpeaker(flatSnapshots, [weakProfile, goodProfile]);
    expect(result?.profileId).toBe(2);
  });

  it("skips inactive profiles when an active profile is also present", () => {
    const inactive = makeProfile({
      id: 10, name: "Inactive", isActive: false,
      frequencyData: { averageSpectrum: flatSpectrum, sampleCount: 5 },
    });
    const active = makeProfile({
      id: 11, name: "Active",
      frequencyData: { averageSpectrum: flatSpectrum, sampleCount: 5 },
    });
    expect(matchSpeaker(flatSnapshots, [inactive, active])?.profileId).toBe(11);
  });

  it("handles snapshots containing Infinity / NaN (sanitized to silence floor)", () => {
    const nanSnapshots = Array.from({ length: 3 }, () => Array(128).fill(NaN));
    const profile = makeProfile({
      id: 1, name: "Alice",
      frequencyData: { averageSpectrum: flatSpectrum, sampleCount: 5 },
    });
    // NaN snapshots produce an all-zero average which may or may not match;
    // the key assertion is that no exception is thrown.
    expect(() => matchSpeaker(nanSnapshots, [profile])).not.toThrow();
  });
});
