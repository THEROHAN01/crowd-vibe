"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { X } from "lucide-react";
import { trpc, queryClient } from "@/utils/trpc";

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
  const removeSong = useMutation(trpc.song.remove.mutationOptions());

  if (songs.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No songs in queue yet. Add songs or share the QR code!
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {songs.map((song, i) => (
        <div
          key={song.id}
          className="flex items-center gap-3 p-3 border rounded-lg"
        >
          <span className="text-muted-foreground text-sm w-6">{i + 1}</span>
          {song.thumbnailUrl && (
            <img src={song.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{song.title}</p>
            {song.artist && (
              <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
            )}
          </div>
          <span className="text-sm font-bold">{song.score > 0 ? `+${song.score}` : song.score}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeSong.mutate({ songId: song.id })}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
