import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDatabase,
  createGuestCaller,
  createAnonymousCaller,
  createTestUser,
  createTestVenue,
  createTestSession,
  createTestGuest,
  createTestSong,
  testPrisma,
} from "../../test/helpers";

describe("guest router", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe("me", () => {
    it("returns guest record with votes and suggestion count", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id, { displayName: "DJ Fan" });
      const song = await createTestSong(session.id, { suggestedById: guest.id });

      // Create a vote
      await testPrisma.vote.create({
        data: { songId: song.id, guestId: guest.id, value: 1 },
      });

      const caller = createGuestCaller(guest.id, session.id);
      const me = await caller.guest.me();

      expect(me).not.toBeNull();
      expect(me!.displayName).toBe("DJ Fan");
      expect(me!.votes).toHaveLength(1);
      expect(me!._count.suggestions).toBe(1);
    });

    it("rejects anonymous caller with UNAUTHORIZED", async () => {
      const caller = createAnonymousCaller();
      await expect(caller.guest.me()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });
});
