import { beforeEach, describe, expect, it } from "vitest";
import {
	createAnonymousCaller,
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

describe("session router", () => {
	beforeEach(async () => {
		await resetDatabase();
		channelManager.reset();
	});

	describe("start", () => {
		it("creates a session with a valid join code", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const caller = createOwnerCaller(user.id);

			const session = await caller.session.start({ venueId: venue.id });

			expect(session.joinCode).toHaveLength(6);
			expect(session.isActive).toBe(true);
			expect(session.venueId).toBe(venue.id);
		});

		it("rejects non-owner with NOT_FOUND", async () => {
			const owner = await createTestUser();
			const other = await createTestUser();
			const venue = await createTestVenue(owner.id);
			const caller = createOwnerCaller(other.id);

			await expect(
				caller.session.start({ venueId: venue.id }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("rejects starting a second active session", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const caller = createOwnerCaller(user.id);

			await caller.session.start({ venueId: venue.id });

			await expect(
				caller.session.start({ venueId: venue.id }),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});
	});

	describe("end", () => {
		it("deactivates session and broadcasts session_ended", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const caller = createOwnerCaller(user.id);

			const events: string[] = [];
			const writer = {
				write: (data: string) => events.push(data),
				close: () => {},
			};
			channelManager.subscribe(session.id, writer);

			await caller.session.end({ sessionId: session.id });

			// Verify DB state
			const updated = await testPrisma.venueSession.findUnique({
				where: { id: session.id },
			});
			expect(updated!.isActive).toBe(false);
			expect(updated!.endedAt).not.toBeNull();

			// Verify broadcast
			expect(events.some((e) => e.includes("session_ended"))).toBe(true);
		});
	});

	describe("getByJoinCode", () => {
		it("returns venue name and listener count", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id, { name: "Cool Bar" });
			const session = await createTestSession(venue.id);
			const caller = createAnonymousCaller();

			const result = await caller.session.getByJoinCode({
				joinCode: session.joinCode,
			});

			expect(result.venueName).toBe("Cool Bar");
			expect(result.listenerCount).toBe(0);
		});

		it("rejects invalid join code with NOT_FOUND", async () => {
			const caller = createAnonymousCaller();
			await expect(
				caller.session.getByJoinCode({ joinCode: "ZZZZZZ" }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});

	describe("getActive", () => {
		it("returns the active session for a venue", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			const caller = createAnonymousCaller();

			const result = await caller.session.getActive({ venueId: venue.id });

			expect(result).not.toBeNull();
			expect(result!.id).toBe(session.id);
		});

		it("returns null when no active session", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const caller = createAnonymousCaller();

			const result = await caller.session.getActive({ venueId: venue.id });
			expect(result).toBeNull();
		});
	});

	describe("stats", () => {
		it("returns correct counts", async () => {
			const user = await createTestUser();
			const venue = await createTestVenue(user.id);
			const session = await createTestSession(venue.id);
			await createTestGuest(session.id);
			await createTestGuest(session.id);
			await createTestSong(session.id, { status: "played" });
			await createTestSong(session.id, { status: "queued" });
			const caller = createOwnerCaller(user.id);

			const stats = await caller.session.stats({ sessionId: session.id });

			expect(stats.guestCount).toBe(2);
			expect(stats.totalSongs).toBe(2);
			expect(stats.songsPlayed).toBe(1);
		});

		it("rejects non-owner with NOT_FOUND", async () => {
			const owner = await createTestUser();
			const other = await createTestUser();
			const venue = await createTestVenue(owner.id);
			const session = await createTestSession(venue.id);
			const caller = createOwnerCaller(other.id);

			await expect(
				caller.session.stats({ sessionId: session.id }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});
});
