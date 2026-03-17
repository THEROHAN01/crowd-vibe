export interface QueuedSong {
  id: string;
  providerId: string;
  provider: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  status: string;
  score: number;
  addedAt: string;
  suggestedBy: { displayName: string | null } | null;
}

export type SSEEvent =
  | { type: "queue_updated"; data: { songs: QueuedSong[] } }
  | { type: "now_playing"; data: { song: QueuedSong | null } }
  | { type: "vote_changed"; data: { songId: string; score: number } }
  | { type: "song_added"; data: { song: QueuedSong } }
  | { type: "song_removed"; data: { songId: string } }
  | { type: "session_ended"; data: Record<string, never> };
