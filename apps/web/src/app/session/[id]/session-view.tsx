"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Music } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useSessionEvents } from "@/hooks/use-session-events";
import NowPlaying from "@/components/session/now-playing";
import SongQueue from "@/components/session/song-queue";
import SongSearch from "@/components/session/song-search";
import Logo from "@/components/ui/logo";
import LiveBadge from "@/components/ui/live-badge";

export default function SessionView({ sessionId }: { sessionId: string }) {
  const [sessionEnded, setSessionEnded] = useState(false);

  const queue = useQuery(trpc.queue.list.queryOptions({ sessionId }));
  const nowPlaying = useQuery(trpc.queue.nowPlaying.queryOptions({ sessionId }));
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
          <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading text-2xl font-semibold mb-2">Session Ended</h2>
          <p className="text-sm text-muted-foreground">Thanks for vibing!</p>
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
    <div className="flex flex-col h-full max-w-lg mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Logo size="sm" />
        <LiveBadge />
      </div>

      {/* Now Playing Hero */}
      <div aria-live="polite">
        <NowPlaying song={nowPlaying.data ?? null} />
      </div>

      {/* Queue */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h2 className="font-semibold text-sm text-muted-foreground mb-2">UP NEXT</h2>
        <SongQueue songs={queue.data ?? []} myVotes={myVotes} />
      </div>

      {/* Search & Add */}
      <div className="p-4 border-t">
        <SongSearch sessionId={sessionId} />
      </div>
    </div>
  );
}
