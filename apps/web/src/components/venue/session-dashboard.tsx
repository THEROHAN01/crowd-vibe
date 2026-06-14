"use client";

import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { Skeleton } from "@crowd-vibe/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Music, Users } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import YouTubePlayer from "@/components/player/youtube-player";
import LiveBadge from "@/components/ui/live-badge";
import StatCard from "@/components/ui/stat-card";
import QRDisplay from "@/components/venue/qr-display";
import QueueManager from "@/components/venue/queue-manager";
import { useSessionEvents } from "@/hooks/use-session-events";
import { queryClient, trpc } from "@/utils/trpc";

interface SessionDashboardProps {
	venueId: string;
	venueName: string;
	sessionId: string;
	joinCode: string;
	sessionName: string | null;
	onSessionEnded: () => void;
}

export default function SessionDashboard({
	venueId,
	venueName,
	sessionId,
	joinCode,
	sessionName,
	onSessionEnded,
}: SessionDashboardProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	const queue = useQuery(trpc.queue.list.queryOptions({ sessionId }));
	const nowPlaying = useQuery(
		trpc.queue.nowPlaying.queryOptions({ sessionId }),
	);
	const stats = useQuery(trpc.session.stats.queryOptions({ sessionId }));
	const searchResults = useQuery({
		...trpc.song.search.queryOptions({ sessionId, query: debouncedSearch }),
		enabled: debouncedSearch.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	const nextSong = useMutation(
		trpc.queue.next.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries();
			},
			onError: (err) => {
				toast.error(err.message);
			},
		}),
	);
	const skipSong = useMutation(
		trpc.queue.skip.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries();
			},
			onError: (err) => {
				toast.error(err.message);
			},
		}),
	);
	const endSession = useMutation(
		trpc.session.end.mutationOptions({
			onSuccess: onSessionEnded,
			onError: (err) => {
				toast.error(err.message);
			},
		}),
	);
	const addSong = useMutation(
		trpc.song.add.mutationOptions({
			onSuccess: () => {
				toast.success("Song added to queue!");
				queryClient.invalidateQueries();
			},
			onError: (err) => {
				toast.error(err.message);
			},
		}),
	);

	useSessionEvents(sessionId, {
		onVoteChanged: () => queue.refetch(),
		onSongAdded: () => queue.refetch(),
		onSongRemoved: () => queue.refetch(),
		onNowPlaying: () => {
			nowPlaying.refetch();
			queue.refetch();
		},
		onListenerChanged: (count) => {
			queryClient.setQueryData(
				trpc.session.stats.queryOptions({ sessionId }).queryKey,
				(old: typeof stats.data) =>
					old ? { ...old, listenerCount: count } : old,
			);
		},
	});

	const handleSongEnded = useCallback(() => {
		nextSong.mutate({ sessionId });
	}, [sessionId, nextSong]);

	return (
		<div className="container mx-auto grid max-w-4xl gap-6 px-4 py-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2">
						<h1 className="font-bold font-heading text-xl">{venueName}</h1>
						<LiveBadge />
					</div>
					{sessionName && (
						<p className="text-muted-foreground">{sessionName}</p>
					)}
				</div>
				<Button
					variant="destructive"
					size="sm"
					onClick={() => endSession.mutate({ sessionId })}
					disabled={endSession.isPending}
				>
					{endSession.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						"End Session"
					)}
				</Button>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 gap-4">
				<StatCard
					icon={Users}
					value={stats.data?.listenerCount ?? 0}
					label="Listeners"
					live
				/>
				<StatCard
					icon={Music}
					value={stats.data?.songsPlayed ?? 0}
					label="Played"
				/>
			</div>

			{/* Now Playing + QR */}
			<div className="grid gap-6 lg:grid-cols-[1fr_auto]">
				<div className="rounded-lg border border-border bg-card p-4">
					<h2 className="mb-3 font-heading font-semibold">Now Playing</h2>
					{nowPlaying.isError ? (
						<p className="py-4 text-center text-destructive text-sm">
							Failed to load current song.
						</p>
					) : nowPlaying.isLoading ? (
						<Skeleton className="h-40 w-full rounded-lg" />
					) : nowPlaying.data ? (
						<div className="grid gap-3">
							<div className="overflow-hidden rounded-lg border border-border bg-card">
								<YouTubePlayer
									videoId={nowPlaying.data.providerId}
									onEnded={handleSongEnded}
								/>
							</div>
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate font-medium">
										{nowPlaying.data.title}
									</p>
									{nowPlaying.data.artist && (
										<p className="truncate text-muted-foreground text-sm">
											{nowPlaying.data.artist}
										</p>
									)}
								</div>
								<div className="flex items-center gap-2">
									<span className="font-bold text-sm">
										Score: {nowPlaying.data.score}
									</span>
									<Button
										variant="outline"
										size="sm"
										onClick={() => skipSong.mutate({ sessionId })}
										disabled={skipSong.isPending}
									>
										{skipSong.isPending ? (
											<Loader2 className="h-3 w-3 animate-spin" />
										) : (
											"Skip"
										)}
									</Button>
								</div>
							</div>
						</div>
					) : (
						<div className="py-8 text-center">
							<p className="mb-2 text-muted-foreground">No song playing</p>
							{(queue.data?.length ?? 0) > 0 && (
								<Button
									onClick={() => nextSong.mutate({ sessionId })}
									disabled={nextSong.isPending}
								>
									{nextSong.isPending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : null}
									Play Next
								</Button>
							)}
						</div>
					)}
				</div>

				<QRDisplay joinCode={joinCode} />
			</div>

			{/* Owner Song Search + Add */}
			<div className="rounded-lg border border-border bg-card p-4">
				<h2 className="mb-3 font-heading font-semibold">Add Songs</h2>
				<label className="sr-only" htmlFor="owner-song-search">
					Search for songs
				</label>
				<Input
					id="owner-song-search"
					placeholder="Search for songs..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="mb-3"
				/>

				{debouncedSearch.length > 0 && searchResults.isLoading && (
					<div className="space-y-2">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-14 w-full rounded-lg" />
						))}
					</div>
				)}
				{searchResults.isError && (
					<p className="py-3 text-center text-destructive text-sm">
						Search failed. Check your connection and try again.
					</p>
				)}
				{!searchResults.isLoading &&
					!searchResults.isError &&
					debouncedSearch.length > 0 &&
					(searchResults.data?.tracks.length ?? 0) === 0 && (
						<p className="py-3 text-center text-muted-foreground text-sm">
							No results for &ldquo;{debouncedSearch}&rdquo;
						</p>
					)}

				{searchResults.data?.tracks.map((track) => (
					<div
						key={track.providerId}
						className="flex items-center gap-3 overflow-hidden border-b py-2 last:border-0"
					>
						{track.thumbnailUrl && (
							<Image
								src={track.thumbnailUrl}
								alt={track.title}
								width={40}
								height={40}
								className="h-10 w-10 shrink-0 rounded"
								onError={(e) => {
									e.currentTarget.style.display = "none";
								}}
							/>
						)}
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium text-sm">{track.title}</p>
							<p className="truncate text-muted-foreground text-sm">
								{track.artist}
							</p>
						</div>
						<Button
							size="sm"
							variant="outline"
							disabled={addSong.isPending}
							onClick={() =>
								addSong.mutate({ sessionId, providerId: track.providerId })
							}
						>
							{addSong.isPending ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								"Add"
							)}
						</Button>
					</div>
				))}
			</div>

			{/* Queue */}
			<div className="rounded-lg border border-border bg-card p-4">
				<h2 className="mb-3 font-heading font-semibold">Queue</h2>
				{queue.isError ? (
					<p className="py-4 text-center text-destructive text-sm">
						Failed to load queue. Refresh to retry.
					</p>
				) : queue.isLoading ? (
					<div className="space-y-2">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-14 w-full rounded-lg" />
						))}
					</div>
				) : (
					<QueueManager songs={queue.data ?? []} sessionId={sessionId} />
				)}
			</div>
		</div>
	);
}
