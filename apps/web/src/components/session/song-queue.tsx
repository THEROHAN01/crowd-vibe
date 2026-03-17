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
      <p className="text-center text-muted-foreground py-8">
        No songs yet — be the first to add one!
      </p>
    );
  }

  return (
    <div className="grid gap-1">
      {songs.map((song) => {
        const myVote = myVotes.get(song.id) ?? 0;
        return (
          <div key={song.id} className="flex items-center gap-3 p-3 rounded-lg border">
            {song.thumbnailUrl && (
              <img src={song.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{song.title}</p>
              {song.artist && (
                <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
              )}
            </div>
            <div className="flex flex-col items-center">
              <VoteButton songId={song.id} direction="up" isActive={myVote === 1} />
              <span className="text-sm font-bold">{song.score}</span>
              <VoteButton songId={song.id} direction="down" isActive={myVote === -1} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
