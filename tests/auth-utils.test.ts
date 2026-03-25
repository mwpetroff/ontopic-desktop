/**
 * auth-utils unit tests (src/lib/auth-utils.ts).
 */
import { describe, it, expect } from "vitest";
import { isUnauthorizedError } from "../src/lib/auth-utils";

describe("isUnauthorizedError", () => {
  it("returns true for a plain '401: Unauthorized' message", () => {
    expect(isUnauthorizedError(new Error("401: Unauthorized"))).toBe(true);
  });

  it("returns true when 'Unauthorized' appears after a description prefix", () => {
    expect(isUnauthorizedError(new Error("401: Session Unauthorized"))).toBe(true);
  });

  it("returns false for a 403 error", () => {
    expect(isUnauthorizedError(new Error("403: Forbidden"))).toBe(false);
  });

  it("returns false for a 500 error", () => {
    expect(isUnauthorizedError(new Error("500: Internal Server Error"))).toBe(false);
  });

  it("returns false when the message does not start with '401:'", () => {
    // Regex is anchored with ^ so mid-string matches don't count
    expect(isUnauthorizedError(new Error("Not a 401: Unauthorized error"))).toBe(false);
  });

  it("returns false for an empty message", () => {
    expect(isUnauthorizedError(new Error(""))).toBe(false);
  });
});
