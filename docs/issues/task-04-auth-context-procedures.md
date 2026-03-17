# Task 4: Auth Context & Procedure Types — Code Review

**Date:** 2026-03-17
**Commit:** `645b32c`
**Files changed:** `packages/api/src/context.ts` (rewritten), `packages/api/src/index.ts` (rewritten)

---

## Issues

No issues found.

---

## Verification

- `context.ts`: Discriminated union `Context` type with `"owner" | "guest" | "anonymous"`. Tries Better-Auth first, falls back to HMAC guest cookie, defaults to anonymous. Correct priority order.
- Guest cookie verification: Uses `verifySignedCookie` with `env.BETTER_AUTH_SECRET`. Looks up `guestUser` by ID, returns `sessionId` for scope validation. Correct.
- `index.ts`: Four procedure types:
  - `publicProcedure` — no auth check (correct)
  - `protectedProcedure` — requires `type === "owner"`, narrows context (correct)
  - `guestProcedure` — requires `type === "guest"`, narrows context (correct)
  - `authenticatedProcedure` — requires `type !== "anonymous"`, passes context through without narrowing (correct for routes accessible by both owners and guests)
- TypeScript narrowing in middleware: `protectedProcedure` spreads `...ctx` then overrides `type` and `user` for narrowing. Technically redundant spread since ctx already has those fields, but it satisfies TypeScript's type narrowing. Standard tRPC pattern.

**Verdict:** Clean commit. Correct implementation of the discriminated union auth pattern.
