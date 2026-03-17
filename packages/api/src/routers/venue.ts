import prisma from "@crowd-vibe/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../index";

export const venueRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await prisma.venue.create({
          data: {
            name: input.name,
            slug: input.slug,
            description: input.description,
            ownerId: ctx.user.id,
          },
        });
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This slug is already taken." });
        }
        throw err;
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const venue = await prisma.venue.findUnique({ where: { id: input.id } });
      if (!venue || venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
      }
      return prisma.venue.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
        },
      });
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return prisma.venue.findUnique({
        where: { slug: input.slug },
        select: { id: true, name: true, slug: true, description: true, logoUrl: true },
      });
    }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    return prisma.venue.findMany({
      where: { ownerId: ctx.user.id },
      include: {
        sessions: {
          where: { isActive: true },
          select: { id: true, joinCode: true, name: true, startedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),
});
