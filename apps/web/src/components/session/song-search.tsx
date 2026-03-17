"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { Search } from "lucide-react";
import { trpc, queryClient } from "@/utils/trpc";
import { toast } from "sonner";

export default function SongSearch({ sessionId }: { sessionId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchResults = useQuery({
    ...trpc.song.search.queryOptions({ sessionId, query: debouncedQuery }),
    enabled: debouncedQuery.length > 0 && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const guestInfo = useQuery(trpc.guest.me.queryOptions());
  const suggestionsUsed = guestInfo.data?._count?.suggestions ?? 0;
  const maxSuggestions = 5;

  const suggestSong = useMutation(
    trpc.song.suggest.mutationOptions({
      onSuccess: () => {
        toast.success("Song added to queue!");
        queryClient.invalidateQueries();
        setIsOpen(false);
        setQuery("");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} variant="outline" className="w-full" size="lg">
        <Search className="w-4 h-4 mr-2" />
        Search & Add Songs
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="p-4 border-b flex items-center gap-2">
        <Input
          autoFocus
          placeholder="Search songs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button variant="ghost" onClick={() => { setIsOpen(false); setQuery(""); }}>
          Cancel
        </Button>
      </div>
      <div className="px-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Suggestions left: {maxSuggestions - suggestionsUsed}/{maxSuggestions}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {searchResults.isLoading && <p className="text-center text-muted-foreground">Searching...</p>}
        {searchResults.data?.tracks.map((track) => (
          <div key={track.providerId} className="flex items-center gap-3 py-3 border-b last:border-0">
            {track.thumbnailUrl && (
              <img src={track.thumbnailUrl} alt="" className="w-12 h-12 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{track.title}</p>
              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            </div>
            <Button
              size="sm"
              onClick={() => suggestSong.mutate({ providerId: track.providerId })}
              disabled={suggestSong.isPending || suggestionsUsed >= maxSuggestions}
            >
              {suggestionsUsed >= maxSuggestions ? "Limit" : "Add"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
