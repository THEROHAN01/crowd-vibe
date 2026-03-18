"use client";

import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { queryClient, trpc } from "@/utils/trpc";

interface VoteButtonProps {
	songId: string;
	direction: "up" | "down";
	isActive: boolean;
}

export default function VoteButton({
	songId,
	direction,
	isActive,
}: VoteButtonProps) {
	const castVote = useMutation(
		trpc.vote.cast.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries();
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
