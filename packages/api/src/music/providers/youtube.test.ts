import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@crowd-vibe/env/server", () => ({
  env: { YOUTUBE_API_KEY: "fake-api-key" },
}));

import { parseDuration, getThumbnail } from "./youtube";
import { YouTubeProvider } from "./youtube";

describe("parseDuration", () => {
  it("parses hours, minutes, seconds", () => {
    expect(parseDuration("PT1H2M30S")).toBe(3_750_000);
  });

  it("parses minutes and seconds only", () => {
    expect(parseDuration("PT4M30S")).toBe(270_000);
  });

  it("parses seconds only", () => {
    expect(parseDuration("PT45S")).toBe(45_000);
  });

  it("returns 0 for invalid format", () => {
    expect(parseDuration("invalid")).toBe(0);
  });

  it("parses hours only", () => {
    expect(parseDuration("PT2H")).toBe(7_200_000);
  });
});

describe("getThumbnail", () => {
  it("prefers high quality", () => {
    expect(
      getThumbnail({
        high: { url: "high.jpg" },
        medium: { url: "med.jpg" },
        default: { url: "def.jpg" },
      }),
    ).toBe("high.jpg");
  });

  it("falls back to medium", () => {
    expect(
      getThumbnail({
        medium: { url: "med.jpg" },
        default: { url: "def.jpg" },
      }),
    ).toBe("med.jpg");
  });

  it("falls back to default", () => {
    expect(getThumbnail({ default: { url: "def.jpg" } })).toBe("def.jpg");
  });

  it("returns null when no thumbnails", () => {
    expect(getThumbnail({})).toBeNull();
  });
});

describe("YouTubeProvider", () => {
  let provider: YouTubeProvider;

  beforeEach(() => {
    provider = new YouTubeProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("search returns parsed tracks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: { videoId: "abc123" },
              snippet: {
                title: "Test Song",
                channelTitle: "Test Artist",
                thumbnails: { high: { url: "thumb.jpg" } },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await provider.search("test query");
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      providerId: "abc123",
      provider: "youtube",
      title: "Test Song",
      artist: "Test Artist",
      thumbnailUrl: "thumb.jpg",
    });
  });

  it("search throws on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Quota exceeded", { status: 403 }),
    );

    await expect(provider.search("test")).rejects.toThrow("YouTube API error: 403");
  });

  it("getTrack returns track with duration", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "abc123",
              snippet: {
                title: "Test Song",
                channelTitle: "Test Artist",
                thumbnails: { high: { url: "thumb.jpg" } },
              },
              contentDetails: { duration: "PT3M45S" },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const track = await provider.getTrack("abc123");
    expect(track).toMatchObject({
      providerId: "abc123",
      title: "Test Song",
      durationMs: 225_000,
    });
  });

  it("getTrack returns null on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Not Found", { status: 404 }),
    );

    expect(await provider.getTrack("nonexistent")).toBeNull();
  });

  it("getPlayerData returns embed URL", () => {
    const data = provider.getPlayerData("abc123");
    expect(data).toEqual({
      type: "youtube",
      embedUrl: "https://www.youtube.com/embed/abc123?autoplay=1&enablejsapi=1",
      providerId: "abc123",
    });
  });
});
