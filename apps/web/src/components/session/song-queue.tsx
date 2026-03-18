import { ListMusic } from "lucide-react";
import VoteButton from "./vote-button";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  score: number;
  suggestedBy: { displayName: string | null } | null;
}

interface SongQueueProps {
  songs: Song[];
  myVotes: Map<string, number>;
}

export default function SongQueue({ songs, myVotes }: SongQueueProps) {
  if (songs.length === 0) {
    return (
      <div className="text-center py-12">
        <ListMusic className="w-16 h-16 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">No songs yet</p>
        <p className="text-sm text-muted-foreground mt-1">Be the first to add one!</p>
        <p className="text-xs text-muted-foreground mt-3">Use the Search &amp; Add button below</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2" aria-live="polite">
      {songs.map((song) => {
        const myVote = myVotes.get(song.id) ?? 0;
        const scoreClass =
          song.score > 0
            ? "text-score-positive"
            : song.score < 0
              ? "text-score-negative"
              : "text-score-neutral";
        return (
          <div
            key={song.id}
            className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
          >
            {song.thumbnailUrl && (
              <img src={song.thumbnailUrl} alt="" className="w-12 h-12 rounded-md object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{song.title}</p>
              {song.artist && (
                <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
              )}
            </div>
            <div className="flex flex-col items-center">
              <VoteButton songId={song.id} direction="up" isActive={myVote === 1} />
              <span className={`text-sm font-bold tabular-nums ${scoreClass}`}>{song.score}</span>
              <VoteButton songId={song.id} direction="down" isActive={myVote === -1} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
