import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter(3, 60_000);
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
  });

  it("allows requests up to max", () => {
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("blocks after max is reached", () => {
    limiter.check("a");
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("a").remaining).toBe(0);
  });

  it("tracks remaining count correctly", () => {
    expect(limiter.check("a").remaining).toBe(2);
    expect(limiter.check("a").remaining).toBe(1);
    expect(limiter.check("a").remaining).toBe(0);
  });

  it("resets after the time window expires", () => {
    limiter.check("a");
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("isolates keys from each other", () => {
    limiter.check("a");
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("sweep cleans expired entries", () => {
    limiter.check("a");
    vi.advanceTimersByTime(60_001);
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(limiter.check("a").remaining).toBe(2);
  });
});
