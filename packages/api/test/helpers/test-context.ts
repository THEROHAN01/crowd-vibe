import { t } from "../../src/index";
import { appRouter } from "../../src/routers/index";

const createCaller = t.createCallerFactory(appRouter);

export function createOwnerCaller(userId?: string) {
  return createCaller({
    type: "owner" as const,
    user: {
      id: userId ?? crypto.randomUUID(),
      name: "Test Owner",
      email: "owner@test.com",
    },
  });
}

export function createGuestCaller(guestId: string, sessionId: string) {
  return createCaller({
    type: "guest" as const,
    guestId,
    guestSessionId: sessionId,
  });
}

export function createAnonymousCaller() {
  return createCaller({ type: "anonymous" as const });
}
