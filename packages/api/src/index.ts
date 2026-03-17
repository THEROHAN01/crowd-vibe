import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.type !== "owner") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return next({
    ctx: { ...ctx, type: "owner" as const, user: ctx.user },
  });
});

export const guestProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.type !== "guest") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Guest session required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      type: "guest" as const,
      guestId: ctx.guestId,
      guestSessionId: ctx.guestSessionId,
    },
  });
});

export const authenticatedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.type === "anonymous") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return next({ ctx });
});
