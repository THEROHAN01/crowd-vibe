import prisma from "@crowd-vibe/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../index";
import { generateJoinCode } from "../lib/join-code";
import { channelManager } from "../sse/channel-manager";

export const sessionRouter = router({
	start: protectedProcedure
		.input(
			z.object({
				venueId: z.string(),
				name: z.string().max(100).optional(),
				musicProvider: z.enum(["youtube", "spotify"]).default("youtube"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const venue = await prisma.venue.findUnique({
				where: { id: input.venueId },
			});
			if (!venue || venue.ownerId !== ctx.user.id) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
			}

			// Prevent multiple active sessions for the same venue
			const existing = await prisma.venueSession.findFirst({
				where: { venueId: input.venueId, isActive: true },
			});
			if (existing) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"This venue already has an active session. End it before starting a new one.",
				});
			}

			// Generate unique join code with collision retry
			let joinCode = generateJoinCode();
			for (let attempts = 0; attempts < 10; attempts++) {
				const taken = await prisma.venueSession.findUnique({
					where: { joinCode },
				});
				if (!taken) break;
				joinCode = generateJoinCode();
				if (attempts === 9) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Could not generate a unique join code. Please try again.",
					});
				}
			}

			return prisma.venueSession.create({
				data: {
					venueId: input.venueId,
					name: input.name,
					musicProvider: input.musicProvider,
					joinCode,
				},
			});
		}),

	end: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const session = await prisma.venueSession.findUnique({
				where: { id: input.sessionId },
				include: { venue: { select: { ownerId: true } } },
			});
			if (!session || session.venue.ownerId !== ctx.user.id) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			await prisma.venueSession.update({
				where: { id: input.sessionId },
				data: { isActive: false, endedAt: new Date() },
			});

			channelManager.broadcast(input.sessionId, {
				type: "session_ended",
				data: {},
			});

			return { success: true };
		}),

	getByJoinCode: publicProcedure
		.input(z.object({ joinCode: z.string() }))
		.query(async ({ input }) => {
			const session = await prisma.venueSession.findUnique({
				where: { joinCode: input.joinCode },
				select: {
					id: true,
					isActive: true,
					name: true,
					venue: { select: { name: true } },
				},
			});

			if (!session || !session.isActive) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No active session found for this code.",
				});
			}

			return {
				venueName: session.venue.name,
				sessionName: session.name,
				listenerCount: channelManager.getListenerCount(session.id),
			};
		}),

	getActive: publicProcedure
		.input(z.object({ venueId: z.string() }))
		.query(async ({ input }) => {
			return prisma.venueSession.findFirst({
				where: { venueId: input.venueId, isActive: true },
				select: {
					id: true,
					joinCode: true,
					name: true,
					startedAt: true,
					musicProvider: true,
				},
			});
		}),

	stats: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const session = await prisma.venueSession.findUnique({
				where: { id: input.sessionId },
				include: {
					venue: { select: { ownerId: true } },
					_count: { select: { guests: true, songs: true } },
				},
			});
			if (!session || session.venue.ownerId !== ctx.user.id) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const songsPlayed = await prisma.song.count({
				where: { sessionId: input.sessionId, status: "played" },
			});

			return {
				listenerCount: channelManager.getListenerCount(input.sessionId),
				guestCount: session._count.guests,
				totalSongs: session._count.songs,
				songsPlayed,
			};
		}),
});
