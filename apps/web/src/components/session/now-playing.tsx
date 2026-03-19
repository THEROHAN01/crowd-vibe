import Image from "next/image";
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
				<p className="text-muted-foreground">
					No song playing — add one to get the vibe going!
				</p>
			</div>
		);
	}

	return (
		<div
			className="m-4 rounded-lg border border-primary/20 bg-card p-4"
			style={{
				boxShadow:
					"0 0 20px color-mix(in oklch, var(--primary) 10%, transparent)",
			}}
		>
			<p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-widest">
				Now Playing
			</p>
			<div className="flex items-center gap-4 overflow-hidden">
				{song.thumbnailUrl && (
					<Image
						src={song.thumbnailUrl}
						alt={song.title}
						width={80}
						height={80}
						className="h-20 w-20 shrink-0 rounded-xl border-2 border-primary/30 object-cover"
					/>
				)}
				<div className="min-w-0 flex-1">
					<p className="truncate font-bold font-heading text-lg">
						{song.title}
					</p>
					{song.artist && (
						<p className="truncate text-muted-foreground">{song.artist}</p>
					)}
					<EqualizerBars />
				</div>
			</div>
		</div>
	);
}
