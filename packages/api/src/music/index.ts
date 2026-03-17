import type { MusicProvider } from "./types";
import { YouTubeProvider } from "./providers/youtube";
import { SpotifyProvider } from "./providers/spotify";

const providers = new Map<string, MusicProvider>();

export function getMusicProvider(type: string): MusicProvider {
  if (!providers.has(type)) {
    switch (type) {
      case "youtube":
        providers.set(type, new YouTubeProvider());
        break;
      case "spotify":
        providers.set(type, new SpotifyProvider());
        break;
      default:
        throw new Error(`Unknown music provider: ${type}`);
    }
  }
  return providers.get(type)!;
}

export type { MusicTrack, SearchResult, PlayerData, MusicProvider } from "./types";
