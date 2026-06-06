"use client";

import { useQuery } from "@tanstack/react-query";
import { Music, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
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

	const { connected } = useSessionEvents(sessionId, {
		onVoteChanged: () => queue.refetch(),
		onSongAdded: () => queue.refetch(),
		onSongRemoved: () => queue.refetch(),
		onNowPlaying: () => {
			nowPlaying.refetch();
			queue.refetch();
		},
		onSessionEnded: () => setSessionEnded(true),
		onReconnect: () => {
			queue.refetch();
			nowPlaying.refetch();
			guestInfo.refetch();
		},
	});

	const myVotes = useMemo(() => {
		const map = new Map<string, number>();
		guestInfo.data?.votes?.forEach((v: { songId: string; value: number }) => {
			map.set(v.songId, v.value);
		});
		return map;
	}, [guestInfo.data?.votes]);

	return (
		<div className="relative mx-auto flex h-full w-full max-w-lg flex-col overflow-hidden">
			{/* Session Ended Overlay */}
			{sessionEnded && (
				<div
					role="dialog"
					aria-modal="true"
					aria-label="Session ended"
					className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur"
				>
					<div className="text-center">
						<Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
						<h2 className="mb-2 font-heading font-semibold text-2xl">
							Session Ended
						</h2>
						<p className="text-muted-foreground text-sm">Thanks for vibing!</p>
					</div>
				</div>
			)}

			{/* Connection Lost Banner */}
			{!connected && !sessionEnded && (
				<div
					role="status"
					aria-live="polite"
					className="flex items-center justify-center gap-2 bg-destructive/10 px-4 py-2 text-destructive text-sm"
				>
					<WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
					Connection lost — reconnecting…
				</div>
			)}

			{/* Content — inert when session ended to block keyboard/pointer interaction */}
			{/* biome-ignore lint: inert is valid HTML but React types lag */}
			<div
				className={`flex flex-1 flex-col ${sessionEnded ? "pointer-events-none" : ""}`}
				// @ts-expect-error — inert is a valid HTML attribute, React 19 types pending
				inert={sessionEnded ? "" : undefined}
			>
				{/* Top Bar */}
				<div className="flex items-center justify-between border-border border-b px-4 py-3">
					<Logo size="sm" />
					<LiveBadge />
				</div>

				{/* Now Playing Hero */}
				<ErrorBoundary>
					<div aria-live="polite">
						<NowPlaying song={nowPlaying.data ?? null} />
					</div>
				</ErrorBoundary>

				{/* Queue */}
				<ErrorBoundary>
					<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
						<h2 className="mb-2 font-semibold text-muted-foreground text-sm">
							UP NEXT
						</h2>
						<SongQueue
							songs={queue.data ?? []}
							myVotes={myVotes}
							sessionId={sessionId}
						/>
					</div>
				</ErrorBoundary>

				{/* Search & Add */}
				<div className="border-t p-4">
					<SongSearch sessionId={sessionId} />
				</div>
			</div>
		</div>
	);
}
