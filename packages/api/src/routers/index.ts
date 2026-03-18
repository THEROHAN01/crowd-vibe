import { router } from "../index";
import { guestRouter } from "./guest";
import { queueRouter } from "./queue";
import { sessionRouter } from "./session";
import { songRouter } from "./song";
import { venueRouter } from "./venue";
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
