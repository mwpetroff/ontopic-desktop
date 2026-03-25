/**
 * queryClient retry / retryDelay logic tests (src/lib/queryClient.ts).
 *
 * Extracts the retry and retryDelay functions from the QueryClient's defaultOptions
 * and tests them directly without making any network requests.
 */
import { describe, it, expect } from "vitest";
import { queryClient } from "../src/lib/queryClient";

type RetryFn      = (failureCount: number, error: unknown) => boolean;
type RetryDelayFn = (attempt: number, error: unknown) => number;

const { retry, retryDelay } = queryClient.getDefaultOptions().queries as {
  retry:      RetryFn;
  retryDelay: RetryDelayFn;
};

// ── retry ─────────────────────────────────────────────────────────────────────

describe("queryClient retry function", () => {
  it("retries on a 502 Bad Gateway error (failureCount < 3)", () => {
    expect(retry(0, new Error("502: Bad Gateway"))).toBe(true);
    expect(retry(2, new Error("502: Bad Gateway"))).toBe(true);
  });

  it("retries on a 503 Service Unavailable error", () => {
    expect(retry(0, new Error("503: Service Unavailable"))).toBe(true);
  });

  it("retries on a 504 Gateway Timeout error", () => {
    expect(retry(0, new Error("504: Gateway Timeout"))).toBe(true);
  });

  it("stops retrying when failureCount reaches 3", () => {
    expect(retry(3, new Error("502: Bad Gateway"))).toBe(false);
    expect(retry(4, new Error("502: Bad Gateway"))).toBe(false);
  });

  it("does not retry on 400 Bad Request", () => {
    expect(retry(0, new Error("400: Bad Request"))).toBe(false);
  });

  it("does not retry on 404 Not Found", () => {
    expect(retry(0, new Error("404: Not Found"))).toBe(false);
  });

  it("does not retry on 500 Internal Server Error (not in 50[234])", () => {
    expect(retry(0, new Error("500: Internal Server Error"))).toBe(false);
  });

  it("does not retry when the thrown value is not an Error", () => {
    expect(retry(0, "something went wrong")).toBe(false);
    expect(retry(0, null)).toBe(false);
  });
});

// ── retryDelay ────────────────────────────────────────────────────────────────

describe("queryClient retryDelay function", () => {
  it("returns 500ms for attempt 0", () => {
    expect(retryDelay(0, null)).toBe(500);
  });

  it("returns 1000ms for attempt 1 (exponential ×2)", () => {
    expect(retryDelay(1, null)).toBe(1000);
  });

  it("returns 2000ms for attempt 2", () => {
    expect(retryDelay(2, null)).toBe(2000);
  });

  it("returns 4000ms for attempt 3", () => {
    expect(retryDelay(3, null)).toBe(4000);
  });

  it("caps at 5000ms for attempt 4 and beyond", () => {
    expect(retryDelay(4, null)).toBe(5000);
    expect(retryDelay(10, null)).toBe(5000);
  });
});
