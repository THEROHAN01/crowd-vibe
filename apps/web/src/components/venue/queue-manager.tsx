"use client";

import { Button } from "@crowd-vibe/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import Image from "next/image";
import { queryClient, trpc } from "@/utils/trpc";

interface Song {
	id: string;
	title: string;
	artist: string | null;
	score: number;
	thumbnailUrl: string | null;
}

export default function QueueManager({
	songs,
	sessionId,
}: {
	songs: Song[];
	sessionId: string;
}) {
	const removeSong = useMutation(
		trpc.song.remove.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries(),
		}),
	);

	if (songs.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				No songs in queue yet. Add songs or share the QR code!
			</div>
		);
	}

	return (
		<div className="grid gap-2">
			{songs.map((song, i) => (
				<div
					key={song.id}
					className="flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card p-3"
				>
					<span className="w-6 text-muted-foreground text-sm">{i + 1}</span>
					{song.thumbnailUrl && (
						<Image
							src={song.thumbnailUrl}
							alt=""
							width={40}
							height={40}
							className="h-10 w-10 shrink-0 rounded object-cover"
						/>
					)}
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium">{song.title}</p>
						{song.artist && (
							<p className="truncate text-muted-foreground text-sm">
								{song.artist}
							</p>
						)}
					</div>
					<span className="font-bold text-sm">
						{song.score > 0 ? `+${song.score}` : song.score}
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => removeSong.mutate({ songId: song.id })}
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			))}
		</div>
	);
}
