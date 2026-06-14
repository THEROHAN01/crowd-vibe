"use client";

import type { VenueSettings } from "@crowd-vibe/api/lib/settings";
import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { Label } from "@crowd-vibe/ui/components/label";
import { Switch } from "@crowd-vibe/ui/components/switch";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { queryClient, trpc } from "@/utils/trpc";

interface VenueSettingsFormProps {
	venueId: string;
	initialSettings: VenueSettings;
	onSaved: () => void;
}

export default function VenueSettingsForm({
	venueId,
	initialSettings,
	onSaved,
}: VenueSettingsFormProps) {
	const [local, setLocal] = useState<VenueSettings>(initialSettings);

	const isDirty = JSON.stringify(local) !== JSON.stringify(initialSettings);

	const save = useMutation(
		trpc.venue.updateSettings.mutationOptions({
			onSuccess: () => {
				toast.success("Settings saved");
				queryClient.invalidateQueries();
				onSaved();
			},
			onError: (err) => {
				toast.error(err.message);
			},
		}),
	);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const clamped: VenueSettings = {
			...local,
			maxSuggestionsPerGuest: Math.max(
				1,
				Math.min(20, local.maxSuggestionsPerGuest || 5),
			),
			suggestionCooldownSec: Math.max(
				0,
				Math.min(300, local.suggestionCooldownSec ?? 30),
			),
			downvoteSkipThreshold: Math.max(
				-20,
				Math.min(-1, local.downvoteSkipThreshold || -3),
			),
		};
		save.mutate({ id: venueId, settings: clamped });
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-0">
			{/* Max suggestions */}
			<div className="border border-border p-4 shadow-[3px_3px_0_hsl(var(--foreground)/0.08)]">
				<div className="mb-3 flex items-start justify-between gap-4">
					<div className="min-w-0">
						<Label
							htmlFor="max-suggestions"
							className="font-mono text-[0.65rem] text-muted-foreground uppercase tracking-widest"
						>
							Max suggestions / guest
						</Label>
						<p
							id="max-suggestions-desc"
							className="mt-0.5 text-muted-foreground text-xs"
						>
							Songs each guest can add per session (1–20)
						</p>
					</div>
					<Input
						id="max-suggestions"
						type="number"
						min={1}
						max={20}
						value={local.maxSuggestionsPerGuest}
						onChange={(e) => {
							const val = Number(e.target.value);
							if (!Number.isNaN(val))
								setLocal((s) => ({ ...s, maxSuggestionsPerGuest: val }));
						}}
						aria-describedby="max-suggestions-desc"
						className="w-20 shrink-0 rounded-none text-center"
					/>
				</div>
			</div>

			{/* Cooldown */}
			<div className="border border-border border-t-0 p-4 shadow-[3px_3px_0_hsl(var(--foreground)/0.08)]">
				<div className="mb-3 flex items-start justify-between gap-4">
					<div className="min-w-0">
						<Label
							htmlFor="cooldown"
							className="font-mono text-[0.65rem] text-muted-foreground uppercase tracking-widest"
						>
							Suggestion cooldown
						</Label>
						<p
							id="cooldown-desc"
							className="mt-0.5 text-muted-foreground text-xs"
						>
							Wait time between guest suggestions (0–300 sec)
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<Input
							id="cooldown"
							type="number"
							min={0}
							max={300}
							value={local.suggestionCooldownSec}
							onChange={(e) => {
								const val = Number(e.target.value);
								if (!Number.isNaN(val))
									setLocal((s) => ({ ...s, suggestionCooldownSec: val }));
							}}
							aria-describedby="cooldown-desc"
							className="w-20 rounded-none text-center"
						/>
						<span className="font-mono text-muted-foreground text-xs">sec</span>
					</div>
				</div>
			</div>

			{/* Skip threshold */}
			<div className="border border-border border-t-0 p-4 shadow-[3px_3px_0_hsl(var(--foreground)/0.08)]">
				<div className="mb-3 flex items-start justify-between gap-4">
					<div className="min-w-0">
						<Label
							htmlFor="skip-threshold"
							className="font-mono text-[0.65rem] text-muted-foreground uppercase tracking-widest"
						>
							Downvote skip threshold
						</Label>
						<p
							id="skip-threshold-desc"
							className="mt-0.5 text-muted-foreground text-xs"
						>
							Score at which a song is auto-skipped (−20 to −1)
						</p>
					</div>
					<Input
						id="skip-threshold"
						type="number"
						min={-20}
						max={-1}
						value={local.downvoteSkipThreshold}
						onChange={(e) => {
							const val = Number(e.target.value);
							if (!Number.isNaN(val))
								setLocal((s) => ({ ...s, downvoteSkipThreshold: val }));
						}}
						aria-describedby="skip-threshold-desc"
						className="w-20 shrink-0 rounded-none text-center"
					/>
				</div>
			</div>

			{/* Explicit content */}
			<div className="border border-border border-t-0 p-4 shadow-[3px_3px_0_hsl(var(--foreground)/0.08)]">
				{/* biome-ignore lint/a11y/noLabelWithoutControl: wraps a role=switch span via implicit association */}
				<label className="flex cursor-pointer items-center justify-between gap-4">
					<div className="min-w-0">
						<span className="font-mono text-[0.65rem] text-muted-foreground uppercase tracking-widest">
							Allow explicit content
						</span>
						<p
							id="explicit-desc"
							className="mt-0.5 text-muted-foreground text-xs"
						>
							Guests can suggest songs marked explicit
						</p>
					</div>
					<Switch
						checked={local.allowExplicitContent}
						onCheckedChange={(checked) =>
							setLocal((s) => ({ ...s, allowExplicitContent: checked }))
						}
						aria-describedby="explicit-desc"
					/>
				</label>
			</div>

			<Button
				type="submit"
				disabled={!isDirty || save.isPending}
				className="mt-4 w-full rounded-none"
			>
				{save.isPending ? (
					<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				) : null}
				Save settings
			</Button>
		</form>
	);
}
