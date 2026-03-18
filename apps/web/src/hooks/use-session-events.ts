"use client";

import { useEffect, useRef } from "react";

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
	onSessionEnded?: () => void;
	onReconnect?: () => void;
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
) {
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		if (!sessionId) return;

		const eventSource = new EventSource(`/api/sse/${sessionId}`);

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
				handlersRef.current.onSongAdded?.((data as { song: QueuedSong }).song);
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

		// EventSource auto-reconnects on error. On reconnect, notify the caller
		// so it can refetch full queue state to catch up on missed events.
		eventSource.onerror = () => {
			if (eventSource.readyState === EventSource.CONNECTING) {
				handlersRef.current.onReconnect?.();
			}
		};

		return () => {
			eventSource.close();
		};
	}, [sessionId]);
}
