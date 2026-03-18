import prisma from "@crowd-vibe/db";
import { generateJoinCode } from "../../src/lib/join-code";

let counter = 0;

export async function createTestUser(
	overrides?: Partial<Parameters<typeof prisma.user.create>[0]["data"]>,
) {
	counter++;
	return prisma.user.create({
		data: {
			id: crypto.randomUUID(),
			name: "Test User",
			email: `test-${counter}@example.com`,
			...overrides,
		},
	});
}

export async function createTestVenue(
	ownerId: string,
	overrides?: Partial<Parameters<typeof prisma.venue.create>[0]["data"]>,
) {
	const suffix = crypto.randomUUID().slice(0, 8);
	return prisma.venue.create({
		data: {
			name: "Test Venue",
			slug: `test-venue-${suffix}`,
			ownerId,
			...overrides,
		},
	});
}

export async function createTestSession(
	venueId: string,
	overrides?: Partial<Parameters<typeof prisma.venueSession.create>[0]["data"]>,
) {
	return prisma.venueSession.create({
		data: {
			venueId,
			joinCode: generateJoinCode(),
			...overrides,
		},
	});
}

export async function createTestGuest(
	sessionId: string,
	overrides?: Partial<Parameters<typeof prisma.guestUser.create>[0]["data"]>,
) {
	return prisma.guestUser.create({
		data: {
			sessionId,
			fingerprint: crypto.randomUUID(),
			...overrides,
		},
	});
}

export async function createTestSong(
	sessionId: string,
	overrides?: Partial<Parameters<typeof prisma.song.create>[0]["data"]>,
) {
	const suffix = crypto.randomUUID().slice(0, 8);
	return prisma.song.create({
		data: {
			sessionId,
			providerId: `test-video-${suffix}`,
			provider: "youtube",
			title: "Test Song",
			status: "queued",
			...overrides,
		},
	});
}
