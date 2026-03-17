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
  const activeColor = direction === "up" ? "text-green-500" : "text-red-500";

  return (
    <button
      onClick={() => castVote.mutate({ songId, value: direction === "up" ? 1 : -1 })}
      disabled={castVote.isPending}
      className={`p-1 rounded transition-transform active:scale-90 ${isActive ? activeColor : "text-muted-foreground"}`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
