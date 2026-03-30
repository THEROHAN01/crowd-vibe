"use client";

import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { Label } from "@crowd-vibe/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient, trpc } from "@/utils/trpc";

export default function StartSessionForm({
	venueId,
	onStarted,
}: {
	venueId: string;
	onStarted: () => void;
}) {
	const [name, setName] = useState("");

	const startSession = useMutation(
		trpc.session.start.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries();
				onStarted();
			},
		}),
	);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				startSession.mutate({
					venueId,
					name: name || undefined,
					musicProvider: "youtube",
				});
			}}
			className="grid gap-4"
		>
			<div className="grid gap-2">
				<Label htmlFor="sessionName">Session Name (optional)</Label>
				<Input
					id="sessionName"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Friday Night Vibes"
				/>
			</div>
			<div className="grid gap-2">
				<Label>Music Provider</Label>
				<div className="flex gap-2">
					<Button
						type="button"
						variant="default"
						size="sm"
						className="pointer-events-none"
					>
						YouTube
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled
						className="opacity-50"
					>
						Spotify (Coming Soon)
					</Button>
				</div>
			</div>
			<Button type="submit" disabled={startSession.isPending}>
				{startSession.isPending ? "Starting..." : "Start Session"}
			</Button>
		</form>
	);
}
