# Task 7: Guest Join Route Handler — Code Review

**Date:** 2026-03-17
**Commit:** `1193984`
**Files created:** `apps/web/src/app/api/guest/join/route.ts`

---

## Issues

### ISSUE-01: Request body is not validated with Zod — relies on type assertion

**File:** `apps/web/src/app/api/guest/join/route.ts:21`
**Severity:** MEDIUM
**Description:** The request body is parsed as:
```typescript
const body = await req.json();
const { joinCode, fingerprint, displayName } = body as {
  joinCode: string;
  fingerprint: string;
  displayName?: string;
};
```

The `as` type assertion provides no runtime validation. If a client sends `{ joinCode: 123, fingerprint: null }`, the code proceeds with non-string values. The manual check on line 27 (`if (!joinCode || !fingerprint)`) catches falsy values but not type mismatches — e.g., `joinCode: 123` would pass the truthiness check but `prisma.venueSession.findUnique({ where: { joinCode: 123 } })` would fail with a Prisma type error.

This is a system boundary (external HTTP input) where validation matters.

**Recommendation:** Use Zod:
```typescript
const schema = z.object({
  joinCode: z.string().min(1),
  fingerprint: z.string().min(1),
  displayName: z.string().max(50).optional(),
});
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
```

---

### ISSUE-02: `req.json()` can throw on malformed JSON with no try/catch

**File:** `apps/web/src/app/api/guest/join/route.ts:20`
**Severity:** MEDIUM
**Description:** If the client sends a non-JSON body (e.g., `Content-Type: text/plain` or malformed JSON), `req.json()` throws an unhandled error. This results in a 500 instead of a 400.

**Recommendation:** Wrap in try/catch:
```typescript
let body;
try {
  body = await req.json();
} catch {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}
```

---

### ISSUE-03: `displayName` is not sanitized or length-limited

**File:** `apps/web/src/app/api/guest/join/route.ts:63`
**Severity:** LOW
**Description:** The `displayName` field is passed directly to Prisma with no length limit. A malicious client could send a megabyte-long display name. The database `String` type in Prisma/PostgreSQL defaults to `text` (unlimited length).

**Recommendation:** Add `z.string().max(50)` validation (or similar reasonable limit) as part of the Zod schema recommended in ISSUE-01.

---

### ISSUE-04: `secure` flag uses `process.env.NODE_ENV` directly instead of validated `env.NODE_ENV`

**File:** `apps/web/src/app/api/guest/join/route.ts:84`
**Severity:** LOW
**Description:** The cookie `secure` flag checks `process.env.NODE_ENV === "production"` directly, while the rest of the codebase uses the validated `env` from `@crowd-vibe/env/server`. This is functionally equivalent but inconsistent. The validated env is already imported on line 2.

**Recommendation:** Use `env.NODE_ENV === "production"` for consistency.

---

## Verification

- Rate limiting: 3 per minute per IP via `x-forwarded-for`. Module-level singleton (persists across requests). Correct.
- Session lookup: `findUnique` by `joinCode`, checks `isActive`. Correct.
- Guest upsert: Uses `sessionId_fingerprint` compound unique. `create` sets displayName, `update` only updates if provided. Correct.
- HMAC cookie: `signCookie(guest.id, env.BETTER_AUTH_SECRET)`. `sameSite: "lax"`, `httpOnly: true`, 24h expiry. Matches spec.
- Response: Returns `sessionId`, `venueName`, `displayName`. Matches what `useGuest` hook expects.

**Verdict:** Functional implementation but missing input validation at the system boundary. The Zod + try/catch issues should be fixed — this is a public endpoint reachable by any HTTP client.
