import { ListMusic } from "lucide-react";
import Image from "next/image";
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
			<div className="py-12 text-center">
				<ListMusic className="mx-auto mb-3 h-16 w-16 text-muted-foreground" />
				<p className="font-medium text-muted-foreground">No songs yet</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Be the first to add one!
				</p>
				<p className="mt-3 text-muted-foreground text-xs">
					Use the Search &amp; Add button below
				</p>
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
						className="flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
					>
						{song.thumbnailUrl && (
							<Image
								src={song.thumbnailUrl}
								alt=""
								width={48}
								height={48}
								className="h-12 w-12 shrink-0 rounded-md object-cover"
							/>
						)}
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium text-sm">{song.title}</p>
							{song.artist && (
								<p className="truncate text-muted-foreground text-sm">
									{song.artist}
								</p>
							)}
						</div>
						<div className="flex shrink-0 flex-col items-center">
							<VoteButton
								songId={song.id}
								direction="up"
								isActive={myVote === 1}
							/>
							<span className={`font-bold text-sm tabular-nums ${scoreClass}`}>
								{song.score}
							</span>
							<VoteButton
								songId={song.id}
								direction="down"
								isActive={myVote === -1}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
