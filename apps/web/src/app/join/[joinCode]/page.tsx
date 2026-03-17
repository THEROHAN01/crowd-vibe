"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { trpc } from "@/utils/trpc";
import { useGuest } from "@/hooks/use-guest";

export default function JoinPage() {
  const params = useParams<{ joinCode: string }>();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const { join, isJoining, error } = useGuest();

  const sessionInfo = useQuery(
    trpc.session.getByJoinCode.queryOptions({ joinCode: params.joinCode })
  );

  const handleJoin = async () => {
    const result = await join(params.joinCode, displayName || undefined);
    if (result) {
      router.push(`/session/${result.sessionId}`);
    }
  };

  if (sessionInfo.isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (sessionInfo.error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <p className="text-lg font-medium">Session not found</p>
        <p className="text-muted-foreground">This code may be invalid or the session has ended.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{sessionInfo.data?.venueName}</h1>
        {sessionInfo.data?.sessionName && (
          <p className="text-muted-foreground">&quot;{sessionInfo.data.sessionName}&quot;</p>
        )}
      </div>

      <div className="w-full max-w-sm grid gap-4">
        <Input
          placeholder="Your name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Button onClick={handleJoin} disabled={isJoining} size="lg" className="w-full">
          {isJoining ? "Joining..." : "Join the Vibe"}
        </Button>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
      </div>

      <p className="text-sm text-muted-foreground">
        {sessionInfo.data?.listenerCount ?? 0} people vibing now
      </p>
    </div>
  );
}
