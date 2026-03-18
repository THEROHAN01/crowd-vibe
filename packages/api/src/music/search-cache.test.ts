import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SearchCache } from "./search-cache";

describe("SearchCache", () => {
  let cache: SearchCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new SearchCache(15);
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  it("returns null for missing key", () => {
    expect(cache.get("missing")).toBeNull();
  });

  it("round-trips set/get", () => {
    cache.set("key", { tracks: [] });
    expect(cache.get("key")).toEqual({ tracks: [] });
  });

  it("returns null after TTL expires", () => {
    cache.set("key", { data: 1 });
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(cache.get("key")).toBeNull();
  });

  it("returns data before TTL expires", () => {
    cache.set("key", { data: 1 });
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(cache.get("key")).toEqual({ data: 1 });
  });

  it("makeKey normalizes case and whitespace", () => {
    expect(cache.makeKey("youtube", "  Hello World  ")).toBe("youtube:hello world");
  });

  it("makeKey treats different providers as different keys", () => {
    const a = cache.makeKey("youtube", "test");
    const b = cache.makeKey("spotify", "test");
    expect(a).not.toBe(b);
  });
});
