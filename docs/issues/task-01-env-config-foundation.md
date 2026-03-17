# Task 1: Environment & Config Foundation — Code Review

**Date:** 2026-03-17
**Commit:** Not yet committed (working tree changes)
**Files changed:** `packages/env/src/server.ts`, `packages/auth/src/lib/payments.ts`, `packages/auth/src/index.ts`, `packages/api/package.json`, `apps/web/tsconfig.json`

---

## Issues

### ISSUE-01: `tsconfig.json` — `jsx` changed from `"preserve"` to `"react-jsx"` (not in plan)

**File:** `apps/web/tsconfig.json:20`
**Severity:** MEDIUM
**Description:** The plan does not mention modifying `tsconfig.json` at all, but this commit changes `"jsx": "preserve"` to `"jsx": "react-jsx"` and adds extra `include` paths (`.next/types/**/*.ts`, `.next/dev/types/**/*.ts`). Next.js expects `"jsx": "preserve"` — it handles JSX transformation itself via SWC. Changing to `"react-jsx"` can cause issues with Next.js's built-in compiler and may break React Server Components or the `next` TypeScript plugin.

**Recommendation:** Revert `"jsx"` back to `"preserve"`. The additional `include` paths for `.next/types` and `.next/dev/types` are fine (Next.js 16 generates types there), but the `jsx` change is risky.

---

### ISSUE-02: `tsconfig.json` change is unrelated to Task 1

**File:** `apps/web/tsconfig.json`
**Severity:** LOW
**Description:** The `tsconfig.json` modifications (formatting changes, new include paths, jsx change) are not part of Task 1's scope. Task 1 only touches env, auth, and API package.json. Unrelated changes should not be bundled into this commit — they make the commit harder to revert and review.

**Recommendation:** Either commit `tsconfig.json` changes separately with their own message, or revert if they were unintentional.

---

### ISSUE-03: Plan Step 5 — `.env` update should not be committed

**File:** `apps/web/.env`
**Severity:** INFO
**Description:** The plan's Step 5 says to add `YOUTUBE_API_KEY=your-youtube-api-key-here` to `apps/web/.env`. This file IS gitignored (confirmed), so it won't be committed. This is correct behavior. Noting for completeness — the plan's Step 7 commit command includes `apps/web/.env` in `git add`, which would fail silently since it's gitignored. Not a code issue, but a plan inaccuracy.

---

### ISSUE-04: No type guard on `polarClient` in auth plugin registration

**File:** `packages/auth/src/index.ts:12`
**Severity:** INFO (matches plan exactly)
**Description:** The `if (polarClient && env.POLAR_SUCCESS_URL)` check works correctly. TypeScript narrows `polarClient` from `Polar | null` to `Polar` inside the block. The `env.POLAR_SUCCESS_URL` is typed as `string | undefined` due to `.optional()`, so the truthiness check is appropriate. Implementation matches plan. No issue.

---

## Summary

| ID | Severity | Status |
|----|----------|--------|
| ISSUE-01 | MEDIUM | `jsx: "react-jsx"` — revert to `"preserve"` |
| ISSUE-02 | LOW | Unrelated tsconfig changes bundled in Task 1 |
| ISSUE-03 | INFO | `.env` gitignored correctly; plan commit cmd references it |
| ISSUE-04 | INFO | No issue — noting correctness |

**Overall:** The core Task 1 changes (env, auth, payments, package.json) are implemented correctly and match the plan. The only real concern is the `tsconfig.json` `jsx` change which was not planned and may cause Next.js issues.
