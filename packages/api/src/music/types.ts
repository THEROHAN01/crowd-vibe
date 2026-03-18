export interface MusicTrack {
	providerId: string;
	provider: "youtube" | "spotify";
	title: string;
	artist: string | null;
	thumbnailUrl: string | null;
	durationMs: number | null;
}

export interface SearchResult {
	tracks: MusicTrack[];
	nextPageToken?: string;
}

export interface PlayerData {
	type: "youtube" | "spotify";
	embedUrl?: string;
	trackUri?: string;
	providerId: string;
}

export interface MusicProvider {
	search(query: string, limit?: number): Promise<SearchResult>;
	getTrack(providerId: string): Promise<MusicTrack | null>;
	getPlayerData(providerId: string): PlayerData;
	validate(providerId: string): Promise<boolean>;
}
