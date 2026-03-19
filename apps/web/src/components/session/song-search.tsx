"use client";

import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import {
	Sheet,
	SheetContent,
	SheetTrigger,
} from "@crowd-vibe/ui/components/sheet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { queryClient, trpc } from "@/utils/trpc";

export default function SongSearch({ sessionId }: { sessionId: string }) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");

	// Debounce search input by 300ms
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 300);
		return () => clearTimeout(timer);
	}, [query]);

	const searchResults = useQuery({
		...trpc.song.search.queryOptions({ sessionId, query: debouncedQuery }),
		enabled: debouncedQuery.length > 0,
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
				setQuery("");
				setOpen(false);
			},
			onError: (err) => {
				toast.error(err.message);
			},
		}),
	);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger
				render={
					<Button variant="tonal" className="w-full" size="lg">
						<Search className="mr-2 h-4 w-4" />
						Search &amp; Add Songs
					</Button>
				}
			/>
			<SheetContent
				side="bottom"
				className="rounded-t-2xl bg-card"
				showCloseButton={false}
			>
				{/* Drag handle */}
				<div className="mx-auto mt-2 mb-1 h-1 w-8 rounded-full bg-muted-foreground/40" />
				<div className="border-b p-4">
					<label className="sr-only" htmlFor="song-search">
						Search songs
					</label>
					<Input
						id="song-search"
						autoFocus
						placeholder="Search songs..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="w-full"
					/>
					<p className="mt-2 text-muted-foreground text-sm">
						Suggestions left: {maxSuggestions - suggestionsUsed}/
						{maxSuggestions}
					</p>
				</div>
				<div className="max-h-[60vh] flex-1 overflow-y-auto p-4">
					{searchResults.isLoading && (
						<p className="text-center text-muted-foreground">Searching...</p>
					)}
					{searchResults.data?.tracks.map((track) => (
						<div
							key={track.providerId}
							className="flex items-center gap-3 border-b py-3 last:border-0"
						>
							{track.thumbnailUrl && (
								<Image
									src={track.thumbnailUrl}
									alt=""
									width={48}
									height={48}
									className="h-12 w-12 rounded object-cover"
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
								onClick={() =>
									suggestSong.mutate({ providerId: track.providerId })
								}
								disabled={
									suggestSong.isPending || suggestionsUsed >= maxSuggestions
								}
							>
								{suggestionsUsed >= maxSuggestions ? "Limit" : "Add"}
							</Button>
						</div>
					))}
				</div>
			</SheetContent>
		</Sheet>
	);
}
