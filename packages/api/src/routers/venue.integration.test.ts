import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDatabase,
  createOwnerCaller,
  createGuestCaller,
  createAnonymousCaller,
  createTestUser,
  createTestVenue,
} from "../../test/helpers";

describe("venue router", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe("create", () => {
    it("creates a venue for the owner", async () => {
      const user = await createTestUser();
      const caller = createOwnerCaller(user.id);

      const venue = await caller.venue.create({
        name: "My Bar",
        slug: "my-bar",
        description: "A cool place",
      });

      expect(venue.name).toBe("My Bar");
      expect(venue.slug).toBe("my-bar");
      expect(venue.ownerId).toBe(user.id);
    });

    it("rejects duplicate slug with BAD_REQUEST", async () => {
      const user = await createTestUser();
      const caller = createOwnerCaller(user.id);

      await caller.venue.create({ name: "First", slug: "taken-slug" });

      await expect(
        caller.venue.create({ name: "Second", slug: "taken-slug" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects anonymous caller with UNAUTHORIZED", async () => {
      const caller = createAnonymousCaller();
      await expect(
        caller.venue.create({ name: "Test", slug: "test" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects guest caller with UNAUTHORIZED", async () => {
      const caller = createGuestCaller("guest-1", "session-1");
      await expect(
        caller.venue.create({ name: "Test", slug: "test" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("update", () => {
    it("updates own venue", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const caller = createOwnerCaller(user.id);

      const updated = await caller.venue.update({
        id: venue.id,
        name: "New Name",
      });

      expect(updated.name).toBe("New Name");
    });

    it("rejects updating another owner's venue with NOT_FOUND", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const venue = await createTestVenue(owner.id);
      const caller = createOwnerCaller(other.id);

      await expect(
        caller.venue.update({ id: venue.id, name: "Hijacked" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("getBySlug", () => {
    it("returns venue data for existing slug", async () => {
      const user = await createTestUser();
      await createTestVenue(user.id, { slug: "cool-bar" });
      const caller = createAnonymousCaller();

      const venue = await caller.venue.getBySlug({ slug: "cool-bar" });

      expect(venue).not.toBeNull();
      expect(venue!.slug).toBe("cool-bar");
    });

    it("returns null for non-existent slug", async () => {
      const caller = createAnonymousCaller();
      const venue = await caller.venue.getBySlug({ slug: "no-such-venue" });
      expect(venue).toBeNull();
    });
  });

  describe("listMine", () => {
    it("returns only venues owned by the caller", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      await createTestVenue(owner.id, { name: "Mine" });
      await createTestVenue(other.id, { name: "Theirs" });

      const caller = createOwnerCaller(owner.id);
      const venues = await caller.venue.listMine();

      expect(venues).toHaveLength(1);
      expect(venues[0].name).toBe("Mine");
    });
  });
});
