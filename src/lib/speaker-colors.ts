export const SPEAKER_COLORS = [
  { text: "text-blue-600 dark:text-blue-400", border: "border-blue-400/30 dark:border-blue-500/30" },
  { text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-400/30 dark:border-emerald-500/30" },
  { text: "text-violet-600 dark:text-violet-400", border: "border-violet-400/30 dark:border-violet-500/30" },
  { text: "text-rose-600 dark:text-rose-400", border: "border-rose-400/30 dark:border-rose-500/30" },
  { text: "text-amber-600 dark:text-amber-400", border: "border-amber-400/30 dark:border-amber-500/30" },
  { text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-400/30 dark:border-cyan-500/30" },
  { text: "text-pink-600 dark:text-pink-400", border: "border-pink-400/30 dark:border-pink-500/30" },
  { text: "text-teal-600 dark:text-teal-400", border: "border-teal-400/30 dark:border-teal-500/30" },
  { text: "text-orange-600 dark:text-orange-400", border: "border-orange-400/30 dark:border-orange-500/30" },
  { text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-400/30 dark:border-indigo-500/30" },
];

export function getSpeakerColor(speakerName: string, speakerMap: Map<string, number>): typeof SPEAKER_COLORS[0] {
  if (!speakerMap.has(speakerName)) {
    speakerMap.set(speakerName, speakerMap.size);
  }
  const index = speakerMap.get(speakerName)!;
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

export function getSpeakerColorByIndex(index: number): typeof SPEAKER_COLORS[0] {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}
