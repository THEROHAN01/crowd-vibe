import EqualizerBars from "@/components/ui/equalizer-bars";

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
      <div className="p-6 text-center">
        <p className="text-muted-foreground">No song playing — add one to get the vibe going!</p>
      </div>
    );
  }

  return (
    <div
      className="border border-primary/20 bg-card rounded-lg p-4 m-4"
      style={{ boxShadow: "0 0 20px color-mix(in oklch, var(--primary) 10%, transparent)" }}
    >
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Now Playing</p>
      <div className="flex items-center gap-4">
        {song.thumbnailUrl && (
          <img
            src={song.thumbnailUrl}
            alt={song.title}
            className="w-20 h-20 rounded-xl border-2 border-primary/30 object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-lg truncate">{song.title}</p>
          {song.artist && (
            <p className="text-muted-foreground truncate">{song.artist}</p>
          )}
          <EqualizerBars />
        </div>
      </div>
    </div>
  );
}
