import type { MusicProvider, MusicTrack, SearchResult, PlayerData } from "../types";

export class SpotifyProvider implements MusicProvider {
  async search(): Promise<SearchResult> {
    throw new Error("Spotify provider not implemented yet");
  }

  async getTrack(): Promise<MusicTrack | null> {
    throw new Error("Spotify provider not implemented yet");
  }

  getPlayerData(providerId: string): PlayerData {
    return {
      type: "spotify",
      trackUri: `spotify:track:${providerId}`,
      providerId,
    };
  }

  async validate(): Promise<boolean> {
    throw new Error("Spotify provider not implemented yet");
  }
}
