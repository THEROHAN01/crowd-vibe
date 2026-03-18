import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicProvider } from "../music/types";

const mockProvider: MusicProvider = {
	search: vi.fn().mockResolvedValue({ tracks: [] }),
	getTrack: vi.fn().mockResolvedValue(null),
	getPlayerData: vi.fn().mockReturnValue({
		type: "youtube" as const,
		embedUrl: "https://youtube.com/embed/test",
		providerId: "test",
	}),
	validate: vi.fn().mockResolvedValue(true),
};

vi.mock("../music/index", () => ({
	getMusicProvider: () => mockProvider,
}));

import {
	createAnonymousCaller,
	createGuestCaller,
	createTestGuest,
	createTestSession,
	createTestSong,
	createTestUser,
	createTestVenue,
	resetDatabase,
	testPrisma,
} from "../../test/helpers";
import { channelManager } from "../sse/channel-manager";

describe("vote router", () => {
	beforeEach(async () => {
		await resetDatabase();
		channelManager.reset();
	});

	describe("cast", () => {
		it("upvote increments song score", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);
			const song = await createTestSong(session.id);
			const caller = createGuestCaller(guest.id, session.id);

			const result = await caller.vote.cast({ songId: song.id, value: 1 });

			expect(result.score).toBe(1);

			const dbSong = await testPrisma.song.findUnique({
				where: { id: song.id },
			});
			expect(dbSong!.score).toBe(1);
		});

		it("toggle same value removes vote and decrements score", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);
			const song = await createTestSong(session.id);
			const caller = createGuestCaller(guest.id, session.id);

			await caller.vote.cast({ songId: song.id, value: 1 });
			const result = await caller.vote.cast({ songId: song.id, value: 1 });

			expect(result.score).toBe(0);
		});

		it("changing vote direction updates score correctly", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);
			const song = await createTestSong(session.id);
			const caller = createGuestCaller(guest.id, session.id);

			await caller.vote.cast({ songId: song.id, value: 1 });
			const result = await caller.vote.cast({ songId: song.id, value: -1 });

			expect(result.score).toBe(-1);
		});

		it("broadcasts vote_changed", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);
			const song = await createTestSong(session.id);
			const caller = createGuestCaller(guest.id, session.id);

			const events: string[] = [];
			channelManager.subscribe(session.id, {
				write: (data) => events.push(data),
				close: () => {},
			});

			await caller.vote.cast({ songId: song.id, value: 1 });

			expect(events.some((e) => e.includes("vote_changed"))).toBe(true);
		});

		it("downvote below threshold auto-skips queued song", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id, {
				settings: { downvoteSkipThreshold: -2 },
			});
			const session = await createTestSession(venue.id);
			const song = await createTestSong(session.id);

			// Create 2 guests who both downvote — score hits -2 (threshold) on 2nd vote
			const guest1 = await createTestGuest(session.id);
			const guest2 = await createTestGuest(session.id);

			await createGuestCaller(guest1.id, session.id).vote.cast({
				songId: song.id,
				value: -1,
			});
			await createGuestCaller(guest2.id, session.id).vote.cast({
				songId: song.id,
				value: -1,
			});

			const dbSong = await testPrisma.song.findUnique({
				where: { id: song.id },
			});
			expect(dbSong!.status).toBe("skipped");
		});

		it("rejects anonymous caller with UNAUTHORIZED", async () => {
			const caller = createAnonymousCaller();
			await expect(
				caller.vote.cast({ songId: "any", value: 1 }),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		});

		it("rejects vote on song from different session", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session1 = await createTestSession(venue.id);
			const session2 = await createTestSession(venue.id, { isActive: false });
			const guest = await createTestGuest(session1.id);
			const song = await createTestSong(session2.id);
			const caller = createGuestCaller(guest.id, session1.id);

			await expect(
				caller.vote.cast({ songId: song.id, value: 1 }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});
	});
});
