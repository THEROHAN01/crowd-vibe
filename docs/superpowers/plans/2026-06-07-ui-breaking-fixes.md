# UI Breaking Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 8 actionable breaking UI issues identified in the June 2026 audit, plus fix the phone mockup glow animation that causes mobile page scrolling.

**Architecture:** Pure in-place fixes — no new routes, no new packages, no abstractions beyond what each fix strictly requires. Fixes stay in their natural files; the one new file is a minimal inline error boundary component.

**Tech Stack:** Next.js 16 App Router, React 19, tRPC v11, TanStack React Query v5, Tailwind CSS 4, Lucide React, Sonner

---

## Pre-flight Notes

- Issues **004** (`suggestSong` onError) and **010** (dashboard session guard) are **already fixed** in the current code — skip them.
- Issue **009** (optimistic vote) requires threading `sessionId` and `myCurrentVote` through `session-view → SongQueue → VoteButton`.
- There is **no** `react-error-boundary` package — implement a minimal class-based `ErrorBoundary` component directly.
- `npm run check` (Biome) must pass after every commit. Run it before committing.

---

## File Map

| File | Change |
|---|---|
| `packages/ui/src/styles/globals.css` | Remove `scale()` from `phone-glow-pulse` — fixes mobile scroll |
| `apps/web/src/components/error-boundary.tsx` | **Create** — minimal class-based ErrorBoundary |
| `apps/web/src/components/venue/session-dashboard.tsx` | Issues 001, 002, 003, 007 — loading/error states, skeleton, pending button |
| `apps/web/src/hooks/use-session-events.ts` | Issue 005 — expose `connected` state |
| `apps/web/src/app/(app)/session/[id]/session-view.tsx` | Issue 005 consumer + Issue 008 — wrap sections in ErrorBoundary |
| `apps/web/src/components/session/song-queue.tsx` | Issues 006, 009 — thumbnail fallback, pass sessionId down |
| `apps/web/src/components/session/vote-button.tsx` | Issue 009 — optimistic update with rollback |
| `apps/web/src/components/session/song-search.tsx` | Issue 006 — thumbnail fallback |

---

## Task 1: Fix phone glow animation (landing page mobile scroll issue)

**Files:**
- Modify: `packages/ui/src/styles/globals.css` (lines 362–371)

The `phone-glow-pulse` keyframe uses `transform: scale(1.04)` on an absolutely-positioned element with `bottom: -2rem`. On mobile, the vertical scale can extend the element beyond the section boundary and trigger browser scroll recalculation. Removing `scale()` and keeping only `opacity` preserves the glow effect without the layout risk.

- [ ] **Step 1: Edit the keyframe and class**

In `packages/ui/src/styles/globals.css`, replace:
```css
@keyframes phone-glow-pulse {
	0%, 100% { opacity: 0.45; transform: scale(1); }
	50% { opacity: 0.85; transform: scale(1.04); }
}
.animate-phone-glow {
	animation: phone-glow-pulse 4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
	.animate-phone-glow { animation: none; opacity: 0.6; }
}
```
With:
```css
@keyframes phone-glow-pulse {
	0%, 100% { opacity: 0.45; }
	50% { opacity: 0.85; }
}
.animate-phone-glow {
	animation: phone-glow-pulse 4s ease-in-out infinite;
	will-change: opacity;
}
@media (prefers-reduced-motion: reduce) {
	.animate-phone-glow { animation: none; opacity: 0.6; }
}
```

- [ ] **Step 2: Commit**
```bash
git add packages/ui/src/styles/globals.css
git commit -m "fix: remove scale from phone-glow-pulse to prevent mobile page scroll"
```

---

## Task 2: Create inline ErrorBoundary component (for Issue 008)

**Files:**
- Create: `apps/web/src/components/error-boundary.tsx`

React Error Boundaries must be class components. This is a minimal, reusable one.

- [ ] **Step 1: Create the file**

`apps/web/src/components/error-boundary.tsx`:
```tsx
"use client";

import { Component, type ReactNode } from "react";

interface Props {
	fallback?: ReactNode;
	children: ReactNode;
}

interface State {
	hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback ?? (
					<div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
						<p className="text-muted-foreground text-sm">
							Something went wrong. Pull down to refresh.
						</p>
						<button
							type="button"
							className="text-primary text-sm underline underline-offset-2"
							onClick={() => this.setState({ hasError: false })}
						>
							Try again
						</button>
					</div>
				)
			);
		}
		return this.props.children;
	}
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/error-boundary.tsx
git commit -m "feat: add minimal class-based ErrorBoundary component"
```

---

## Task 3: Fix session-dashboard.tsx (Issues 001, 002, 003, 007)

**Files:**
- Modify: `apps/web/src/components/venue/session-dashboard.tsx`

Four issues in one file:
- **001**: Search results section has no loading/error states
- **002**: Queue/stats/nowPlaying have no error display
- **003**: Queue shows "empty" instead of skeleton while loading
- **007**: Add Song button has no pending/disabled state

- [ ] **Step 1: Replace the full file**

Replace `apps/web/src/components/venue/session-dashboard.tsx` with:

```tsx
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
		}),
	);
	const skipSong = useMutation(
		trpc.queue.skip.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries();
			},
		}),
	);
	const endSession = useMutation(
		trpc.session.end.mutationOptions({
			onSuccess: onSessionEnded,
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
					searchResults.data?.tracks.length === 0 && (
						<p className="py-3 text-center text-muted-foreground text-sm">
							No results for "{debouncedSearch}"
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
```

- [ ] **Step 2: Verify Skeleton import exists in @crowd-vibe/ui**
```bash
find /home/rohan/playground/crowd-vibe/packages/ui/src -name "skeleton*" 2>/dev/null
```

If `skeleton.tsx` does NOT exist, add this simple inline skeleton instead of importing from ui package — replace all `<Skeleton ... />` usages with:
```tsx
<div className="animate-pulse rounded-lg bg-muted" style={{ height: "3.5rem" }} />
```
And remove the `Skeleton` import.

- [ ] **Step 3: Run type check**
```bash
npm run check-types 2>&1 | head -40
```
Expected: no new errors in session-dashboard.tsx.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/venue/session-dashboard.tsx
git commit -m "fix: add loading/error states and pending buttons to owner dashboard"
```

---

## Task 4: Fix use-session-events.ts — expose connection state (Issue 005)

**Files:**
- Modify: `apps/web/src/hooks/use-session-events.ts`

Add a `connected` return value. When SSE goes to CLOSED state (not just CONNECTING), call `onDisconnect` so the UI can surface a "connection lost" banner.

- [ ] **Step 1: Replace the file**

`apps/web/src/hooks/use-session-events.ts`:
```ts
"use client";

import { useEffect, useRef, useState } from "react";

interface QueuedSong {
	id: string;
	providerId: string;
	provider: string;
	title: string;
	artist: string | null;
	thumbnailUrl: string | null;
	durationMs: number | null;
	status: string;
	score: number;
	addedAt: string;
	suggestedBy: { displayName: string | null } | null;
}

interface SessionEventHandlers {
	onQueueUpdated?: (songs: QueuedSong[]) => void;
	onNowPlaying?: (song: QueuedSong | null) => void;
	onVoteChanged?: (songId: string, score: number) => void;
	onSongAdded?: (song: QueuedSong) => void;
	onSongRemoved?: (songId: string) => void;
	onListenerChanged?: (count: number) => void;
	onSessionEnded?: () => void;
	onReconnect?: () => void;
	onDisconnect?: () => void;
}

function safeParse(raw: string): unknown | null {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function useSessionEvents(
	sessionId: string | null,
	handlers: SessionEventHandlers,
): { connected: boolean } {
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;
	const [connected, setConnected] = useState(true);

	useEffect(() => {
		if (!sessionId) return;

		const eventSource = new EventSource(`/api/sse/${sessionId}`);

		eventSource.onopen = () => setConnected(true);

		eventSource.addEventListener("vote_changed", (e) => {
			const data = safeParse(e.data);
			if (data && typeof data === "object" && "songId" in data) {
				const d = data as { songId: string; score: number };
				handlersRef.current.onVoteChanged?.(d.songId, d.score);
			}
		});

		eventSource.addEventListener("now_playing", (e) => {
			const data = safeParse(e.data);
			if (data && typeof data === "object" && "song" in data) {
				handlersRef.current.onNowPlaying?.(
					(data as { song: QueuedSong | null }).song,
				);
			}
		});

		eventSource.addEventListener("song_added", (e) => {
			const data = safeParse(e.data);
			if (data && typeof data === "object" && "song" in data) {
				handlersRef.current.onSongAdded?.(
					(data as { song: QueuedSong }).song,
				);
			}
		});

		eventSource.addEventListener("song_removed", (e) => {
			const data = safeParse(e.data);
			if (data && typeof data === "object" && "songId" in data) {
				handlersRef.current.onSongRemoved?.(
					(data as { songId: string }).songId,
				);
			}
		});

		eventSource.addEventListener("listener_changed", (e) => {
			const data = safeParse(e.data);
			if (data && typeof data === "object" && "count" in data) {
				handlersRef.current.onListenerChanged?.(
					(data as { count: number }).count,
				);
			}
		});

		eventSource.addEventListener("queue_updated", (e) => {
			const data = safeParse(e.data);
			if (data && typeof data === "object" && "songs" in data) {
				handlersRef.current.onQueueUpdated?.(
					(data as { songs: QueuedSong[] }).songs,
				);
			}
		});

		eventSource.addEventListener("session_ended", () => {
			handlersRef.current.onSessionEnded?.();
		});

		eventSource.onerror = () => {
			if (eventSource.readyState === EventSource.CONNECTING) {
				setConnected(false);
				handlersRef.current.onReconnect?.();
			} else if (eventSource.readyState === EventSource.CLOSED) {
				setConnected(false);
				handlersRef.current.onDisconnect?.();
			}
		};

		return () => {
			eventSource.close();
		};
	}, [sessionId]);

	return { connected };
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/hooks/use-session-events.ts
git commit -m "fix: expose connected state and onDisconnect from useSessionEvents"
```

---

## Task 5: Fix session-view.tsx — connection banner + error boundaries (Issues 005, 008)

**Files:**
- Modify: `apps/web/src/app/(app)/session/[id]/session-view.tsx`

Two changes in this file:
1. Consume `connected` from `useSessionEvents` and render a "Connection lost" banner when `connected === false`
2. Wrap `NowPlaying` and `SongQueue` in `ErrorBoundary`

- [ ] **Step 1: Replace the file**

`apps/web/src/app/(app)/session/[id]/session-view.tsx`:
```tsx
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
```

- [ ] **Step 2: Run type check**
```bash
npm run check-types 2>&1 | grep "session-view" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/app/(app)/session/[id]/session-view.tsx
git commit -m "fix: add connection lost banner and error boundaries to guest session view"
```

---

## Task 6: Fix song-queue.tsx — thumbnail fallback + thread sessionId (Issues 006, 009 prep)

**Files:**
- Modify: `apps/web/src/components/session/song-queue.tsx`

Two changes:
1. Add `onError` to thumbnail images to hide broken images gracefully
2. Accept `sessionId` prop and pass it down to `VoteButton` (required for optimistic update in Task 7)

- [ ] **Step 1: Replace the file**

`apps/web/src/components/session/song-queue.tsx`:
```tsx
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
	sessionId: string;
}

export default function SongQueue({ songs, myVotes, sessionId }: SongQueueProps) {
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
								onError={(e) => {
									e.currentTarget.style.display = "none";
								}}
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
								sessionId={sessionId}
								direction="up"
								isActive={myVote === 1}
								myCurrentVote={myVote}
							/>
							<span className={`font-bold text-sm tabular-nums ${scoreClass}`}>
								{song.score}
							</span>
							<VoteButton
								songId={song.id}
								sessionId={sessionId}
								direction="down"
								isActive={myVote === -1}
								myCurrentVote={myVote}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/session/song-queue.tsx
git commit -m "fix: thumbnail fallback and thread sessionId through SongQueue for optimistic votes"
```

---

## Task 7: Fix vote-button.tsx — optimistic update with rollback (Issue 009)

**Files:**
- Modify: `apps/web/src/components/session/vote-button.tsx`

Add `sessionId` and `myCurrentVote` props. Use them in `onMutate` to update the queue score immediately, and rollback on error.

Score delta logic:
- If casting the same direction as current vote → toggle off → delta = `-value`
- If casting opposite direction → switch → delta = `value * 2`
- If no current vote → new vote → delta = `value`

- [ ] **Step 1: Replace the file**

`apps/web/src/components/session/vote-button.tsx`:
```tsx
"use client";

import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { queryClient, trpc } from "@/utils/trpc";

interface VoteButtonProps {
	songId: string;
	sessionId: string;
	direction: "up" | "down";
	isActive: boolean;
	myCurrentVote: number;
}

export default function VoteButton({
	songId,
	sessionId,
	direction,
	isActive,
	myCurrentVote,
}: VoteButtonProps) {
	const queueQueryKey = trpc.queue.list.queryOptions({ sessionId }).queryKey;

	const castVote = useMutation(
		trpc.vote.cast.mutationOptions({
			onMutate: async ({ value }) => {
				await queryClient.cancelQueries({ queryKey: queueQueryKey });

				const previousQueue = queryClient.getQueryData(queueQueryKey);

				let delta = value;
				if (myCurrentVote === value) {
					// Toggling same direction off
					delta = -value;
				} else if (myCurrentVote !== 0) {
					// Switching direction
					delta = value * 2;
				}

				queryClient.setQueryData(
					queueQueryKey,
					(old: Array<{ id: string; score: number }> | undefined) => {
						if (!old) return old;
						return old.map((song) =>
							song.id === songId
								? { ...song, score: song.score + delta }
								: song,
						);
					},
				);

				return { previousQueue };
			},
			onError: (err, _, ctx) => {
				if (ctx?.previousQueue !== undefined) {
					queryClient.setQueryData(queueQueryKey, ctx.previousQueue);
				}
				toast.error(err.message);
			},
			onSettled: () => {
				queryClient.invalidateQueries({ queryKey: queueQueryKey });
			},
		}),
	);

	const Icon = direction === "up" ? ChevronUp : ChevronDown;
	const activeClass =
		direction === "up"
			? "bg-upvote/15 text-upvote"
			: "bg-downvote/15 text-downvote";

	return (
		<button
			type="button"
			onClick={() =>
				castVote.mutate({ songId, value: direction === "up" ? 1 : -1 })
			}
			disabled={castVote.isPending}
			aria-label={direction === "up" ? "Upvote" : "Downvote"}
			className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-transform duration-instant ease-spring active:scale-[0.85] ${isActive ? activeClass : "text-on-surface-variant hover:bg-muted/50"}`}
		>
			<Icon className="h-5 w-5" />
		</button>
	);
}
```

- [ ] **Step 2: Run type check**
```bash
npm run check-types 2>&1 | grep -E "vote-button|song-queue|session-view" | head -30
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/session/vote-button.tsx
git commit -m "fix: add optimistic vote update with rollback to VoteButton"
```

---

## Task 8: Fix song-search.tsx — thumbnail fallback (Issue 006)

**Files:**
- Modify: `apps/web/src/components/session/song-search.tsx`

Add `onError` to the thumbnail image in the search results sheet.

- [ ] **Step 1: Edit the Image element in song-search.tsx**

Find the Image element (around line 95–101):
```tsx
<Image
    src={track.thumbnailUrl}
    alt=""
    width={48}
    height={48}
    className="h-12 w-12 shrink-0 rounded object-cover"
/>
```

Replace with:
```tsx
<Image
    src={track.thumbnailUrl}
    alt=""
    width={48}
    height={48}
    className="h-12 w-12 shrink-0 rounded object-cover"
    onError={(e) => {
        e.currentTarget.style.display = "none";
    }}
/>
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/session/song-search.tsx
git commit -m "fix: hide broken thumbnail images in song search results"
```

---

## Task 9: Final check — run Biome and type check

- [ ] **Step 1: Run Biome**
```bash
npm run check
```
Expected: "Checked N files. No fixes needed." or auto-fixes applied with no errors.

- [ ] **Step 2: Run TypeScript**
```bash
npm run check-types
```
Expected: 0 errors.

- [ ] **Step 3: Verify Skeleton component availability**

If Skeleton was unavailable (noted in Task 3), confirm the inline pulse divs are rendering correctly:
```bash
grep -n "animate-pulse" apps/web/src/components/venue/session-dashboard.tsx
```

---

## Self-Review Against Issues

| Issue | Task | Status |
|---|---|---|
| 001 — Dashboard search no loading/error | Task 3 | Fixed |
| 002 — Queue/stats/nowPlaying no error handling | Task 3 | Fixed |
| 003 — Queue shows empty instead of skeleton | Task 3 | Fixed |
| 004 — suggestSong no onError | SKIP — already fixed in code | — |
| 005 — SSE disconnection no feedback | Tasks 4 + 5 | Fixed |
| 006 — Thumbnail no fallback | Tasks 6 + 8 | Fixed |
| 007 — Add song button no pending state | Task 3 | Fixed |
| 008 — No error boundary | Tasks 2 + 5 | Fixed |
| 009 — Vote buttons no optimistic update | Tasks 6 + 7 | Fixed |
| 010 — Dashboard no session guard | SKIP — already handled | — |
| Landing page wave scroll | Task 1 | Fixed |
