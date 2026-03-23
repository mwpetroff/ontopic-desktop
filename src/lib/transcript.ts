export interface TranscriptBlock {
  speaker: string | null;
  content: string;
  rawBlockIndex: number;
  rawBlockCount: number;
}

export function parseAndMergeBlocks(text: string): TranscriptBlock[] {
  const lines = text.split("\n");
  const rawBlocks: Array<{ speaker: string | null; content: string }> = [];
  let currentSpeaker: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const speakerMatch = trimmed.match(/^\[([^\]]+)\]\s*/);
    if (speakerMatch) {
      if (currentContent.length > 0) {
        rawBlocks.push({ speaker: currentSpeaker, content: currentContent.join(" ") });
      }
      currentSpeaker = speakerMatch[1];
      const rest = trimmed.slice(speakerMatch[0].length).trim();
      currentContent = rest ? [rest] : [];
    } else {
      currentContent.push(trimmed);
    }
  }

  if (currentContent.length > 0) {
    rawBlocks.push({ speaker: currentSpeaker, content: currentContent.join(" ") });
  }

  const totalRawBlocks = rawBlocks.length;
  const merged: TranscriptBlock[] = [];
  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const last = merged[merged.length - 1];
    if (last && last.speaker === block.speaker) {
      last.content += " " + block.content;
    } else {
      merged.push({
        speaker: block.speaker,
        content: block.content,
        rawBlockIndex: i,
        rawBlockCount: totalRawBlocks,
      });
    }
  }

  return merged;
}

export function formatElapsedTimestamp(blockIndex: number, totalBlocks: number, startMs: number, durationMs: number): string {
  const elapsedMs = (blockIndex / Math.max(totalBlocks, 1)) * durationMs;
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
