import prisma from "@crowd-vibe/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  router,
  protectedProcedure,
  guestProcedure,
  authenticatedProcedure,
} from "../index";
import { getMusicProvider } from "../music/index";
import { searchCache } from "../music/search-cache";
import { channelManager } from "../sse/channel-manager";
import { parseVenueSettings } from "../lib/settings";
import { advanceQueue } from "../lib/queue-helpers";
import { RateLimiter } from "../lib/rate-limiter";
import type { SearchResult } from "../music/types";

const searchRateLimiter = new RateLimiter(10, 60_000); // 10 per minute

export const songRouter = router({
  search: authenticatedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        query: z.string().min(1).max(200),
      })
    )
    .query(async ({ ctx, input }) => {
      // Validate session access
      if (ctx.type === "guest") {
        if (ctx.guestSessionId !== input.sessionId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Rate limit guests
        const rateKey = ctx.guestId;
        const { allowed } = searchRateLimiter.check(rateKey);
        if (!allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many searches. Try again in a moment.",
          });
        }
      }

      const session = await prisma.venueSession.findUnique({
        where: { id: input.sessionId },
        select: { musicProvider: true, venue: { select: { ownerId: true } } },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.type === "owner" && session.venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Check server-side cache
      const cacheKey = searchCache.makeKey(session.musicProvider, input.query);
      const cached = searchCache.get<SearchResult>(cacheKey);
      if (cached) return cached;

      // Fetch from provider
      const provider = getMusicProvider(session.musicProvider);
      try {
        const result = await provider.search(input.query);
        searchCache.set(cacheKey, result);
        return result;
      } catch {
        return { tracks: [], nextPageToken: undefined };
      }
    }),

  suggest: guestProcedure
    .input(z.object({ providerId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const sessionId = ctx.guestSessionId;

      const session = await prisma.venueSession.findUnique({
        where: { id: sessionId },
        select: { musicProvider: true, venue: { select: { settings: true } } },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      const settings = parseVenueSettings(session.venue.settings);

      // Check suggestion count
      const suggestionCount = await prisma.song.count({
        where: { sessionId, suggestedById: ctx.guestId },
      });
      if (suggestionCount >= settings.maxSuggestionsPerGuest) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `You've used all ${settings.maxSuggestionsPerGuest} song suggestions for this session.`,
        });
      }

      // Check cooldown
      const lastSuggestion = await prisma.song.findFirst({
        where: { sessionId, suggestedById: ctx.guestId },
        orderBy: { addedAt: "desc" },
        select: { addedAt: true },
      });
      if (lastSuggestion) {
        const elapsed = Date.now() - lastSuggestion.addedAt.getTime();
        if (elapsed < settings.suggestionCooldownSec * 1000) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Wait a few seconds before suggesting another song.",
          });
        }
      }

      // Check duplicate
      const existing = await prisma.song.findFirst({
        where: {
          sessionId,
          providerId: input.providerId,
          status: { in: ["queued", "playing"] },
        },
      });
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This song is already in the queue — vote for it instead!",
        });
      }

      // Fetch track metadata
      const provider = getMusicProvider(session.musicProvider);
      const track = await provider.getTrack(input.providerId);
      if (!track) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not find this song." });
      }

      // Get guest's display name for the broadcast
      const guest = await prisma.guestUser.findUnique({
        where: { id: ctx.guestId },
        select: { displayName: true },
      });

      // Create song + auto-upvote in transaction
      const song = await prisma.$transaction(async (tx) => {
        const created = await tx.song.create({
          data: {
            sessionId,
            providerId: track.providerId,
            provider: track.provider,
            title: track.title,
            artist: track.artist,
            thumbnailUrl: track.thumbnailUrl,
            durationMs: track.durationMs,
            suggestedById: ctx.guestId,
            score: 1, // auto-upvote
          },
        });

        await tx.vote.create({
          data: {
            songId: created.id,
            guestId: ctx.guestId,
            value: 1,
          },
        });

        return created;
      });

      channelManager.broadcast(sessionId, {
        type: "song_added",
        data: {
          song: {
            id: song.id,
            providerId: song.providerId,
            provider: song.provider,
            title: song.title,
            artist: song.artist,
            thumbnailUrl: song.thumbnailUrl,
            durationMs: song.durationMs,
            status: song.status,
            score: song.score,
            addedAt: song.addedAt.toISOString(),
            suggestedBy: guest ? { displayName: guest.displayName } : null,
          },
        },
      });

      return song;
    }),

  add: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        providerId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.venueSession.findUnique({
        where: { id: input.sessionId },
        select: { musicProvider: true, venue: { select: { ownerId: true } } },
      });
      if (!session || session.venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Check duplicate
      const existing = await prisma.song.findFirst({
        where: {
          sessionId: input.sessionId,
          providerId: input.providerId,
          status: { in: ["queued", "playing"] },
        },
      });
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This song is already in the queue.",
        });
      }

      const provider = getMusicProvider(session.musicProvider);
      const track = await provider.getTrack(input.providerId);
      if (!track) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not find this song." });
      }

      const song = await prisma.song.create({
        data: {
          sessionId: input.sessionId,
          providerId: track.providerId,
          provider: track.provider,
          title: track.title,
          artist: track.artist,
          thumbnailUrl: track.thumbnailUrl,
          durationMs: track.durationMs,
          score: 0,
        },
      });

      channelManager.broadcast(input.sessionId, {
        type: "song_added",
        data: {
          song: {
            id: song.id,
            providerId: song.providerId,
            provider: song.provider,
            title: song.title,
            artist: song.artist,
            thumbnailUrl: song.thumbnailUrl,
            durationMs: song.durationMs,
            status: song.status,
            score: song.score,
            addedAt: song.addedAt.toISOString(),
            suggestedBy: null,
          },
        },
      });

      return song;
    }),

  remove: protectedProcedure
    .input(z.object({ songId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const song = await prisma.song.findUnique({
        where: { id: input.songId },
        select: {
          sessionId: true,
          status: true,
          session: { select: { venue: { select: { ownerId: true } }, musicProvider: true } },
        },
      });
      if (!song || song.session.venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const wasPlaying = song.status === "playing";

      await prisma.song.delete({ where: { id: input.songId } });

      channelManager.broadcast(song.sessionId, {
        type: "song_removed",
        data: { songId: input.songId },
      });

      // If we removed the playing song, advance to next
      if (wasPlaying) {
        await advanceQueue(song.sessionId, song.session.musicProvider, "skipped");
      }

      return { success: true };
    }),
});
