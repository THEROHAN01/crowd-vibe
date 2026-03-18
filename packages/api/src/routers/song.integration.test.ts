import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	MusicProvider,
	MusicTrack,
	PlayerData,
	SearchResult,
} from "../music/types";

// Mock the music provider module
const mockProvider: MusicProvider = {
	search: vi.fn<MusicProvider["search"]>().mockResolvedValue({
		tracks: [
			{
				providerId: "vid-1",
				provider: "youtube",
				title: "Mock Song",
				artist: "Mock Artist",
				thumbnailUrl: "mock-thumb.jpg",
				durationMs: 200_000,
			},
		],
	}),
	getTrack: vi.fn<MusicProvider["getTrack"]>().mockResolvedValue({
		providerId: "vid-1",
		provider: "youtube",
		title: "Mock Song",
		artist: "Mock Artist",
		thumbnailUrl: "mock-thumb.jpg",
		durationMs: 200_000,
	}),
	getPlayerData: vi.fn<MusicProvider["getPlayerData"]>().mockReturnValue({
		type: "youtube",
		embedUrl: "https://youtube.com/embed/vid-1",
		providerId: "vid-1",
	}),
	validate: vi.fn<MusicProvider["validate"]>().mockResolvedValue(true),
};

vi.mock("../music/index", () => ({
	getMusicProvider: () => mockProvider,
}));

import {
	createAnonymousCaller,
	createGuestCaller,
	createOwnerCaller,
	createTestGuest,
	createTestSession,
	createTestSong,
	createTestUser,
	createTestVenue,
	resetDatabase,
	testPrisma,
} from "../../test/helpers";
import { channelManager } from "../sse/channel-manager";

describe("song router", () => {
	beforeEach(async () => {
		await resetDatabase();
		channelManager.reset();
		vi.clearAllMocks();
	});

	describe("search", () => {
		it("returns tracks from mocked provider", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);
			const caller = createGuestCaller(guest.id, session.id);

			const result = await caller.song.search({
				sessionId: session.id,
				query: "test song",
			});

			expect(result.tracks).toHaveLength(1);
			expect(result.tracks[0].title).toBe("Mock Song");
		});

		it("rejects anonymous caller with UNAUTHORIZED", async () => {
			const caller = createAnonymousCaller();
			await expect(
				caller.song.search({ sessionId: "any", query: "test" }),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		});

		it("rejects cross-session guest with FORBIDDEN", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const otherSession = await createTestSession(venue.id, {
				isActive: false,
			});
			const guest = await createTestGuest(otherSession.id);
			const caller = createGuestCaller(guest.id, otherSession.id);

			await expect(
				caller.song.search({ sessionId: session.id, query: "test" }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});
	});

	describe("suggest", () => {
		it("creates song with auto-upvote and broadcasts", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);
			const caller = createGuestCaller(guest.id, session.id);

			const events: string[] = [];
			channelManager.subscribe(session.id, {
				write: (data) => events.push(data),
				close: () => {},
			});

			const song = await caller.song.suggest({ providerId: "vid-1" });

			expect(song.score).toBe(1);
			expect(song.suggestedById).toBe(guest.id);

			// Verify auto-upvote
			const vote = await testPrisma.vote.findUnique({
				where: { songId_guestId: { songId: song.id, guestId: guest.id } },
			});
			expect(vote).not.toBeNull();
			expect(vote!.value).toBe(1);

			// Verify broadcast
			expect(events.some((e) => e.includes("song_added"))).toBe(true);
		});

		it("rejects duplicate providerId in active queue", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);
			await createTestSong(session.id, {
				providerId: "vid-dup",
				status: "queued",
			});
			const caller = createGuestCaller(guest.id, session.id);

			// Note: the duplicate check fires before getTrack is called,
			// so no mock override is needed here
			await expect(
				caller.song.suggest({ providerId: "vid-dup" }),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});

		it("rejects suggest within cooldown period", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);
			// Pre-create a song with recent addedAt (default is now())
			await createTestSong(session.id, {
				suggestedById: guest.id,
				providerId: "old-song",
			});

			const caller = createGuestCaller(guest.id, session.id);
			// Default cooldown is 30s, so immediate suggest should be rejected
			await expect(
				caller.song.suggest({ providerId: "new-song" }),
			).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
		});

		it("rejects when max suggestions reached", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);
			const caller = createGuestCaller(guest.id, session.id);

			// Create 5 songs (default max) for this guest
			for (let i = 0; i < 5; i++) {
				await createTestSong(session.id, {
					providerId: `existing-${i}`,
					suggestedById: guest.id,
				});
			}

			await expect(
				caller.song.suggest({ providerId: "one-more" }),
			).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
		});

		it("rejects anonymous caller with UNAUTHORIZED", async () => {
			const caller = createAnonymousCaller();
			await expect(
				caller.song.suggest({ providerId: "vid-1" }),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		});

		it("rejects owner caller with UNAUTHORIZED", async () => {
			const user = await createTestUser();
			const caller = createOwnerCaller(user.id);
			await expect(
				caller.song.suggest({ providerId: "vid-1" }),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		});
	});

	describe("add (owner)", () => {
		it("creates song with score 0 and broadcasts", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const caller = createOwnerCaller(user.id);

			const events: string[] = [];
			channelManager.subscribe(session.id, {
				write: (data) => events.push(data),
				close: () => {},
			});

			const song = await caller.song.add({
				sessionId: session.id,
				providerId: "vid-1",
			});

			expect(song.score).toBe(0);
			expect(song.suggestedById).toBeNull();
			expect(events.some((e) => e.includes("song_added"))).toBe(true);
		});
	});

	describe("remove (owner)", () => {
		it("deletes song and broadcasts song_removed", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const song = await createTestSong(session.id);
			const caller = createOwnerCaller(user.id);

			const events: string[] = [];
			channelManager.subscribe(session.id, {
				write: (data) => events.push(data),
				close: () => {},
			});

			await caller.song.remove({ songId: song.id });

			const deleted = await testPrisma.song.findUnique({
				where: { id: song.id },
			});
			expect(deleted).toBeNull();
			expect(events.some((e) => e.includes("song_removed"))).toBe(true);
		});
	});
});
