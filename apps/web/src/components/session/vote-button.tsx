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
					// Same direction — toggle off
					delta = -value;
				} else if (myCurrentVote !== 0) {
					// Opposite direction — switch
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
