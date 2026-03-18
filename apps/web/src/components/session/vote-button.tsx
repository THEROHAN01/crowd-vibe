"use client";

import { useMutation } from "@tanstack/react-query";
import { ChevronUp, ChevronDown } from "lucide-react";
import { trpc, queryClient } from "@/utils/trpc";

interface VoteButtonProps {
  songId: string;
  direction: "up" | "down";
  isActive: boolean;
}

export default function VoteButton({ songId, direction, isActive }: VoteButtonProps) {
  const castVote = useMutation(
    trpc.vote.cast.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
    })
  );

  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  const activeClass =
    direction === "up"
      ? "bg-upvote/15 text-upvote"
      : "bg-downvote/15 text-downvote";

  return (
    <button
      onClick={() => castVote.mutate({ songId, value: direction === "up" ? 1 : -1 })}
      disabled={castVote.isPending}
      className={`w-11 h-11 flex items-center justify-center rounded-full transition-transform active:scale-[0.85] ${isActive ? activeClass : "text-on-surface-variant"}`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
