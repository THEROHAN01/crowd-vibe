# AUDIT-001: schema.prisma missing `url = env("DATABASE_URL")` — Integration tests cannot run

**Severity:** P0 — BLOCKER
**Source:** Test Infrastructure Spec, Section "Neon Adapter Strategy"
**File:** `packages/db/prisma/schema/schema.prisma`

---

## Problem

The Prisma schema's `datasource` block currently looks like this:

```prisma
datasource db {
  provider = "postgresql"
}
```

It is missing the `url` field:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

The Prisma CLI (`prisma db push`, `prisma generate`, `prisma migrate`) requires a `url` in the datasource block to know which database to connect to. Without it, every CLI command fails with a "No URL configured for datasource" error.

This directly breaks two things:

1. **`globalSetup.ts`** — runs `prisma db push --force-reset` before the integration test suite. This is the mechanism that syncs the Prisma schema to the test database. It fails immediately because the CLI has no URL.

2. **`test:db:reset` npm script** — runs `dotenv -e .env.test -- npx prisma db push --force-reset`. Same failure.

Because `globalSetup.ts` fails, **all 40 integration tests cannot run at all**. The test database never gets its tables created, so even if the setup error were somehow bypassed, every Prisma query would fail with "relation does not exist".

## Why it was missing

The production runtime uses the Neon serverless adapter, which receives the connection string programmatically via `new PrismaNeon({ connectionString: env.DATABASE_URL })`. The adapter overrides whatever `url` is in the schema at runtime. Because of this, the production app works fine without a `url` in the schema — the adapter handles it. But the CLI doesn't use the adapter; it reads the schema file directly.

The test infrastructure spec explicitly calls this out and requires the `url` field to be added. The spec notes: "The Prisma CLI (`prisma db push`, `prisma generate`) requires a URL in the datasource — the Neon adapter overrides it at runtime, so this is safe in production."

## Fix

Add one line to `packages/db/prisma/schema/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

This is safe because:
- In production, the Neon adapter overrides the URL at runtime — the schema `url` is ignored
- In tests, the `url` resolves to the Docker test DB via `.env.test`
- In development, the `url` resolves to the Neon dev database via `.env`
- The Prisma CLI now works in all environments

## Impact

Without this fix, the entire integration test suite (40 tests across 6 routers) is non-functional. This is the single highest priority issue in the codebase.
