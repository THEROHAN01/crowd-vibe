import prisma from "@crowd-vibe/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { guestProcedure, router } from "../index";
import { advanceQueue } from "../lib/queue-helpers";
import { RateLimiter } from "../lib/rate-limiter";
import { parseVenueSettings } from "../lib/settings";
import { channelManager } from "../sse/channel-manager";

const voteRateLimiter = new RateLimiter(30, 60_000); // 30 votes per minute per guest

export const voteRouter = router({
	cast: guestProcedure
		.input(
			z.object({
				songId: z.string(),
				value: z.union([z.literal(1), z.literal(-1)]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { allowed } = voteRateLimiter.check(ctx.guestId);
			if (!allowed) {
				throw new TRPCError({
					code: "TOO_MANY_REQUESTS",
					message: "Slow down! Too many votes.",
				});
			}

			// Verify song belongs to guest's session
			const song = await prisma.song.findUnique({
				where: { id: input.songId },
				select: {
					sessionId: true,
					status: true,
					session: { select: { venue: { select: { settings: true } } } },
				},
			});
			if (!song || song.sessionId !== ctx.guestSessionId) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			if (song.status !== "queued" && song.status !== "playing") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot vote on this song.",
				});
			}

			const settings = parseVenueSettings(song.session.venue.settings);

			// Upsert vote + recalculate score in transaction
			const newScore = await prisma.$transaction(async (tx) => {
				const existing = await tx.vote.findUnique({
					where: {
						songId_guestId: { songId: input.songId, guestId: ctx.guestId },
					},
				});

				if (existing?.value === input.value) {
					// Toggle off — remove vote
					await tx.vote.delete({
						where: {
							songId_guestId: { songId: input.songId, guestId: ctx.guestId },
						},
					});
				} else if (existing) {
					// Change vote direction
					await tx.vote.update({
						where: {
							songId_guestId: { songId: input.songId, guestId: ctx.guestId },
						},
						data: { value: input.value },
					});
				} else {
					// New vote
					await tx.vote.create({
						data: {
							songId: input.songId,
							guestId: ctx.guestId,
							value: input.value,
						},
					});
				}

				// Recalculate score
				const result = await tx.vote.aggregate({
					where: { songId: input.songId },
					_sum: { value: true },
				});
				const score = result._sum.value ?? 0;

				await tx.song.update({
					where: { id: input.songId },
					data: { score },
				});

				return score;
			});

			channelManager.broadcast(song.sessionId, {
				type: "vote_changed",
				data: { songId: input.songId, score: newScore },
			});

			// Auto-skip if below threshold — re-read song status to avoid stale data
			if (newScore <= settings.downvoteSkipThreshold) {
				const currentSong = await prisma.song.findUnique({
					where: { id: input.songId },
					select: { status: true },
				});

				if (currentSong?.status === "queued") {
					await prisma.song.update({
						where: { id: input.songId },
						data: { status: "skipped" },
					});
					channelManager.broadcast(song.sessionId, {
						type: "song_removed",
						data: { songId: input.songId },
					});
				} else if (currentSong?.status === "playing") {
					const session = await prisma.venueSession.findUnique({
						where: { id: song.sessionId },
						select: { musicProvider: true },
					});
					if (session) {
						await advanceQueue(
							song.sessionId,
							session.musicProvider,
							"skipped",
						);
					}
				}
			}

			return { score: newScore };
		}),
});
