import prisma from "@crowd-vibe/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authenticatedProcedure, protectedProcedure, router } from "../index";
import { advanceQueue } from "../lib/queue-helpers";

export const queueRouter = router({
	list: authenticatedProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Validate access
			if (ctx.type === "guest" && ctx.guestSessionId !== input.sessionId) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			if (ctx.type === "owner") {
				const session = await prisma.venueSession.findUnique({
					where: { id: input.sessionId },
					select: { venue: { select: { ownerId: true } } },
				});
				if (!session || session.venue.ownerId !== ctx.user.id) {
					throw new TRPCError({ code: "FORBIDDEN" });
				}
			}

			return prisma.song.findMany({
				where: { sessionId: input.sessionId, status: "queued" },
				orderBy: [{ score: "desc" }, { addedAt: "asc" }],
				select: {
					id: true,
					providerId: true,
					provider: true,
					title: true,
					artist: true,
					thumbnailUrl: true,
					durationMs: true,
					status: true,
					score: true,
					addedAt: true,
					suggestedBy: { select: { displayName: true } },
				},
			});
		}),

	nowPlaying: authenticatedProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ ctx, input }) => {
			if (ctx.type === "guest" && ctx.guestSessionId !== input.sessionId) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			if (ctx.type === "owner") {
				const session = await prisma.venueSession.findUnique({
					where: { id: input.sessionId },
					select: { venue: { select: { ownerId: true } } },
				});
				if (!session || session.venue.ownerId !== ctx.user.id) {
					throw new TRPCError({ code: "FORBIDDEN" });
				}
			}

			return prisma.song.findFirst({
				where: { sessionId: input.sessionId, status: "playing" },
				select: {
					id: true,
					providerId: true,
					provider: true,
					title: true,
					artist: true,
					thumbnailUrl: true,
					durationMs: true,
					score: true,
				},
			});
		}),

	next: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const session = await prisma.venueSession.findUnique({
				where: { id: input.sessionId },
				select: {
					isActive: true,
					venue: { select: { ownerId: true } },
					musicProvider: true,
				},
			});
			if (!session || session.venue.ownerId !== ctx.user.id) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			if (!session.isActive) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Session has ended.",
				});
			}

			return advanceQueue(input.sessionId, session.musicProvider, "played");
		}),

	skip: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const session = await prisma.venueSession.findUnique({
				where: { id: input.sessionId },
				select: {
					isActive: true,
					venue: { select: { ownerId: true } },
					musicProvider: true,
				},
			});
			if (!session || session.venue.ownerId !== ctx.user.id) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			if (!session.isActive) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Session has ended.",
				});
			}

			return advanceQueue(input.sessionId, session.musicProvider, "skipped");
		}),
});
