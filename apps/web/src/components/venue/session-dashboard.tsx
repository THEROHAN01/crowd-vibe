"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { trpc, queryClient } from "@/utils/trpc";
import { useSessionEvents } from "@/hooks/use-session-events";
import YouTubePlayer from "@/components/player/youtube-player";
import QRDisplay from "@/components/venue/qr-display";
import QueueManager from "@/components/venue/queue-manager";

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

  // Debounce owner search by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queue = useQuery(trpc.queue.list.queryOptions({ sessionId }));
  const nowPlaying = useQuery(trpc.queue.nowPlaying.queryOptions({ sessionId }));
  const stats = useQuery(trpc.session.stats.queryOptions({ sessionId }));
  const searchResults = useQuery({
    ...trpc.song.search.queryOptions({ sessionId, query: debouncedSearch }),
    enabled: debouncedSearch.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const nextSong = useMutation(trpc.queue.next.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  }));
  const skipSong = useMutation(trpc.queue.skip.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  }));
  const endSession = useMutation(trpc.session.end.mutationOptions({
    onSuccess: onSessionEnded,
  }));
  const addSong = useMutation(trpc.song.add.mutationOptions());

  // SSE real-time updates
  useSessionEvents(sessionId, {
    onVoteChanged: () => queue.refetch(),
    onSongAdded: () => queue.refetch(),
    onSongRemoved: () => queue.refetch(),
    onNowPlaying: () => {
      nowPlaying.refetch();
      queue.refetch();
    },
  });

  const handleSongEnded = useCallback(() => {
    nextSong.mutate({ sessionId });
  }, [sessionId, nextSong]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 grid gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{venueName}</h1>
          {sessionName && <p className="text-muted-foreground">{sessionName}</p>}
          <p className="text-sm text-muted-foreground">
            Listeners: {stats.data?.listenerCount ?? 0} | Songs played: {stats.data?.songsPlayed ?? 0}
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => endSession.mutate({ sessionId })}>
          End Session
        </Button>
      </div>

      {/* Now Playing + Player */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Now Playing</h2>
        {nowPlaying.data ? (
          <div className="grid gap-3">
            <YouTubePlayer videoId={nowPlaying.data.providerId} onEnded={handleSongEnded} />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{nowPlaying.data.title}</p>
                {nowPlaying.data.artist && <p className="text-sm text-muted-foreground">{nowPlaying.data.artist}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Score: {nowPlaying.data.score}</span>
                <Button variant="outline" size="sm" onClick={() => skipSong.mutate({ sessionId })}>
                  Skip
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">No song playing</p>
            {(queue.data?.length ?? 0) > 0 && (
              <Button onClick={() => nextSong.mutate({ sessionId })}>Play Next</Button>
            )}
          </div>
        )}
      </div>

      {/* Owner Song Search + Add */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add Songs</h2>
        <Input
          placeholder="Search for songs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-3"
        />
        {searchResults.data?.tracks.map((track) => (
          <div key={track.providerId} className="flex items-center gap-3 py-2 border-b last:border-0">
            {track.thumbnailUrl && <img src={track.thumbnailUrl} alt="" className="w-10 h-10 rounded" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{track.title}</p>
              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => addSong.mutate({ sessionId, providerId: track.providerId })}>
              Add
            </Button>
          </div>
        ))}
      </div>

      {/* Queue */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Queue</h2>
        <QueueManager songs={queue.data ?? []} sessionId={sessionId} />
      </div>

      {/* QR Code */}
      <QRDisplay joinCode={joinCode} />
    </div>
  );
}
