"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crowd-vibe/ui/components/sheet";
import { useQuery } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import CreateVenueForm from "@/components/venue/create-venue-form";
import SessionDashboard from "@/components/venue/session-dashboard";
import StartSessionForm from "@/components/venue/start-session-form";
import VenueSettingsForm from "@/components/venue/venue-settings-form";
import { trpc } from "@/utils/trpc";

export default function Dashboard({
	userId,
	userName,
}: {
	userId: string;
	userName: string;
}) {
	const venues = useQuery(trpc.venue.listMine.queryOptions());
	const [settingsOpen, setSettingsOpen] = useState(false);

	if (venues.isLoading) {
		return (
			<div className="flex items-center justify-center p-8">Loading...</div>
		);
	}

	if (venues.isError) {
		return (
			<div className="container mx-auto max-w-md px-4 py-8">
				<p className="text-destructive text-sm">
					Failed to load venue. Please refresh.
				</p>
			</div>
		);
	}

	const venue = venues.data?.[0];

	// No venue yet — show create form
	if (!venue) {
		return (
			<div className="container mx-auto max-w-md px-4 py-8">
				<h1 className="mb-6 font-bold font-heading text-2xl">
					Create Your Venue
				</h1>
				<CreateVenueForm onCreated={() => venues.refetch()} />
			</div>
		);
	}

	const activeSession = venue.sessions?.[0];

	return (
		<>
			{/* Settings Sheet — accessible from both no-session and active-session states */}
			<Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
				<SheetContent side="right" className="w-80 overflow-y-auto p-0">
					<SheetHeader className="border-border border-b px-4 py-4">
						<SheetTitle className="font-mono text-xs uppercase tracking-widest">
							Venue Settings
						</SheetTitle>
					</SheetHeader>
					<div className="p-4">
						<VenueSettingsForm
							key={venue.id + String(settingsOpen)}
							venueId={venue.id}
							initialSettings={venue.settings}
							onSaved={() => setSettingsOpen(false)}
						/>
					</div>
				</SheetContent>
			</Sheet>

			{/* Venue exists but no active session */}
			{!activeSession ? (
				<div className="container mx-auto max-w-md px-4 py-8">
					<div className="mb-6 flex items-center justify-between">
						<div>
							<h1 className="font-bold font-heading text-2xl">{venue.name}</h1>
							<p className="text-muted-foreground">No active session</p>
						</div>
						<button
							type="button"
							onClick={() => setSettingsOpen(true)}
							aria-label="Venue settings"
							className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							<Settings2 className="h-4 w-4" aria-hidden="true" />
						</button>
					</div>
					<StartSessionForm
						venueId={venue.id}
						onStarted={() => venues.refetch()}
					/>
				</div>
			) : (
				/* Active session — show live dashboard */
				<SessionDashboard
					venueId={venue.id}
					venueName={venue.name}
					sessionId={activeSession.id}
					joinCode={activeSession.joinCode}
					sessionName={activeSession.name}
					onSessionEnded={() => venues.refetch()}
					onOpenSettings={() => setSettingsOpen(true)}
				/>
			)}
		</>
	);
}
