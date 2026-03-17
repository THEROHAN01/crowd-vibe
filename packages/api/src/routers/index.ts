import { router } from "../index";
import { venueRouter } from "./venue";
import { sessionRouter } from "./session";
import { guestRouter } from "./guest";
import { queueRouter } from "./queue";
import { songRouter } from "./song";
import { voteRouter } from "./vote";

export const appRouter = router({
  venue: venueRouter,
  session: sessionRouter,
  guest: guestRouter,
  queue: queueRouter,
  song: songRouter,
  vote: voteRouter,
});

export type AppRouter = typeof appRouter;
