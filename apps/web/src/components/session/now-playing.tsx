interface NowPlayingProps {
  song: {
    title: string;
    artist: string | null;
    thumbnailUrl: string | null;
    score: number;
  } | null;
}

export default function NowPlaying({ song }: NowPlayingProps) {
  if (!song) {
    return (
      <div className="p-6 text-center border-b">
        <p className="text-muted-foreground">No song playing — add one to get the vibe going!</p>
      </div>
    );
  }

  return (
    <div className="p-4 border-b">
      <div className="flex items-center gap-4">
        {song.thumbnailUrl && (
          <img
            src={song.thumbnailUrl}
            alt={song.title}
            className="w-20 h-20 rounded-lg object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Now Playing</p>
          <p className="font-bold text-lg truncate">{song.title}</p>
          {song.artist && (
            <p className="text-muted-foreground truncate">{song.artist}</p>
          )}
        </div>
      </div>
    </div>
  );
}
