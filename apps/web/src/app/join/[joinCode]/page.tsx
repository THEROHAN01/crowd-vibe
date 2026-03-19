"use client";

import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { Label } from "@crowd-vibe/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/ui/logo";
import { useGuest } from "@/hooks/use-guest";
import { trpc } from "@/utils/trpc";

export default function JoinPage() {
	const params = useParams<{ joinCode: string }>();
	const router = useRouter();
	const [displayName, setDisplayName] = useState("");
	const { join, isJoining, error } = useGuest();

	const sessionInfo = useQuery(
		trpc.session.getByJoinCode.queryOptions({ joinCode: params.joinCode }),
	);

	const handleJoin = async () => {
		const result = await join(params.joinCode, displayName || undefined);
		if (result) {
			router.push(`/session/${result.sessionId}`);
		}
	};

	if (sessionInfo.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">Loading...</div>
		);
	}

	if (sessionInfo.error) {
		return (
			<div className="flex h-full flex-col items-center justify-center px-4">
				<p className="font-medium text-lg">Session not found</p>
				<p className="text-muted-foreground">
					This code may be invalid or the session has ended.
				</p>
			</div>
		);
	}

	return (
		<div
			className="flex h-full flex-col items-center justify-center gap-6 px-4"
			style={{
				background:
					"radial-gradient(ellipse at center, color-mix(in oklch, var(--primary) 5%, transparent), transparent)",
			}}
		>
			<Logo />

			<div className="grid w-full max-w-sm gap-4 rounded-xl border border-primary/20 bg-card p-6 shadow-lg shadow-primary/5">
				<div className="text-center">
					<h1 className="font-bold font-heading text-2xl">
						{sessionInfo.data?.venueName}
					</h1>
					{sessionInfo.data?.sessionName && (
						<p className="text-muted-foreground">
							&quot;{sessionInfo.data.sessionName}&quot;
						</p>
					)}
				</div>

				<Label htmlFor="guest-name">Display name <span className="text-muted-foreground font-normal">(optional)</span></Label>
				<Input
					id="guest-name"
					placeholder="Your name (optional)"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
				/>
				<Button
					onClick={handleJoin}
					disabled={isJoining}
					size="lg"
					className="w-full"
				>
					{isJoining ? "Joining..." : "Join the Vibe"}
				</Button>
				{error && (
					<p className="text-center text-destructive text-sm">{error}</p>
				)}

				<p className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
					<span className="relative flex h-2 w-2">
						<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
						<span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
					</span>
					{sessionInfo.data?.listenerCount ?? 0} people vibing now
				</p>
			</div>
		</div>
	);
}
