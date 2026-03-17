import prisma from "@crowd-vibe/db";
import { router, guestProcedure } from "../index";

export const guestRouter = router({
  me: guestProcedure.query(async ({ ctx }) => {
    const guest = await prisma.guestUser.findUnique({
      where: { id: ctx.guestId },
      select: {
        id: true,
        displayName: true,
        sessionId: true,
        votes: {
          where: { song: { status: { in: ["queued", "playing"] } } },
          select: { songId: true, value: true },
        },
        _count: { select: { suggestions: true } },
      },
    });
    return guest;
  }),
});
