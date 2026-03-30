"use client";

import { useQuery } from "@tanstack/react-query";
import CreateVenueForm from "@/components/venue/create-venue-form";
import SessionDashboard from "@/components/venue/session-dashboard";
import StartSessionForm from "@/components/venue/start-session-form";
import { trpc } from "@/utils/trpc";

export default function Dashboard({
	userId,
	userName,
}: {
	userId: string;
	userName: string;
}) {
	const venues = useQuery(trpc.venue.listMine.queryOptions());

	if (venues.isLoading) {
		return (
			<div className="flex items-center justify-center p-8">Loading...</div>
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

	// Venue exists but no active session — show start session
	if (!activeSession) {
		return (
			<div className="container mx-auto max-w-md px-4 py-8">
				<h1 className="mb-2 font-bold font-heading text-2xl">{venue.name}</h1>
				<p className="mb-6 text-muted-foreground">No active session</p>
				<StartSessionForm
					venueId={venue.id}
					onStarted={() => venues.refetch()}
				/>
			</div>
		);
	}

	// Active session — show live dashboard
	return (
		<SessionDashboard
			venueId={venue.id}
			venueName={venue.name}
			sessionId={activeSession.id}
			joinCode={activeSession.joinCode}
			sessionName={activeSession.name}
			onSessionEnded={() => venues.refetch()}
		/>
	);
}
