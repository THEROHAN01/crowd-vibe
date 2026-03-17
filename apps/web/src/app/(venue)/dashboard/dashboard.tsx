"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import CreateVenueForm from "@/components/venue/create-venue-form";
import StartSessionForm from "@/components/venue/start-session-form";
import SessionDashboard from "@/components/venue/session-dashboard";

export default function Dashboard({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const venues = useQuery(trpc.venue.listMine.queryOptions());

  if (venues.isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  const venue = venues.data?.[0];

  // No venue yet — show create form
  if (!venue) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Create Your Venue</h1>
        <CreateVenueForm onCreated={() => venues.refetch()} />
      </div>
    );
  }

  const activeSession = venue.sessions?.[0];

  // Venue exists but no active session — show start session
  if (!activeSession) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">{venue.name}</h1>
        <p className="text-muted-foreground mb-6">No active session</p>
        <StartSessionForm venueId={venue.id} onStarted={() => venues.refetch()} />
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
