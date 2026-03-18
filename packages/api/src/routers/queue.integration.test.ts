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

describe("queue router", () => {
	beforeEach(async () => {
		await resetDatabase();
		channelManager.reset();
	});

	describe("list", () => {
		it("returns songs ordered by score desc, addedAt asc", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);

			await createTestSong(session.id, { title: "Low Score", score: 1 });
			await createTestSong(session.id, { title: "High Score", score: 10 });
			await createTestSong(session.id, { title: "Mid Score", score: 5 });

			const caller = createGuestCaller(guest.id, session.id);
			const songs = await caller.queue.list({ sessionId: session.id });

			expect(songs[0].title).toBe("High Score");
			expect(songs[1].title).toBe("Mid Score");
			expect(songs[2].title).toBe("Low Score");
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
				caller.queue.list({ sessionId: session.id }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});

		it("rejects anonymous caller with UNAUTHORIZED", async () => {
			const caller = createAnonymousCaller();
			await expect(
				caller.queue.list({ sessionId: "any" }),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		});
	});

	describe("nowPlaying", () => {
		it("returns the currently playing song", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);
			await createTestSong(session.id, {
				title: "Now Playing",
				status: "playing",
			});

			const caller = createGuestCaller(guest.id, session.id);
			const playing = await caller.queue.nowPlaying({ sessionId: session.id });

			expect(playing).not.toBeNull();
			expect(playing!.title).toBe("Now Playing");
		});

		it("returns null when nothing is playing", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const guest = await createTestGuest(session.id);

			const caller = createGuestCaller(guest.id, session.id);
			const playing = await caller.queue.nowPlaying({ sessionId: session.id });

			expect(playing).toBeNull();
		});
	});

	describe("next", () => {
		it("advances to highest-scored queued song", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);

			await createTestSong(session.id, { title: "Low", score: 1 });
			await createTestSong(session.id, { title: "High", score: 10 });

			const caller = createOwnerCaller(user.id);
			const result = await caller.queue.next({ sessionId: session.id });

			expect(result.song).not.toBeNull();
			expect(result.song!.title).toBe("High");
			// advanceQueue returns the song fetched before the status update in the transaction,
			// so verify the DB state directly
			const dbSong = await testPrisma.song.findUnique({
				where: { id: result.song!.id },
			});
			expect(dbSong!.status).toBe("playing");
		});

		it("returns null song when queue is empty", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const caller = createOwnerCaller(user.id);

			const events: string[] = [];
			channelManager.subscribe(session.id, {
				write: (data) => events.push(data),
				close: () => {},
			});

			const result = await caller.queue.next({ sessionId: session.id });

			expect(result.song).toBeNull();
			expect(events.some((e) => e.includes('"song":null'))).toBe(true);
		});
	});

	describe("skip", () => {
		it("marks current song as skipped and advances", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);

			const playing = await createTestSong(session.id, {
				title: "Playing",
				status: "playing",
			});
			await createTestSong(session.id, { title: "Next Up", score: 5 });

			const caller = createOwnerCaller(user.id);
			const result = await caller.queue.skip({ sessionId: session.id });

			expect(result.song).not.toBeNull();
			expect(result.song!.title).toBe("Next Up");

			const skipped = await testPrisma.song.findUnique({
				where: { id: playing.id },
			});
			expect(skipped!.status).toBe("skipped");
		});
	});
});
