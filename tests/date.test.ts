/**
 * date utility unit tests (src/lib/date.ts).
 *
 * All assertions use fixed local-time Date objects to avoid timezone ambiguity.
 */
import { describe, it, expect } from "vitest";
import { formatDate, formatDuration, formatDateForPdf, formatDurationForPdf } from "../src/lib/date";

// ── formatDate ────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("includes the abbreviated month name", () => {
    const d = new Date(2025, 0, 5, 15, 30); // Jan 5, 2025 3:30 PM local
    expect(formatDate(d)).toContain("Jan");
  });

  it("includes the day and year", () => {
    const d = new Date(2025, 0, 5, 15, 30);
    const result = formatDate(d);
    expect(result).toContain("5");
    expect(result).toContain("2025");
  });

  it("accepts a date string", () => {
    const result = formatDate(new Date(2025, 3, 20, 9, 0).toISOString());
    expect(result).toContain("2025");
  });
});

// ── formatDuration ────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("returns 'X minutes' when duration is less than 60 minutes", () => {
    const start = new Date(2025, 0, 1, 10, 0);
    const end   = new Date(2025, 0, 1, 10, 45);
    expect(formatDuration(start, end)).toBe("45 minutes");
  });

  it("returns '0 minutes' for a zero-length duration", () => {
    const t = new Date(2025, 0, 1, 10, 0);
    expect(formatDuration(t, t)).toBe("0 minutes");
  });

  it("returns 'Xh Ym' when duration is 60+ minutes", () => {
    const start = new Date(2025, 0, 1, 10, 0);
    const end   = new Date(2025, 0, 1, 11, 30);
    expect(formatDuration(start, end)).toBe("1h 30m");
  });

  it("returns 'Xh 0m' when duration is an exact number of hours", () => {
    const start = new Date(2025, 0, 1, 10, 0);
    const end   = new Date(2025, 0, 1, 12, 0);
    expect(formatDuration(start, end)).toBe("2h 0m");
  });

  it("accepts ISO date strings", () => {
    const start = new Date(2025, 0, 1, 10, 0);
    const end   = new Date(2025, 0, 1, 10, 45);
    expect(formatDuration(start.toISOString(), end.toISOString())).toBe("45 minutes");
  });

  it("uses current time when end is omitted", () => {
    const start = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    const result = formatDuration(start);
    // Should be ~30 minutes; allow ±1 due to execution time
    expect(result).toMatch(/^(29|30|31) minutes$/);
  });
});

// ── formatDateForPdf ──────────────────────────────────────────────────────────

describe("formatDateForPdf", () => {
  it("uses the long month name", () => {
    const d = new Date(2025, 0, 5, 15, 30); // January
    expect(formatDateForPdf(d)).toContain("January");
  });

  it("includes the day and year", () => {
    const d = new Date(2025, 5, 20, 14, 0); // June 20
    const result = formatDateForPdf(d);
    expect(result).toContain("20");
    expect(result).toContain("2025");
  });
});

// ── formatDurationForPdf ──────────────────────────────────────────────────────

describe("formatDurationForPdf", () => {
  it("returns 'X minutes' for sub-hour durations", () => {
    const start = new Date(2025, 0, 1, 8, 0);
    const end   = new Date(2025, 0, 1, 8, 20);
    expect(formatDurationForPdf(start, end)).toBe("20 minutes");
  });

  it("returns 'Xh Ym' for durations of 60+ minutes", () => {
    const start = new Date(2025, 0, 1, 8, 0);
    const end   = new Date(2025, 0, 1, 9, 45);
    expect(formatDurationForPdf(start, end)).toBe("1h 45m");
  });
});
