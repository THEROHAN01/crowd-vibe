import { env } from "@crowd-vibe/env/server";
import type { MusicProvider, MusicTrack, SearchResult, PlayerData } from "../types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
  contentDetails: {
    duration: string; // ISO 8601 duration e.g. "PT4M30S"
  };
}

function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number.parseInt(match[1] || "0", 10);
  const minutes = Number.parseInt(match[2] || "0", 10);
  const seconds = Number.parseInt(match[3] || "0", 10);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

function getThumbnail(thumbnails: YouTubeVideoItem["snippet"]["thumbnails"]): string | null {
  return thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null;
}

export class YouTubeProvider implements MusicProvider {
  private apiKey = env.YOUTUBE_API_KEY;

  async search(query: string, limit = 10): Promise<SearchResult> {
    const url = new URL(`${YOUTUBE_API_BASE}/search`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("videoCategoryId", "10"); // Music category
    url.searchParams.set("maxResults", String(limit));
    url.searchParams.set("q", query);
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`YouTube API error: ${res.status} ${errorBody}`);
    }

    const data = await res.json();
    const items: YouTubeSearchItem[] = data.items ?? [];

    return {
      tracks: items.map((item) => ({
        providerId: item.id.videoId,
        provider: "youtube" as const,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnailUrl: getThumbnail(item.snippet.thumbnails),
        durationMs: null,
      })),
      nextPageToken: data.nextPageToken,
    };
  }

  async getTrack(providerId: string): Promise<MusicTrack | null> {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", providerId);
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    const item: YouTubeVideoItem | undefined = data.items?.[0];
    if (!item) return null;

    return {
      providerId: item.id,
      provider: "youtube",
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnailUrl: getThumbnail(item.snippet.thumbnails),
      durationMs: parseDuration(item.contentDetails.duration),
    };
  }

  getPlayerData(providerId: string): PlayerData {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${providerId}?autoplay=1&enablejsapi=1`,
      providerId,
    };
  }

  async validate(providerId: string): Promise<boolean> {
    const track = await this.getTrack(providerId);
    return track !== null;
  }
}
