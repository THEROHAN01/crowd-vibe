"use client";

import { useQuery } from "@tanstack/react-query";
import { Music } from "lucide-react";
import { useMemo, useState } from "react";
import NowPlaying from "@/components/session/now-playing";
import SongQueue from "@/components/session/song-queue";
import SongSearch from "@/components/session/song-search";
import LiveBadge from "@/components/ui/live-badge";
import Logo from "@/components/ui/logo";
import { useSessionEvents } from "@/hooks/use-session-events";
import { trpc } from "@/utils/trpc";

export default function SessionView({ sessionId }: { sessionId: string }) {
	const [sessionEnded, setSessionEnded] = useState(false);

	const queue = useQuery(trpc.queue.list.queryOptions({ sessionId }));
	const nowPlaying = useQuery(
		trpc.queue.nowPlaying.queryOptions({ sessionId }),
	);
	const guestInfo = useQuery(trpc.guest.me.queryOptions());

	useSessionEvents(sessionId, {
		onVoteChanged: () => queue.refetch(),
		onSongAdded: () => queue.refetch(),
		onSongRemoved: () => queue.refetch(),
		onNowPlaying: () => {
			nowPlaying.refetch();
			queue.refetch();
		},
		onSessionEnded: () => setSessionEnded(true),
		onReconnect: () => {
			// Catch up on missed events after SSE reconnection
			queue.refetch();
			nowPlaying.refetch();
			guestInfo.refetch();
		},
	});

	if (sessionEnded) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
				<div className="text-center">
					<Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<h2 className="mb-2 font-heading font-semibold text-2xl">
						Session Ended
					</h2>
					<p className="text-muted-foreground text-sm">Thanks for vibing!</p>
				</div>
			</div>
		);
	}

	// Extract guest's votes for highlighting
	const myVotes = useMemo(() => {
		const map = new Map<string, number>();
		guestInfo.data?.votes?.forEach((v: { songId: string; value: number }) => {
			map.set(v.songId, v.value);
		});
		return map;
	}, [guestInfo.data?.votes]);

	return (
		<div className="mx-auto flex h-full max-w-lg flex-col">
			{/* Top Bar */}
			<div className="flex items-center justify-between border-border border-b px-4 py-3">
				<Logo size="sm" />
				<LiveBadge />
			</div>

			{/* Now Playing Hero */}
			<div aria-live="polite">
				<NowPlaying song={nowPlaying.data ?? null} />
			</div>

			{/* Queue */}
			<div className="flex-1 overflow-y-auto px-4 py-3">
				<h2 className="mb-2 font-semibold text-muted-foreground text-sm">
					UP NEXT
				</h2>
				<SongQueue songs={queue.data ?? []} myVotes={myVotes} />
			</div>

			{/* Search & Add */}
			<div className="border-t p-4">
				<SongSearch sessionId={sessionId} />
			</div>
		</div>
	);
}
