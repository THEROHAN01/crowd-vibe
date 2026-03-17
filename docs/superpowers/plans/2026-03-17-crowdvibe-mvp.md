# CrowdVibe MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a crowd-controlled music voting system where venue customers join via QR code and collectively shape the playlist through voting — validating the hypothesis that people interact with crowd-voting for music in physical venues.

**Architecture:** Single Next.js 16 monorepo with tRPC 11 for type-safe APIs, SSE for real-time updates, Prisma 7 + Neon PostgreSQL for persistence, YouTube Data API v3 for music search/playback, and a pluggable music provider abstraction for future Spotify support. Two auth flows: Better-Auth for venue owners, HMAC-signed cookies for frictionless guest access.

**Tech Stack:** Next.js 16, React 19, tRPC 11, Prisma 7, Better-Auth, YouTube Data API v3, SSE, FingerprintJS, shadcn/ui, TailwindCSS 4, qrcode.react

**Spec:** `docs/superpowers/specs/2026-03-17-crowdvibe-mvp-design.md`

---

## File Map

### Files to CREATE

```
packages/db/prisma/schema/domain.prisma          — Venue, VenueSession, GuestUser, Song, Vote models
packages/api/src/lib/cookie.ts                    — HMAC cookie signing/verification utilities
packages/api/src/lib/rate-limiter.ts              — In-memory rate limiter (Map-based with TTL)
packages/api/src/lib/join-code.ts                 — Join code generation (6-char alphanumeric)
packages/api/src/lib/settings.ts                  — VenueSettings Zod schema with defaults
packages/api/src/music/types.ts                   — MusicTrack, SearchResult, PlayerData, MusicProvider interface
packages/api/src/music/providers/youtube.ts       — YouTube Data API v3 implementation
packages/api/src/music/providers/spotify.ts       — Spotify provider stub
packages/api/src/music/search-cache.ts            — Server-side search result cache (in-memory, 15min TTL)
packages/api/src/music/index.ts                   — getMusicProvider() factory
packages/api/src/sse/types.ts                     — SSEEvent type union
packages/api/src/sse/channel-manager.ts           — SSEChannelManager class + globalThis singleton
packages/api/src/routers/venue.ts                 — venue.create, update, getBySlug, listMine
packages/api/src/routers/session.ts               — session.start, end, getByJoinCode, getActive, stats
packages/api/src/routers/guest.ts                 — guest.me
packages/api/src/routers/queue.ts                 — queue.list, nowPlaying, next, skip
packages/api/src/routers/song.ts                  — song.search, suggest, add, remove
packages/api/src/routers/vote.ts                  — vote.cast
apps/web/src/app/api/guest/join/route.ts          — POST handler for guest join (sets HMAC cookie)
apps/web/src/app/api/sse/[sessionId]/route.ts     — SSE streaming endpoint
apps/web/src/app/(venue)/layout.tsx               — Auth-gated layout for venue owner pages
apps/web/src/app/(venue)/dashboard/page.tsx       — Venue owner dashboard (replaces existing)
apps/web/src/app/(venue)/dashboard/dashboard.tsx  — Dashboard client component
apps/web/src/app/join/[joinCode]/page.tsx         — Guest join page
apps/web/src/app/session/[id]/page.tsx            — Guest session view (wrapper)
apps/web/src/app/session/[id]/session-view.tsx    — Guest session client component
apps/web/src/components/venue/create-venue-form.tsx — Venue creation form
apps/web/src/components/venue/start-session-form.tsx — Start session dialog
apps/web/src/components/venue/session-dashboard.tsx — Live session dashboard
apps/web/src/components/venue/queue-manager.tsx   — Owner's queue view with remove buttons
apps/web/src/components/venue/qr-display.tsx      — QR code display/download component
apps/web/src/components/player/youtube-player.tsx — YouTube IFrame embed player
apps/web/src/components/session/now-playing.tsx    — Now playing display card (guest view)
apps/web/src/components/session/song-queue.tsx     — Scrollable queue with voting buttons
apps/web/src/components/session/song-search.tsx    — Search bottom sheet for song suggestions
apps/web/src/components/session/vote-button.tsx    — Upvote/downvote toggle button
apps/web/src/hooks/use-session-events.ts          — SSE EventSource hook
apps/web/src/hooks/use-guest.ts                   — Guest identity hook (fingerprint + join)
```

### Files to MODIFY

```
packages/db/prisma/schema/auth.prisma             — Add `venues Venue[]` back-relation on User model
packages/env/src/server.ts                        — Add YOUTUBE_API_KEY, make Polar vars optional
packages/auth/src/index.ts                        — Conditionally register Polar plugin
packages/auth/src/lib/payments.ts                 — Guard against undefined access token
packages/api/package.json                         — Add nested path exports for sse/*, music/*
packages/api/src/index.ts                         — Add guestProcedure, authenticatedProcedure
packages/api/src/context.ts                       — Rewrite with discriminated union context type
packages/api/src/routers/index.ts                 — Compose all new sub-routers into appRouter
apps/web/package.json                             — Add @fingerprintjs/fingerprintjs, qrcode.react, react-youtube
apps/web/src/app/layout.tsx                       — Update metadata title/description
```

### Files to DELETE

```
apps/web/src/app/dashboard/page.tsx               — Replaced by (venue)/dashboard/page.tsx
apps/web/src/app/dashboard/dashboard.tsx          — Replaced by (venue)/dashboard/dashboard.tsx
apps/web/src/app/success/page.tsx                 — Polar success page, unused in MVP
```

---

## Task 1: Environment & Config Foundation

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `packages/auth/src/lib/payments.ts`
- Modify: `packages/auth/src/index.ts`
- Modify: `packages/api/package.json`

- [ ] **Step 1: Update env validation**

In `packages/env/src/server.ts`, add `YOUTUBE_API_KEY` and make Polar vars optional:

```typescript
import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    YOUTUBE_API_KEY: z.string().min(1),
    POLAR_ACCESS_TOKEN: z.string().min(1).optional(),
    POLAR_SUCCESS_URL: z.url().optional(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

- [ ] **Step 2: Guard Polar payments client against missing env**

In `packages/auth/src/lib/payments.ts`:

```typescript
import { env } from "@crowd-vibe/env/server";
import { Polar } from "@polar-sh/sdk";

export const polarClient = env.POLAR_ACCESS_TOKEN
  ? new Polar({
      accessToken: env.POLAR_ACCESS_TOKEN,
      server: "sandbox",
    })
  : null;
```

- [ ] **Step 3: Conditionally register Polar plugin in auth**

In `packages/auth/src/index.ts`:

```typescript
import prisma from "@crowd-vibe/db";
import { env } from "@crowd-vibe/env/server";
import { polar, checkout, portal } from "@polar-sh/better-auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { polarClient } from "./lib/payments";

const plugins = [nextCookies()];

if (polarClient && env.POLAR_SUCCESS_URL) {
  plugins.unshift(
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      enableCustomerPortal: true,
      use: [
        checkout({
          products: [
            {
              productId: "your-product-id",
              slug: "pro",
            },
          ],
          successUrl: env.POLAR_SUCCESS_URL,
          authenticatedUsersOnly: true,
        }),
        portal(),
      ],
    })
  );
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [env.CORS_ORIGIN],
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  plugins,
});
```

- [ ] **Step 4: Add nested path exports to @crowd-vibe/api**

In `packages/api/package.json`, replace the `exports` field:

```json
{
  "exports": {
    ".": { "default": "./src/index.ts" },
    "./*": { "default": "./src/*.ts" },
    "./sse/*": { "default": "./src/sse/*.ts" },
    "./music/*": { "default": "./src/music/*.ts" },
    "./lib/*": { "default": "./src/lib/*.ts" }
  }
}
```

- [ ] **Step 5: Add YOUTUBE_API_KEY to .env**

Add to `apps/web/.env`:
```
YOUTUBE_API_KEY=your-youtube-api-key-here
```

- [ ] **Step 6: Verify the app still starts**

Run: `cd /home/rohan/playground/crowd-vibe && npm run dev:web`
Expected: App starts on port 3001 without env validation errors (may need a real YouTube API key or a dummy one temporarily).

- [ ] **Step 7: Commit**

```bash
git add packages/env/src/server.ts packages/auth/src/index.ts packages/auth/src/lib/payments.ts packages/api/package.json apps/web/.env
git commit -m "feat: update env config for YouTube API and optional Polar"
```

---

## Task 2: Database Schema

**Files:**
- Create: `packages/db/prisma/schema/domain.prisma`
- Modify: `packages/db/prisma/schema/auth.prisma`

- [ ] **Step 1: Add venues back-relation to User model**

In `packages/db/prisma/schema/auth.prisma`, add `venues Venue[]` to the User model, after the `accounts` line:

```prisma
  accounts      Account[]
  venues        Venue[]
```

- [ ] **Step 2: Create domain.prisma with all new models**

Create `packages/db/prisma/schema/domain.prisma`:

```prisma
model Venue {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])
  description String?
  logoUrl     String?
  settings    Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  sessions    VenueSession[]

  @@index([ownerId])
  @@map("venue")
}

model VenueSession {
  id            String    @id @default(cuid())
  venueId       String
  venue         Venue     @relation(fields: [venueId], references: [id], onDelete: Cascade)
  name          String?
  musicProvider String    @default("youtube")
  isActive      Boolean   @default(true)
  joinCode      String    @unique
  startedAt     DateTime  @default(now())
  endedAt       DateTime?

  songs         Song[]
  guests        GuestUser[]

  @@index([venueId])
  @@index([isActive])
  @@map("venue_session")
}

model GuestUser {
  id            String       @id @default(cuid())
  sessionId     String
  session       VenueSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  displayName   String?
  fingerprint   String
  createdAt     DateTime     @default(now())

  votes         Vote[]
  suggestions   Song[]       @relation("SuggestedBy")

  @@unique([sessionId, fingerprint])
  @@index([sessionId])
  @@map("guest_user")
}

model Song {
  id            String       @id @default(cuid())
  sessionId     String
  session       VenueSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  providerId    String
  provider      String       @default("youtube")
  title         String
  artist        String?
  thumbnailUrl  String?
  durationMs    Int?
  status        String       @default("queued")
  score         Int          @default(0)
  addedAt       DateTime     @default(now())
  playedAt      DateTime?
  suggestedById String?
  suggestedBy   GuestUser?   @relation("SuggestedBy", fields: [suggestedById], references: [id], onDelete: SetNull)

  votes         Vote[]

  @@index([sessionId, status, score])
  @@map("song")
}

model Vote {
  id        String    @id @default(cuid())
  songId    String
  song      Song      @relation(fields: [songId], references: [id], onDelete: Cascade)
  guestId   String
  guest     GuestUser @relation(fields: [guestId], references: [id], onDelete: Cascade)
  value     Int
  createdAt DateTime  @default(now())

  @@unique([songId, guestId])
  @@map("vote")
}
```

- [ ] **Step 3: Generate Prisma client**

Run: `cd /home/rohan/playground/crowd-vibe && npm run db:generate`
Expected: Prisma client generated successfully with all new models.

- [ ] **Step 4: Push schema to database**

Run: `cd /home/rohan/playground/crowd-vibe && npm run db:push`
Expected: Schema pushed, tables created (venue, venue_session, guest_user, song, vote).

- [ ] **Step 5: Verify with Prisma Studio**

Run: `cd /home/rohan/playground/crowd-vibe && npm run db:studio`
Expected: Prisma Studio opens in browser showing all new tables with correct columns and relations.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema/domain.prisma packages/db/prisma/schema/auth.prisma
git commit -m "feat: add domain schema for Venue, VenueSession, GuestUser, Song, Vote"
```

---

## Task 3: Shared Utilities

**Files:**
- Create: `packages/api/src/lib/cookie.ts`
- Create: `packages/api/src/lib/rate-limiter.ts`
- Create: `packages/api/src/lib/join-code.ts`
- Create: `packages/api/src/lib/settings.ts`

- [ ] **Step 1: Create HMAC cookie signing utility**

Create `packages/api/src/lib/cookie.ts`:

```typescript
import { createHmac } from "node:crypto";

export function signCookie(value: string, secret: string): string {
  const hmac = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${hmac}`;
}

export function verifySignedCookie(
  signed: string,
  secret: string
): string | null {
  const dotIndex = signed.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const value = signed.substring(0, dotIndex);
  const signature = signed.substring(dotIndex + 1);
  const expected = createHmac("sha256", secret).update(value).digest("hex");
  if (signature.length !== expected.length) return null;
  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0 ? value : null;
}
```

- [ ] **Step 2: Create rate limiter**

Create `packages/api/src/lib/rate-limiter.ts`:

```typescript
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  check(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry || now >= entry.resetAt) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: this.maxRequests - entry.count };
  }
}
```

- [ ] **Step 3: Create join code generator**

Create `packages/api/src/lib/join-code.ts`:

```typescript
// A-Z, 2-9 — excludes ambiguous characters O/0/I/1/L
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}
```

- [ ] **Step 4: Create venue settings schema**

Create `packages/api/src/lib/settings.ts`:

```typescript
import { z } from "zod";

export const VenueSettingsSchema = z.object({
  maxSuggestionsPerGuest: z.number().default(5),
  suggestionCooldownSec: z.number().default(30),
  downvoteSkipThreshold: z.number().default(-3),
  allowExplicitContent: z.boolean().default(true),
});

export type VenueSettings = z.infer<typeof VenueSettingsSchema>;

export function parseVenueSettings(raw: unknown): VenueSettings {
  try {
    return VenueSettingsSchema.parse(raw ?? {});
  } catch {
    return VenueSettingsSchema.parse({});
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/
git commit -m "feat: add shared utilities (HMAC cookie, rate limiter, join code, settings)"
```

---

## Task 4: Auth Context & Procedure Types

**Files:**
- Modify: `packages/api/src/context.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Rewrite context with discriminated union**

Replace `packages/api/src/context.ts` entirely:

```typescript
import { auth } from "@crowd-vibe/auth";
import prisma from "@crowd-vibe/db";
import { env } from "@crowd-vibe/env/server";
import type { NextRequest } from "next/server";

import { verifySignedCookie } from "./lib/cookie";

export type Context =
  | { type: "owner"; user: { id: string; name: string; email: string } }
  | { type: "guest"; guestId: string; guestSessionId: string }
  | { type: "anonymous" };

export async function createContext(req: NextRequest): Promise<Context> {
  // Try Better-Auth first (venue owner)
  const authSession = await auth.api.getSession({
    headers: req.headers,
  });
  if (authSession?.user) {
    return {
      type: "owner",
      user: {
        id: authSession.user.id,
        name: authSession.user.name,
        email: authSession.user.email,
      },
    };
  }

  // Fall back to guest cookie (HMAC-signed)
  const rawCookie = req.cookies.get("cv_guest")?.value;
  if (rawCookie) {
    const guestId = verifySignedCookie(rawCookie, env.BETTER_AUTH_SECRET);
    if (guestId) {
      const guest = await prisma.guestUser.findUnique({
        where: { id: guestId },
        select: { sessionId: true },
      });
      if (guest) {
        return {
          type: "guest",
          guestId,
          guestSessionId: guest.sessionId,
        };
      }
    }
  }

  return { type: "anonymous" };
}
```

- [ ] **Step 2: Add all procedure types**

Replace `packages/api/src/index.ts` entirely:

```typescript
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/rohan/playground/crowd-vibe && npx tsc --noEmit --project packages/api/tsconfig.json`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/context.ts packages/api/src/index.ts
git commit -m "feat: rewrite auth context with discriminated union and add procedure types"
```

---

## Task 5: SSE Channel Manager

**Files:**
- Create: `packages/api/src/sse/types.ts`
- Create: `packages/api/src/sse/channel-manager.ts`
- Create: `apps/web/src/app/api/sse/[sessionId]/route.ts`

- [ ] **Step 1: Create SSE event types**

Create `packages/api/src/sse/types.ts`:

```typescript
export interface QueuedSong {
  id: string;
  providerId: string;
  provider: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  status: string;
  score: number;
  addedAt: string;
  suggestedBy: { displayName: string | null } | null;
}

export type SSEEvent =
  | { type: "queue_updated"; data: { songs: QueuedSong[] } }
  | { type: "now_playing"; data: { song: QueuedSong | null } }
  | { type: "vote_changed"; data: { songId: string; score: number } }
  | { type: "song_added"; data: { song: QueuedSong } }
  | { type: "song_removed"; data: { songId: string } }
  | { type: "session_ended"; data: Record<string, never> };
```

- [ ] **Step 2: Create SSE channel manager**

Create `packages/api/src/sse/channel-manager.ts`:

```typescript
import type { SSEEvent } from "./types";

type SSEWriter = {
  write: (data: string) => void;
  close: () => void;
};

class SSEChannelManager {
  private channels = new Map<string, Set<SSEWriter>>();

  subscribe(sessionId: string, writer: SSEWriter): void {
    if (!this.channels.has(sessionId)) {
      this.channels.set(sessionId, new Set());
    }
    this.channels.get(sessionId)!.add(writer);
  }

  unsubscribe(sessionId: string, writer: SSEWriter): void {
    const channel = this.channels.get(sessionId);
    if (channel) {
      channel.delete(writer);
      if (channel.size === 0) {
        this.channels.delete(sessionId);
      }
    }
  }

  broadcast(sessionId: string, event: SSEEvent): void {
    const channel = this.channels.get(sessionId);
    if (!channel) return;
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const writer of channel) {
      try {
        writer.write(payload);
      } catch {
        channel.delete(writer);
      }
    }
  }

  getListenerCount(sessionId: string): number {
    return this.channels.get(sessionId)?.size ?? 0;
  }
}

const globalForSSE = globalThis as unknown as {
  channelManager: SSEChannelManager;
};
export const channelManager =
  globalForSSE.channelManager ?? new SSEChannelManager();
globalForSSE.channelManager = channelManager;

export type { SSEEvent };
```

- [ ] **Step 3: Create SSE route handler**

Create `apps/web/src/app/api/sse/[sessionId]/route.ts`:

```typescript
import { auth } from "@crowd-vibe/auth";
import prisma from "@crowd-vibe/db";
import { env } from "@crowd-vibe/env/server";
import { channelManager } from "@crowd-vibe/api/sse/channel-manager";
import { verifySignedCookie } from "@crowd-vibe/api/lib/cookie";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Check session exists and is active
  const session = await prisma.venueSession.findUnique({
    where: { id: sessionId },
    select: { isActive: true, venueId: true, venue: { select: { ownerId: true } } },
  });

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }
  if (!session.isActive) {
    return new Response("Session ended", { status: 410 });
  }

  // Authenticate: guest cookie OR venue owner
  const guestCookie = req.cookies.get("cv_guest")?.value;
  const authSession = await auth.api.getSession({ headers: req.headers });

  let authorized = false;

  if (guestCookie) {
    const guestId = verifySignedCookie(guestCookie, env.BETTER_AUTH_SECRET);
    if (guestId) {
      const guest = await prisma.guestUser.findUnique({
        where: { id: guestId },
        select: { sessionId: true },
      });
      if (guest?.sessionId === sessionId) authorized = true;
    }
  }

  if (!authorized && authSession?.user) {
    if (session.venue.ownerId === authSession.user.id) authorized = true;
  }

  if (!authorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const writer = {
        write: (data: string) => {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            // Stream closed
          }
        },
        close: () => {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        },
      };

      channelManager.subscribe(sessionId, writer);

      // Send initial heartbeat
      writer.write(": connected\n\n");

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          writer.write(": heartbeat\n\n");
        } catch {
          clearInterval(heartbeat);
          channelManager.unsubscribe(sessionId, writer);
        }
      }, 30000);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        channelManager.unsubscribe(sessionId, writer);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/sse/ apps/web/src/app/api/sse/
git commit -m "feat: add SSE channel manager and streaming endpoint"
```

---

## Task 6: Music Provider Abstraction

**Files:**
- Create: `packages/api/src/music/types.ts`
- Create: `packages/api/src/music/search-cache.ts`
- Create: `packages/api/src/music/providers/youtube.ts`
- Create: `packages/api/src/music/providers/spotify.ts`
- Create: `packages/api/src/music/index.ts`

- [ ] **Step 1: Create music types**

Create `packages/api/src/music/types.ts`:

```typescript
export interface MusicTrack {
  providerId: string;
  provider: "youtube" | "spotify";
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
}

export interface SearchResult {
  tracks: MusicTrack[];
  nextPageToken?: string;
}

export interface PlayerData {
  type: "youtube" | "spotify";
  embedUrl?: string;
  trackUri?: string;
  providerId: string;
}

export interface MusicProvider {
  search(query: string, limit?: number): Promise<SearchResult>;
  getTrack(providerId: string): Promise<MusicTrack | null>;
  getPlayerData(providerId: string): PlayerData;
  validate(providerId: string): Promise<boolean>;
}
```

- [ ] **Step 2: Create server-side search cache**

Create `packages/api/src/music/search-cache.ts`:

```typescript
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class SearchCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private ttlMs: number;

  constructor(ttlMinutes: number = 15) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  makeKey(provider: string, query: string): string {
    return `${provider}:${query.toLowerCase().trim()}`;
  }
}

const globalForCache = globalThis as unknown as { searchCache: SearchCache };
export const searchCache =
  globalForCache.searchCache ?? new SearchCache(15);
globalForCache.searchCache = searchCache;
```

- [ ] **Step 3: Create YouTube provider**

Create `packages/api/src/music/providers/youtube.ts`:

```typescript
import { env } from "@crowd-vibe/env/server";
import type { MusicProvider, MusicTrack, SearchResult, PlayerData } from "../types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
  contentDetails: {
    duration: string; // ISO 8601 duration e.g. "PT4M30S"
  };
}

function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number.parseInt(match[1] || "0", 10);
  const minutes = Number.parseInt(match[2] || "0", 10);
  const seconds = Number.parseInt(match[3] || "0", 10);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

function getThumbnail(thumbnails: YouTubeVideoItem["snippet"]["thumbnails"]): string | null {
  return thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null;
}

export class YouTubeProvider implements MusicProvider {
  private apiKey = env.YOUTUBE_API_KEY;

  async search(query: string, limit = 10): Promise<SearchResult> {
    const url = new URL(`${YOUTUBE_API_BASE}/search`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("videoCategoryId", "10"); // Music category
    url.searchParams.set("maxResults", String(limit));
    url.searchParams.set("q", query);
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`YouTube API error: ${res.status}`);
    }

    const data = await res.json();
    const items: YouTubeSearchItem[] = data.items ?? [];

    return {
      tracks: items.map((item) => ({
        providerId: item.id.videoId,
        provider: "youtube" as const,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnailUrl: getThumbnail(item.snippet.thumbnails),
        durationMs: null, // Search results don't include duration
      })),
      nextPageToken: data.nextPageToken,
    };
  }

  async getTrack(providerId: string): Promise<MusicTrack | null> {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", providerId);
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    const item: YouTubeVideoItem | undefined = data.items?.[0];
    if (!item) return null;

    return {
      providerId: item.id,
      provider: "youtube",
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnailUrl: getThumbnail(item.snippet.thumbnails),
      durationMs: parseDuration(item.contentDetails.duration),
    };
  }

  getPlayerData(providerId: string): PlayerData {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${providerId}?autoplay=1&enablejsapi=1`,
      providerId,
    };
  }

  async validate(providerId: string): Promise<boolean> {
    const track = await this.getTrack(providerId);
    return track !== null;
  }
}
```

- [ ] **Step 4: Create Spotify provider stub**

Create `packages/api/src/music/providers/spotify.ts`:

```typescript
import type { MusicProvider, MusicTrack, SearchResult, PlayerData } from "../types";

export class SpotifyProvider implements MusicProvider {
  async search(): Promise<SearchResult> {
    throw new Error("Spotify provider not implemented yet");
  }

  async getTrack(): Promise<MusicTrack | null> {
    throw new Error("Spotify provider not implemented yet");
  }

  getPlayerData(providerId: string): PlayerData {
    return {
      type: "spotify",
      trackUri: `spotify:track:${providerId}`,
      providerId,
    };
  }

  async validate(): Promise<boolean> {
    throw new Error("Spotify provider not implemented yet");
  }
}
```

- [ ] **Step 5: Create provider factory**

Create `packages/api/src/music/index.ts`:

```typescript
import type { MusicProvider } from "./types";
import { YouTubeProvider } from "./providers/youtube";
import { SpotifyProvider } from "./providers/spotify";

const providers = new Map<string, MusicProvider>();

export function getMusicProvider(type: string): MusicProvider {
  if (!providers.has(type)) {
    switch (type) {
      case "youtube":
        providers.set(type, new YouTubeProvider());
        break;
      case "spotify":
        providers.set(type, new SpotifyProvider());
        break;
      default:
        throw new Error(`Unknown music provider: ${type}`);
    }
  }
  return providers.get(type)!;
}

export type { MusicTrack, SearchResult, PlayerData, MusicProvider } from "./types";
```

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/music/
git commit -m "feat: add music provider abstraction with YouTube implementation"
```

---

## Task 7: Guest Join Route Handler

**Files:**
- Create: `apps/web/src/app/api/guest/join/route.ts`

- [ ] **Step 1: Create the guest join endpoint**

Create `apps/web/src/app/api/guest/join/route.ts`:

```typescript
import prisma from "@crowd-vibe/db";
import { env } from "@crowd-vibe/env/server";
import { signCookie } from "@crowd-vibe/api/lib/cookie";
import { RateLimiter } from "@crowd-vibe/api/lib/rate-limiter";
import { NextRequest, NextResponse } from "next/server";

const joinRateLimiter = new RateLimiter(3, 60_000); // 3 per minute per IP

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = joinRateLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many join attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const { joinCode, fingerprint, displayName } = body as {
    joinCode: string;
    fingerprint: string;
    displayName?: string;
  };

  if (!joinCode || !fingerprint) {
    return NextResponse.json(
      { error: "joinCode and fingerprint are required" },
      { status: 400 }
    );
  }

  // Find active session by join code
  const session = await prisma.venueSession.findUnique({
    where: { joinCode },
    select: {
      id: true,
      isActive: true,
      venue: { select: { name: true } },
      name: true,
    },
  });

  if (!session || !session.isActive) {
    return NextResponse.json(
      { error: "No active session found for this code." },
      { status: 404 }
    );
  }

  // Upsert guest user by session + fingerprint
  const guest = await prisma.guestUser.upsert({
    where: {
      sessionId_fingerprint: {
        sessionId: session.id,
        fingerprint,
      },
    },
    create: {
      sessionId: session.id,
      fingerprint,
      displayName: displayName || null,
    },
    update: {
      displayName: displayName || undefined,
    },
  });

  // Sign the cookie
  const signedCookie = signCookie(guest.id, env.BETTER_AUTH_SECRET);

  const response = NextResponse.json({
    sessionId: session.id,
    venueName: session.venue.name,
    displayName: guest.displayName,
  });

  response.cookies.set("cv_guest", signedCookie, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400, // 24 hours
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/guest/join/route.ts
git commit -m "feat: add guest join route handler with HMAC-signed cookie"
```

---

## Task 8: tRPC Routers

**Files:**
- Create: `packages/api/src/routers/venue.ts`
- Create: `packages/api/src/routers/session.ts`
- Create: `packages/api/src/routers/guest.ts`
- Create: `packages/api/src/routers/queue.ts`
- Create: `packages/api/src/routers/song.ts`
- Create: `packages/api/src/routers/vote.ts`
- Modify: `packages/api/src/routers/index.ts`

- [ ] **Step 1: Create venue router**

Create `packages/api/src/routers/venue.ts`:

```typescript
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
      return prisma.venue.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          ownerId: ctx.user.id,
        },
      });
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
```

- [ ] **Step 2: Create session router**

Create `packages/api/src/routers/session.ts`:

```typescript
import prisma from "@crowd-vibe/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../index";
import { generateJoinCode } from "../lib/join-code";
import { channelManager } from "../sse/channel-manager";

export const sessionRouter = router({
  start: protectedProcedure
    .input(
      z.object({
        venueId: z.string(),
        name: z.string().max(100).optional(),
        musicProvider: z.enum(["youtube", "spotify"]).default("youtube"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
      if (!venue || venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
      }

      // Generate unique join code with collision retry
      let joinCode = generateJoinCode();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await prisma.venueSession.findUnique({ where: { joinCode } });
        if (!existing) break;
        joinCode = generateJoinCode();
        attempts++;
      }

      return prisma.venueSession.create({
        data: {
          venueId: input.venueId,
          name: input.name,
          musicProvider: input.musicProvider,
          joinCode,
        },
      });
    }),

  end: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.venueSession.findUnique({
        where: { id: input.sessionId },
        include: { venue: { select: { ownerId: true } } },
      });
      if (!session || session.venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await prisma.venueSession.update({
        where: { id: input.sessionId },
        data: { isActive: false, endedAt: new Date() },
      });

      channelManager.broadcast(input.sessionId, {
        type: "session_ended",
        data: {},
      });

      return { success: true };
    }),

  getByJoinCode: publicProcedure
    .input(z.object({ joinCode: z.string() }))
    .query(async ({ input }) => {
      const session = await prisma.venueSession.findUnique({
        where: { joinCode: input.joinCode },
        select: {
          id: true,
          isActive: true,
          name: true,
          venue: { select: { name: true } },
        },
      });

      if (!session || !session.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No active session found for this code." });
      }

      return {
        venueName: session.venue.name,
        sessionName: session.name,
        listenerCount: channelManager.getListenerCount(session.id),
      };
    }),

  getActive: publicProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ input }) => {
      return prisma.venueSession.findFirst({
        where: { venueId: input.venueId, isActive: true },
        select: { id: true, joinCode: true, name: true, startedAt: true, musicProvider: true },
      });
    }),

  stats: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await prisma.venueSession.findUnique({
        where: { id: input.sessionId },
        include: {
          venue: { select: { ownerId: true } },
          _count: { select: { guests: true, songs: true } },
        },
      });
      if (!session || session.venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const songsPlayed = await prisma.song.count({
        where: { sessionId: input.sessionId, status: "played" },
      });

      return {
        listenerCount: channelManager.getListenerCount(input.sessionId),
        guestCount: session._count.guests,
        totalSongs: session._count.songs,
        songsPlayed,
      };
    }),
});
```

- [ ] **Step 3: Create guest router**

Create `packages/api/src/routers/guest.ts`:

```typescript
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
        votes: { select: { songId: true, value: true } },
      },
    });
    return guest;
  }),
});
```

- [ ] **Step 4: Create queue router**

Create `packages/api/src/routers/queue.ts`:

```typescript
import prisma from "@crowd-vibe/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, authenticatedProcedure } from "../index";
import { channelManager } from "../sse/channel-manager";
import { getMusicProvider } from "../music/index";

export const queueRouter = router({
  list: authenticatedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Validate access
      if (ctx.type === "guest" && ctx.guestSessionId !== input.sessionId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (ctx.type === "owner") {
        const session = await prisma.venueSession.findUnique({
          where: { id: input.sessionId },
          select: { venue: { select: { ownerId: true } } },
        });
        if (!session || session.venue.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }

      return prisma.song.findMany({
        where: { sessionId: input.sessionId, status: "queued" },
        orderBy: [{ score: "desc" }, { addedAt: "asc" }],
        select: {
          id: true,
          providerId: true,
          provider: true,
          title: true,
          artist: true,
          thumbnailUrl: true,
          durationMs: true,
          status: true,
          score: true,
          addedAt: true,
          suggestedBy: { select: { displayName: true } },
        },
      });
    }),

  nowPlaying: authenticatedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.type === "guest" && ctx.guestSessionId !== input.sessionId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (ctx.type === "owner") {
        const session = await prisma.venueSession.findUnique({
          where: { id: input.sessionId },
          select: { venue: { select: { ownerId: true } } },
        });
        if (!session || session.venue.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }

      return prisma.song.findFirst({
        where: { sessionId: input.sessionId, status: "playing" },
        select: {
          id: true,
          providerId: true,
          provider: true,
          title: true,
          artist: true,
          thumbnailUrl: true,
          durationMs: true,
          score: true,
        },
      });
    }),

  next: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.venueSession.findUnique({
        where: { id: input.sessionId },
        select: { venue: { select: { ownerId: true } }, musicProvider: true },
      });
      if (!session || session.venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Mark current playing as played
      await prisma.song.updateMany({
        where: { sessionId: input.sessionId, status: "playing" },
        data: { status: "played", playedAt: new Date() },
      });

      // Get next song by score
      const nextSong = await prisma.song.findFirst({
        where: { sessionId: input.sessionId, status: "queued" },
        orderBy: [{ score: "desc" }, { addedAt: "asc" }],
      });

      if (nextSong) {
        await prisma.song.update({
          where: { id: nextSong.id },
          data: { status: "playing", playedAt: new Date() },
        });

        const provider = getMusicProvider(session.musicProvider);
        const playerData = provider.getPlayerData(nextSong.providerId);

        channelManager.broadcast(input.sessionId, {
          type: "now_playing",
          data: {
            song: {
              id: nextSong.id,
              providerId: nextSong.providerId,
              provider: nextSong.provider,
              title: nextSong.title,
              artist: nextSong.artist,
              thumbnailUrl: nextSong.thumbnailUrl,
              durationMs: nextSong.durationMs,
              status: "playing",
              score: nextSong.score,
              addedAt: nextSong.addedAt.toISOString(),
              suggestedBy: null,
            },
          },
        });

        return { song: nextSong, playerData };
      }

      channelManager.broadcast(input.sessionId, {
        type: "now_playing",
        data: { song: null },
      });

      return { song: null, playerData: null };
    }),

  skip: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.venueSession.findUnique({
        where: { id: input.sessionId },
        select: { venue: { select: { ownerId: true } }, musicProvider: true },
      });
      if (!session || session.venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Mark current as skipped
      await prisma.song.updateMany({
        where: { sessionId: input.sessionId, status: "playing" },
        data: { status: "skipped" },
      });

      // Auto-advance to next song (same logic as queue.next)
      const nextSong = await prisma.song.findFirst({
        where: { sessionId: input.sessionId, status: "queued" },
        orderBy: [{ score: "desc" }, { addedAt: "asc" }],
      });

      if (nextSong) {
        await prisma.song.update({
          where: { id: nextSong.id },
          data: { status: "playing", playedAt: new Date() },
        });

        const provider = getMusicProvider(session.musicProvider);
        const playerData = provider.getPlayerData(nextSong.providerId);

        channelManager.broadcast(input.sessionId, {
          type: "now_playing",
          data: {
            song: {
              id: nextSong.id,
              providerId: nextSong.providerId,
              provider: nextSong.provider,
              title: nextSong.title,
              artist: nextSong.artist,
              thumbnailUrl: nextSong.thumbnailUrl,
              durationMs: nextSong.durationMs,
              status: "playing",
              score: nextSong.score,
              addedAt: nextSong.addedAt.toISOString(),
              suggestedBy: null,
            },
          },
        });

        return { song: nextSong, playerData };
      }

      channelManager.broadcast(input.sessionId, {
        type: "now_playing",
        data: { song: null },
      });

      return { song: null, playerData: null };
    }),
});
```

- [ ] **Step 5: Create song router**

Create `packages/api/src/routers/song.ts`:

```typescript
import prisma from "@crowd-vibe/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  router,
  protectedProcedure,
  guestProcedure,
  authenticatedProcedure,
} from "../index";
import { getMusicProvider } from "../music/index";
import { searchCache } from "../music/search-cache";
import { channelManager } from "../sse/channel-manager";
import { parseVenueSettings } from "../lib/settings";
import { RateLimiter } from "../lib/rate-limiter";
import type { SearchResult } from "../music/types";

const searchRateLimiter = new RateLimiter(10, 60_000); // 10 per minute

export const songRouter = router({
  search: authenticatedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        query: z.string().min(1).max(200),
      })
    )
    .query(async ({ ctx, input }) => {
      // Validate session access
      if (ctx.type === "guest") {
        if (ctx.guestSessionId !== input.sessionId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Rate limit guests
        const rateKey = ctx.guestId;
        const { allowed } = searchRateLimiter.check(rateKey);
        if (!allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many searches. Try again in a moment.",
          });
        }
      }

      const session = await prisma.venueSession.findUnique({
        where: { id: input.sessionId },
        select: { musicProvider: true, venue: { select: { ownerId: true } } },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.type === "owner" && session.venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Check server-side cache
      const cacheKey = searchCache.makeKey(session.musicProvider, input.query);
      const cached = searchCache.get<SearchResult>(cacheKey);
      if (cached) return cached;

      // Fetch from provider
      const provider = getMusicProvider(session.musicProvider);
      try {
        const result = await provider.search(input.query);
        searchCache.set(cacheKey, result);
        return result;
      } catch {
        return { tracks: [], nextPageToken: undefined };
      }
    }),

  suggest: guestProcedure
    .input(z.object({ providerId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const sessionId = ctx.guestSessionId;

      const session = await prisma.venueSession.findUnique({
        where: { id: sessionId },
        select: { musicProvider: true, venue: { select: { settings: true } } },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      const settings = parseVenueSettings(session.venue.settings);

      // Check suggestion count
      const suggestionCount = await prisma.song.count({
        where: { sessionId, suggestedById: ctx.guestId },
      });
      if (suggestionCount >= settings.maxSuggestionsPerGuest) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `You've used all ${settings.maxSuggestionsPerGuest} song suggestions for this session.`,
        });
      }

      // Check cooldown
      const lastSuggestion = await prisma.song.findFirst({
        where: { sessionId, suggestedById: ctx.guestId },
        orderBy: { addedAt: "desc" },
        select: { addedAt: true },
      });
      if (lastSuggestion) {
        const elapsed = Date.now() - lastSuggestion.addedAt.getTime();
        if (elapsed < settings.suggestionCooldownSec * 1000) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Wait a few seconds before suggesting another song.",
          });
        }
      }

      // Check duplicate
      const existing = await prisma.song.findFirst({
        where: {
          sessionId,
          providerId: input.providerId,
          status: { in: ["queued", "playing"] },
        },
      });
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This song is already in the queue — vote for it instead!",
        });
      }

      // Fetch track metadata
      const provider = getMusicProvider(session.musicProvider);
      const track = await provider.getTrack(input.providerId);
      if (!track) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not find this song." });
      }

      // Create song + auto-upvote in transaction
      const song = await prisma.$transaction(async (tx) => {
        const created = await tx.song.create({
          data: {
            sessionId,
            providerId: track.providerId,
            provider: track.provider,
            title: track.title,
            artist: track.artist,
            thumbnailUrl: track.thumbnailUrl,
            durationMs: track.durationMs,
            suggestedById: ctx.guestId,
            score: 1, // auto-upvote
          },
        });

        await tx.vote.create({
          data: {
            songId: created.id,
            guestId: ctx.guestId,
            value: 1,
          },
        });

        return created;
      });

      channelManager.broadcast(sessionId, {
        type: "song_added",
        data: {
          song: {
            id: song.id,
            providerId: song.providerId,
            provider: song.provider,
            title: song.title,
            artist: song.artist,
            thumbnailUrl: song.thumbnailUrl,
            durationMs: song.durationMs,
            status: song.status,
            score: song.score,
            addedAt: song.addedAt.toISOString(),
            suggestedBy: null,
          },
        },
      });

      return song;
    }),

  add: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        providerId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.venueSession.findUnique({
        where: { id: input.sessionId },
        select: { musicProvider: true, venue: { select: { ownerId: true } } },
      });
      if (!session || session.venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Check duplicate
      const existing = await prisma.song.findFirst({
        where: {
          sessionId: input.sessionId,
          providerId: input.providerId,
          status: { in: ["queued", "playing"] },
        },
      });
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This song is already in the queue.",
        });
      }

      const provider = getMusicProvider(session.musicProvider);
      const track = await provider.getTrack(input.providerId);
      if (!track) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not find this song." });
      }

      const song = await prisma.song.create({
        data: {
          sessionId: input.sessionId,
          providerId: track.providerId,
          provider: track.provider,
          title: track.title,
          artist: track.artist,
          thumbnailUrl: track.thumbnailUrl,
          durationMs: track.durationMs,
          score: 0,
        },
      });

      channelManager.broadcast(input.sessionId, {
        type: "song_added",
        data: {
          song: {
            id: song.id,
            providerId: song.providerId,
            provider: song.provider,
            title: song.title,
            artist: song.artist,
            thumbnailUrl: song.thumbnailUrl,
            durationMs: song.durationMs,
            status: song.status,
            score: song.score,
            addedAt: song.addedAt.toISOString(),
            suggestedBy: null,
          },
        },
      });

      return song;
    }),

  remove: protectedProcedure
    .input(z.object({ songId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const song = await prisma.song.findUnique({
        where: { id: input.songId },
        select: {
          sessionId: true,
          session: { select: { venue: { select: { ownerId: true } } } },
        },
      });
      if (!song || song.session.venue.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await prisma.song.delete({ where: { id: input.songId } });

      channelManager.broadcast(song.sessionId, {
        type: "song_removed",
        data: { songId: input.songId },
      });

      return { success: true };
    }),
});
```

- [ ] **Step 6: Create vote router**

Create `packages/api/src/routers/vote.ts`:

```typescript
import prisma from "@crowd-vibe/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, guestProcedure } from "../index";
import { channelManager } from "../sse/channel-manager";
import { parseVenueSettings } from "../lib/settings";

export const voteRouter = router({
  cast: guestProcedure
    .input(
      z.object({
        songId: z.string(),
        value: z.union([z.literal(1), z.literal(-1)]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify song belongs to guest's session
      const song = await prisma.song.findUnique({
        where: { id: input.songId },
        select: {
          sessionId: true,
          status: true,
          session: { select: { venue: { select: { settings: true } } } },
        },
      });
      if (!song || song.sessionId !== ctx.guestSessionId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (song.status !== "queued" && song.status !== "playing") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot vote on this song." });
      }

      const settings = parseVenueSettings(song.session.venue.settings);

      // Upsert vote + recalculate score in transaction
      const newScore = await prisma.$transaction(async (tx) => {
        const existing = await tx.vote.findUnique({
          where: { songId_guestId: { songId: input.songId, guestId: ctx.guestId } },
        });

        if (existing?.value === input.value) {
          // Toggle off — remove vote
          await tx.vote.delete({
            where: { songId_guestId: { songId: input.songId, guestId: ctx.guestId } },
          });
        } else if (existing) {
          // Change vote direction
          await tx.vote.update({
            where: { songId_guestId: { songId: input.songId, guestId: ctx.guestId } },
            data: { value: input.value },
          });
        } else {
          // New vote
          await tx.vote.create({
            data: { songId: input.songId, guestId: ctx.guestId, value: input.value },
          });
        }

        // Recalculate score
        const result = await tx.vote.aggregate({
          where: { songId: input.songId },
          _sum: { value: true },
        });
        const score = result._sum.value ?? 0;

        await tx.song.update({
          where: { id: input.songId },
          data: { score },
        });

        return score;
      });

      channelManager.broadcast(song.sessionId, {
        type: "vote_changed",
        data: { songId: input.songId, score: newScore },
      });

      // Auto-skip if below threshold
      if (newScore <= settings.downvoteSkipThreshold) {
        if (song.status === "queued") {
          await prisma.song.update({
            where: { id: input.songId },
            data: { status: "skipped" },
          });
          channelManager.broadcast(song.sessionId, {
            type: "song_removed",
            data: { songId: input.songId },
          });
        } else if (song.status === "playing") {
          // Auto-skip playing song and advance to next
          await prisma.song.update({
            where: { id: input.songId },
            data: { status: "skipped" },
          });

          // Find next queued song
          const nextSong = await prisma.song.findFirst({
            where: { sessionId: song.sessionId, status: "queued" },
            orderBy: [{ score: "desc" }, { addedAt: "asc" }],
          });

          if (nextSong) {
            await prisma.song.update({
              where: { id: nextSong.id },
              data: { status: "playing", playedAt: new Date() },
            });
            channelManager.broadcast(song.sessionId, {
              type: "now_playing",
              data: {
                song: {
                  id: nextSong.id,
                  providerId: nextSong.providerId,
                  provider: nextSong.provider,
                  title: nextSong.title,
                  artist: nextSong.artist,
                  thumbnailUrl: nextSong.thumbnailUrl,
                  durationMs: nextSong.durationMs,
                  status: "playing",
                  score: nextSong.score,
                  addedAt: nextSong.addedAt.toISOString(),
                  suggestedBy: null,
                },
              },
            });
          } else {
            channelManager.broadcast(song.sessionId, {
              type: "now_playing",
              data: { song: null },
            });
          }
        }
      }

      return { score: newScore };
    }),
});
```

- [ ] **Step 7: Compose all routers into appRouter**

Replace `packages/api/src/routers/index.ts`:

```typescript
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
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd /home/rohan/playground/crowd-vibe && npx tsc --noEmit --project packages/api/tsconfig.json`
Expected: No type errors.

- [ ] **Step 9: Commit**

```bash
git add packages/api/src/routers/
git commit -m "feat: add all tRPC routers (venue, session, guest, queue, song, vote)"
```

---

## Task 9: Install Frontend Dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install new packages**

```bash
cd /home/rohan/playground/crowd-vibe
npm install @fingerprintjs/fingerprintjs qrcode.react react-youtube --workspace web
```

Note: `qrcode.react` bundles its own TypeScript types — no `@types` package needed.

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "feat: add fingerprintjs, qrcode.react, react-youtube dependencies"
```

---

## Task 10: Frontend Hooks

**Files:**
- Create: `apps/web/src/hooks/use-session-events.ts`
- Create: `apps/web/src/hooks/use-guest.ts`

- [ ] **Step 1: Create SSE events hook**

Create `apps/web/src/hooks/use-session-events.ts`:

```typescript
"use client";

import { useEffect, useRef } from "react";

interface QueuedSong {
  id: string;
  providerId: string;
  provider: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  status: string;
  score: number;
  addedAt: string;
  suggestedBy: { displayName: string | null } | null;
}

interface SessionEventHandlers {
  onQueueUpdated?: (songs: QueuedSong[]) => void;
  onNowPlaying?: (song: QueuedSong | null) => void;
  onVoteChanged?: (songId: string, score: number) => void;
  onSongAdded?: (song: QueuedSong) => void;
  onSongRemoved?: (songId: string) => void;
  onSessionEnded?: () => void;
}

export function useSessionEvents(
  sessionId: string | null,
  handlers: SessionEventHandlers
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!sessionId) return;

    const eventSource = new EventSource(`/api/sse/${sessionId}`);

    eventSource.addEventListener("vote_changed", (e) => {
      const data = JSON.parse(e.data);
      handlersRef.current.onVoteChanged?.(data.songId, data.score);
    });

    eventSource.addEventListener("now_playing", (e) => {
      const data = JSON.parse(e.data);
      handlersRef.current.onNowPlaying?.(data.song);
    });

    eventSource.addEventListener("song_added", (e) => {
      const data = JSON.parse(e.data);
      handlersRef.current.onSongAdded?.(data.song);
    });

    eventSource.addEventListener("song_removed", (e) => {
      const data = JSON.parse(e.data);
      handlersRef.current.onSongRemoved?.(data.songId);
    });

    eventSource.addEventListener("queue_updated", (e) => {
      const data = JSON.parse(e.data);
      handlersRef.current.onQueueUpdated?.(data.songs);
    });

    eventSource.addEventListener("session_ended", () => {
      handlersRef.current.onSessionEnded?.();
    });

    return () => {
      eventSource.close();
    };
  }, [sessionId]);
}
```

- [ ] **Step 2: Create guest identity hook**

Create `apps/web/src/hooks/use-guest.ts`:

```typescript
"use client";

import { useState, useCallback } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

interface JoinResult {
  sessionId: string;
  venueName: string;
  displayName: string | null;
}

export function useGuest() {
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(
    async (joinCode: string, displayName?: string): Promise<JoinResult | null> => {
      setIsJoining(true);
      setError(null);

      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const fingerprint = result.visitorId;

        const res = await fetch("/api/guest/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ joinCode, fingerprint, displayName }),
          credentials: "include",
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to join session");
          return null;
        }

        return await res.json();
      } catch (err) {
        setError("Failed to join session. Please try again.");
        return null;
      } finally {
        setIsJoining(false);
      }
    },
    []
  );

  return { join, isJoining, error };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/
git commit -m "feat: add useSessionEvents and useGuest hooks"
```

---

## Task 11: Venue Owner Frontend — Dashboard & Session Management

**Files:**
- Create: `apps/web/src/app/(venue)/layout.tsx`
- Create: `apps/web/src/app/(venue)/dashboard/page.tsx`
- Create: `apps/web/src/app/(venue)/dashboard/dashboard.tsx`
- Create: `apps/web/src/components/venue/create-venue-form.tsx`
- Create: `apps/web/src/components/venue/start-session-form.tsx`
- Create: `apps/web/src/components/venue/session-dashboard.tsx`
- Create: `apps/web/src/components/venue/queue-manager.tsx`
- Create: `apps/web/src/components/venue/qr-display.tsx`
- Create: `apps/web/src/components/player/youtube-player.tsx`
- Delete: `apps/web/src/app/dashboard/page.tsx`
- Delete: `apps/web/src/app/dashboard/dashboard.tsx`

This is the largest frontend task. Build the complete venue owner experience: venue creation, session start, live dashboard with YouTube player, queue management, QR code display, and session controls (skip, remove song, end session).

**Key implementation details:**
- The `(venue)` route group uses a shared layout that checks Better-Auth session and redirects to `/login` if not authenticated.
- The dashboard shows: venue creation if no venue exists, session start if no active session, live session dashboard if a session is active.
- The YouTube player embed runs ONLY here — customers never get a playable embed.
- `onEnded` from the YouTube player calls `queue.next` to auto-advance songs.
- QR code is generated client-side via `qrcode.react`, encoding `{origin}/join/{joinCode}`.
- Download QR as PNG via `canvas.toDataURL()`.
- All real-time updates come via `useSessionEvents` hook.
- The owner also needs to search and add songs — use `song.search` and `song.add` procedures.

Refer to spec sections 8 (Venue Management & Dashboard), 11 (QR Code Generation), and 12 (YouTube Integration) for exact UI layout and behavior.

- [ ] **Step 1: Create (venue) layout with auth guard**

Create `apps/web/src/app/(venue)/layout.tsx`:

```tsx
import { auth } from "@crowd-vibe/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function VenueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Create dashboard page (server component with auth check)**

Create `apps/web/src/app/(venue)/dashboard/page.tsx`:

```tsx
import { auth } from "@crowd-vibe/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <Dashboard userId={session.user.id} userName={session.user.name} />;
}
```

- [ ] **Step 3: Create dashboard client component**

Create `apps/web/src/app/(venue)/dashboard/dashboard.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import CreateVenueForm from "@/components/venue/create-venue-form";
import StartSessionForm from "@/components/venue/start-session-form";
import SessionDashboard from "@/components/venue/session-dashboard";

export default function Dashboard({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const venues = useQuery(trpc.venue.listMine.queryOptions());

  if (venues.isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  const venue = venues.data?.[0];

  // No venue yet — show create form
  if (!venue) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Create Your Venue</h1>
        <CreateVenueForm onCreated={() => venues.refetch()} />
      </div>
    );
  }

  const activeSession = venue.sessions?.[0];

  // Venue exists but no active session — show start session
  if (!activeSession) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">{venue.name}</h1>
        <p className="text-muted-foreground mb-6">No active session</p>
        <StartSessionForm venueId={venue.id} onStarted={() => venues.refetch()} />
      </div>
    );
  }

  // Active session — show live dashboard
  return (
    <SessionDashboard
      venueId={venue.id}
      venueName={venue.name}
      sessionId={activeSession.id}
      joinCode={activeSession.joinCode}
      sessionName={activeSession.name}
      onSessionEnded={() => venues.refetch()}
    />
  );
}
```

- [ ] **Step 4: Create venue creation form**

Create `apps/web/src/components/venue/create-venue-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { Label } from "@crowd-vibe/ui/components/label";
import { trpc } from "@/utils/trpc";
import { queryClient } from "@/utils/trpc";

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function CreateVenueForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const createVenue = useMutation(
    trpc.venue.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        onCreated();
      },
    })
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createVenue.mutate({ name, slug: slug || slugify(name), description: description || undefined });
      }}
      className="grid gap-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="name">Venue Name</Label>
        <Input id="name" value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} placeholder="Blue Tokai Koramangala" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="slug">URL Slug</Label>
        <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="blue-tokai-koramangala" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="desc">Description (optional)</Label>
        <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A cozy cafe in Koramangala" />
      </div>
      <Button type="submit" disabled={createVenue.isPending}>
        {createVenue.isPending ? "Creating..." : "Create Venue"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Create start session form**

Create `apps/web/src/components/venue/start-session-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { Label } from "@crowd-vibe/ui/components/label";
import { trpc, queryClient } from "@/utils/trpc";

export default function StartSessionForm({
  venueId,
  onStarted,
}: {
  venueId: string;
  onStarted: () => void;
}) {
  const [name, setName] = useState("");

  const startSession = useMutation(
    trpc.session.start.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        onStarted();
      },
    })
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startSession.mutate({ venueId, name: name || undefined, musicProvider: "youtube" });
      }}
      className="grid gap-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="sessionName">Session Name (optional)</Label>
        <Input id="sessionName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Night Vibes" />
      </div>
      <Button type="submit" disabled={startSession.isPending}>
        {startSession.isPending ? "Starting..." : "Start Session"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Create YouTube player component**

Create `apps/web/src/components/player/youtube-player.tsx`:

```tsx
"use client";

import { useCallback } from "react";
import YouTube from "react-youtube";

interface YouTubePlayerProps {
  videoId: string;
  onEnded: () => void;
}

export default function YouTubePlayer({ videoId, onEnded }: YouTubePlayerProps) {
  const handleEnd = useCallback(() => {
    onEnded();
  }, [onEnded]);

  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
      <YouTube
        videoId={videoId}
        opts={{
          width: "100%",
          height: "100%",
          playerVars: { autoplay: 1, controls: 1 },
        }}
        onEnd={handleEnd}
        className="w-full h-full"
        iframeClassName="w-full h-full"
      />
    </div>
  );
}
```

- [ ] **Step 7: Create QR display component**

Create `apps/web/src/components/venue/qr-display.tsx`:

```tsx
"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@crowd-vibe/ui/components/button";

interface QRDisplayProps {
  joinCode: string;
}

export default function QRDisplay({ joinCode }: QRDisplayProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join/${joinCode}`);
  }, [joinCode]);

  const downloadQR = useCallback(() => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `crowdvibe-${joinCode}.png`;
    a.click();
  }, [joinCode]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(joinUrl);
  }, [joinUrl]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
      <div ref={canvasRef}>
        <QRCodeCanvas value={joinUrl} size={200} />
      </div>
      <p className="font-mono text-lg font-bold">{joinCode}</p>
      <p className="text-sm text-muted-foreground break-all">{joinUrl}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadQR}>
          Download QR
        </Button>
        <Button variant="outline" size="sm" onClick={copyLink}>
          Copy Link
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create queue manager component (owner view with remove buttons)**

Create `apps/web/src/components/venue/queue-manager.tsx`:

```tsx
"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { X } from "lucide-react";
import { trpc, queryClient } from "@/utils/trpc";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  score: number;
  thumbnailUrl: string | null;
}

export default function QueueManager({
  songs,
  sessionId,
}: {
  songs: Song[];
  sessionId: string;
}) {
  const removeSong = useMutation(trpc.song.remove.mutationOptions());

  if (songs.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No songs in queue yet. Add songs or share the QR code!
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {songs.map((song, i) => (
        <div
          key={song.id}
          className="flex items-center gap-3 p-3 border rounded-lg"
        >
          <span className="text-muted-foreground text-sm w-6">{i + 1}</span>
          {song.thumbnailUrl && (
            <img src={song.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{song.title}</p>
            {song.artist && (
              <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
            )}
          </div>
          <span className="text-sm font-bold">{song.score > 0 ? `+${song.score}` : song.score}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeSong.mutate({ songId: song.id })}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Create session dashboard component**

Create `apps/web/src/components/venue/session-dashboard.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { trpc, queryClient } from "@/utils/trpc";
import { useSessionEvents } from "@/hooks/use-session-events";
import YouTubePlayer from "@/components/player/youtube-player";
import QRDisplay from "@/components/venue/qr-display";
import QueueManager from "@/components/venue/queue-manager";

interface SessionDashboardProps {
  venueId: string;
  venueName: string;
  sessionId: string;
  joinCode: string;
  sessionName: string | null;
  onSessionEnded: () => void;
}

export default function SessionDashboard({
  venueId,
  venueName,
  sessionId,
  joinCode,
  sessionName,
  onSessionEnded,
}: SessionDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const queue = useQuery(trpc.queue.list.queryOptions({ sessionId }));
  const nowPlaying = useQuery(trpc.queue.nowPlaying.queryOptions({ sessionId }));
  const stats = useQuery(trpc.session.stats.queryOptions({ sessionId }));
  const searchResults = useQuery({
    ...trpc.song.search.queryOptions({ sessionId, query: searchQuery }),
    enabled: searchQuery.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const nextSong = useMutation(trpc.queue.next.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  }));
  const skipSong = useMutation(trpc.queue.skip.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  }));
  const endSession = useMutation(trpc.session.end.mutationOptions({
    onSuccess: onSessionEnded,
  }));
  const addSong = useMutation(trpc.song.add.mutationOptions());

  // SSE real-time updates
  useSessionEvents(sessionId, {
    onVoteChanged: () => queue.refetch(),
    onSongAdded: () => queue.refetch(),
    onSongRemoved: () => queue.refetch(),
    onNowPlaying: () => {
      nowPlaying.refetch();
      queue.refetch();
    },
  });

  const handleSongEnded = useCallback(() => {
    nextSong.mutate({ sessionId });
  }, [sessionId, nextSong]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 grid gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{venueName}</h1>
          {sessionName && <p className="text-muted-foreground">{sessionName}</p>}
          <p className="text-sm text-muted-foreground">
            Listeners: {stats.data?.listenerCount ?? 0} | Songs played: {stats.data?.songsPlayed ?? 0}
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => endSession.mutate({ sessionId })}>
          End Session
        </Button>
      </div>

      {/* Now Playing + Player */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Now Playing</h2>
        {nowPlaying.data ? (
          <div className="grid gap-3">
            <YouTubePlayer videoId={nowPlaying.data.providerId} onEnded={handleSongEnded} />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{nowPlaying.data.title}</p>
                {nowPlaying.data.artist && <p className="text-sm text-muted-foreground">{nowPlaying.data.artist}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Score: {nowPlaying.data.score}</span>
                <Button variant="outline" size="sm" onClick={() => skipSong.mutate({ sessionId })}>
                  Skip
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">No song playing</p>
            {(queue.data?.length ?? 0) > 0 && (
              <Button onClick={() => nextSong.mutate({ sessionId })}>Play Next</Button>
            )}
          </div>
        )}
      </div>

      {/* Owner Song Search + Add */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add Songs</h2>
        <Input
          placeholder="Search for songs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-3"
        />
        {searchResults.data?.tracks.map((track) => (
          <div key={track.providerId} className="flex items-center gap-3 py-2 border-b last:border-0">
            {track.thumbnailUrl && <img src={track.thumbnailUrl} alt="" className="w-10 h-10 rounded" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{track.title}</p>
              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => addSong.mutate({ sessionId, providerId: track.providerId })}>
              Add
            </Button>
          </div>
        ))}
      </div>

      {/* Queue */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Queue</h2>
        <QueueManager songs={queue.data ?? []} sessionId={sessionId} />
      </div>

      {/* QR Code */}
      <QRDisplay joinCode={joinCode} />
    </div>
  );
}
```

- [ ] **Step 10: Delete old dashboard files**

```bash
rm apps/web/src/app/dashboard/page.tsx apps/web/src/app/dashboard/dashboard.tsx
```

- [ ] **Step 11: Verify the dashboard works end-to-end**

Start the app, sign in, create a venue, start a session, verify QR code appears, add a song via search, verify YouTube player loads the song.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/app/\(venue\)/ apps/web/src/components/venue/ apps/web/src/components/player/
git rm apps/web/src/app/dashboard/page.tsx apps/web/src/app/dashboard/dashboard.tsx
git commit -m "feat: add venue owner dashboard with session management, YouTube player, QR codes"
```

---

## Task 12: Guest Frontend — Join & Session View

**Files:**
- Create: `apps/web/src/app/join/[joinCode]/page.tsx`
- Create: `apps/web/src/app/session/[id]/page.tsx`
- Create: `apps/web/src/app/session/[id]/session-view.tsx`
- Create: `apps/web/src/components/session/now-playing.tsx`
- Create: `apps/web/src/components/session/song-queue.tsx`
- Create: `apps/web/src/components/session/song-search.tsx`
- Create: `apps/web/src/components/session/vote-button.tsx`

Build the complete guest experience: join page, session view with now-playing hero card, scrollable queue with voting, and song search bottom sheet.

**Key implementation details:**
- Join page: calls `session.getByJoinCode` to show venue name + listener count, then `useGuest().join()` on form submit, then redirects to `/session/[sessionId]`.
- Session view: mobile-first layout with now-playing at top (display-only, no video player), queue below, "Search & Add" button at bottom.
- Now Playing card: large thumbnail, title, artist. No progress bar.
- Queue items: title, artist, score, upvote/downvote buttons. Queue reorders on vote_changed SSE events.
- Vote buttons: toggle behavior (green for upvoted, red for downvoted, gray for neutral). Calls `vote.cast` mutation.
- Song search: bottom sheet with debounced input (300ms), results from `song.search`, "Add" button calls `song.suggest`. Shows "Suggestions left: X/5".
- `useSessionEvents` hook drives all real-time updates.
- "Session ended" overlay when `session_ended` event fires.

Refer to spec section 9 (Customer Experience) for exact UI layout and interaction details.

- [ ] **Step 1: Create join page**

Create `apps/web/src/app/join/[joinCode]/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { trpc } from "@/utils/trpc";
import { useGuest } from "@/hooks/use-guest";

export default function JoinPage() {
  const params = useParams<{ joinCode: string }>();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const { join, isJoining, error } = useGuest();

  const sessionInfo = useQuery(
    trpc.session.getByJoinCode.queryOptions({ joinCode: params.joinCode })
  );

  const handleJoin = async () => {
    const result = await join(params.joinCode, displayName || undefined);
    if (result) {
      router.push(`/session/${result.sessionId}`);
    }
  };

  if (sessionInfo.isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (sessionInfo.error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <p className="text-lg font-medium">Session not found</p>
        <p className="text-muted-foreground">This code may be invalid or the session has ended.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{sessionInfo.data?.venueName}</h1>
        {sessionInfo.data?.sessionName && (
          <p className="text-muted-foreground">&quot;{sessionInfo.data.sessionName}&quot;</p>
        )}
      </div>

      <div className="w-full max-w-sm grid gap-4">
        <Input
          placeholder="Your name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Button onClick={handleJoin} disabled={isJoining} size="lg" className="w-full">
          {isJoining ? "Joining..." : "Join the Vibe"}
        </Button>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
      </div>

      <p className="text-sm text-muted-foreground">
        {sessionInfo.data?.listenerCount ?? 0} people vibing now
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create session page wrapper**

Create `apps/web/src/app/session/[id]/page.tsx`:

```tsx
import SessionView from "./session-view";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SessionView sessionId={id} />;
}
```

- [ ] **Step 3: Create session view client component**

Create `apps/web/src/app/session/[id]/session-view.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useSessionEvents } from "@/hooks/use-session-events";
import NowPlaying from "@/components/session/now-playing";
import SongQueue from "@/components/session/song-queue";
import SongSearch from "@/components/session/song-search";

export default function SessionView({ sessionId }: { sessionId: string }) {
  const [sessionEnded, setSessionEnded] = useState(false);

  const queue = useQuery(trpc.queue.list.queryOptions({ sessionId }));
  const nowPlaying = useQuery(trpc.queue.nowPlaying.queryOptions({ sessionId }));
  const guestInfo = useQuery(trpc.guest.me.queryOptions());

  useSessionEvents(sessionId, {
    onVoteChanged: () => queue.refetch(),
    onSongAdded: () => queue.refetch(),
    onSongRemoved: () => queue.refetch(),
    onNowPlaying: () => {
      nowPlaying.refetch();
      queue.refetch();
    },
    onSessionEnded: () => setSessionEnded(true),
  });

  if (sessionEnded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Session Ended</h2>
          <p className="text-muted-foreground">This session has ended. Thanks for vibing!</p>
        </div>
      </div>
    );
  }

  // Extract guest's votes for highlighting
  const myVotes = new Map<string, number>();
  guestInfo.data?.votes?.forEach((v: { songId: string; value: number }) => {
    myVotes.set(v.songId, v.value);
  });

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto">
      {/* Now Playing Hero */}
      <NowPlaying song={nowPlaying.data ?? null} />

      {/* Queue */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h2 className="font-semibold text-sm text-muted-foreground mb-2">UP NEXT</h2>
        <SongQueue songs={queue.data ?? []} myVotes={myVotes} />
      </div>

      {/* Search & Add */}
      <div className="p-4 border-t">
        <SongSearch sessionId={sessionId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create now-playing component (display-only hero card)**

Create `apps/web/src/components/session/now-playing.tsx`:

```tsx
interface NowPlayingProps {
  song: {
    title: string;
    artist: string | null;
    thumbnailUrl: string | null;
    score: number;
  } | null;
}

export default function NowPlaying({ song }: NowPlayingProps) {
  if (!song) {
    return (
      <div className="p-6 text-center border-b">
        <p className="text-muted-foreground">No song playing — add one to get the vibe going!</p>
      </div>
    );
  }

  return (
    <div className="p-4 border-b">
      <div className="flex items-center gap-4">
        {song.thumbnailUrl && (
          <img
            src={song.thumbnailUrl}
            alt={song.title}
            className="w-20 h-20 rounded-lg object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Now Playing</p>
          <p className="font-bold text-lg truncate">{song.title}</p>
          {song.artist && (
            <p className="text-muted-foreground truncate">{song.artist}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create vote button component (upvote/downvote toggle)**

Create `apps/web/src/components/session/vote-button.tsx`:

```tsx
"use client";

import { useMutation } from "@tanstack/react-query";
import { ChevronUp, ChevronDown } from "lucide-react";
import { trpc, queryClient } from "@/utils/trpc";

interface VoteButtonProps {
  songId: string;
  direction: "up" | "down";
  isActive: boolean;
}

export default function VoteButton({ songId, direction, isActive }: VoteButtonProps) {
  const castVote = useMutation(
    trpc.vote.cast.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        queryClient.invalidateQueries({ queryKey: [["guest"]] });
      },
    })
  );

  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  const activeColor = direction === "up" ? "text-green-500" : "text-red-500";

  return (
    <button
      onClick={() => castVote.mutate({ songId, value: direction === "up" ? 1 : -1 })}
      disabled={castVote.isPending}
      className={`p-1 rounded transition-transform active:scale-90 ${isActive ? activeColor : "text-muted-foreground"}`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
```

- [ ] **Step 6: Create song queue component (scrollable list with vote buttons)**

Create `apps/web/src/components/session/song-queue.tsx`:

```tsx
import VoteButton from "./vote-button";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  score: number;
  suggestedBy: { displayName: string | null } | null;
}

interface SongQueueProps {
  songs: Song[];
  myVotes: Map<string, number>;
}

export default function SongQueue({ songs, myVotes }: SongQueueProps) {
  if (songs.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No songs yet — be the first to add one!
      </p>
    );
  }

  return (
    <div className="grid gap-1">
      {songs.map((song) => {
        const myVote = myVotes.get(song.id) ?? 0;
        return (
          <div key={song.id} className="flex items-center gap-3 p-3 rounded-lg border">
            {song.thumbnailUrl && (
              <img src={song.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{song.title}</p>
              {song.artist && (
                <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
              )}
            </div>
            <div className="flex flex-col items-center">
              <VoteButton songId={song.id} direction="up" isActive={myVote === 1} />
              <span className="text-sm font-bold">{song.score}</span>
              <VoteButton songId={song.id} direction="down" isActive={myVote === -1} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Create song search bottom sheet component**

Create `apps/web/src/components/session/song-search.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { Search } from "lucide-react";
import { trpc, queryClient } from "@/utils/trpc";
import { toast } from "sonner";

export default function SongSearch({ sessionId }: { sessionId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchResults = useQuery({
    ...trpc.song.search.queryOptions({ sessionId, query: debouncedQuery }),
    enabled: debouncedQuery.length > 0 && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const [suggestionsUsed, setSuggestionsUsed] = useState(0);
  const maxSuggestions = 5;

  const suggestSong = useMutation(
    trpc.song.suggest.mutationOptions({
      onSuccess: () => {
        toast.success("Song added to queue!");
        setSuggestionsUsed((prev) => prev + 1);
        queryClient.invalidateQueries();
        setIsOpen(false);
        setQuery("");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} variant="outline" className="w-full" size="lg">
        <Search className="w-4 h-4 mr-2" />
        Search & Add Songs
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="p-4 border-b flex items-center gap-2">
        <Input
          autoFocus
          placeholder="Search songs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button variant="ghost" onClick={() => { setIsOpen(false); setQuery(""); }}>
          Cancel
        </Button>
      </div>
      <div className="px-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Suggestions left: {maxSuggestions - suggestionsUsed}/{maxSuggestions}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {searchResults.isLoading && <p className="text-center text-muted-foreground">Searching...</p>}
        {searchResults.data?.tracks.map((track) => (
          <div key={track.providerId} className="flex items-center gap-3 py-3 border-b last:border-0">
            {track.thumbnailUrl && (
              <img src={track.thumbnailUrl} alt="" className="w-12 h-12 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{track.title}</p>
              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            </div>
            <Button
              size="sm"
              onClick={() => suggestSong.mutate({ providerId: track.providerId })}
              disabled={suggestSong.isPending || suggestionsUsed >= maxSuggestions}
            >
              {suggestionsUsed >= maxSuggestions ? "Limit" : "Add"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify full guest flow works end-to-end**

Test: scan QR → join → view queue → vote → suggest song → verify real-time updates across tabs.
- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/join/ apps/web/src/app/session/ apps/web/src/components/session/
git commit -m "feat: add guest join flow, session view, voting, and song suggestion UI"
```

---

## Task 13: Update Layout & Navigation

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/components/header.tsx`

- [ ] **Step 1: Update metadata**

In `apps/web/src/app/layout.tsx`, change metadata:

```typescript
export const metadata: Metadata = {
  title: "CrowdVibe — Crowd-Controlled Music",
  description: "Let the crowd control the vibe. Vote on songs in real-time at your favorite venues.",
};
```

- [ ] **Step 2: Update header navigation**

Update `apps/web/src/components/header.tsx` to remove Polar-specific links. Note: The `(venue)` route group uses parentheses, so the URL path remains `/dashboard` — the header link does NOT need a path change.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/components/header.tsx
git commit -m "feat: update layout metadata and navigation for CrowdVibe"
```

---

## Task 14: Delete Unused Scaffolding

**Files:**
- Delete: `apps/web/src/app/success/page.tsx`
- Clean up: any remaining Polar-only UI references

- [ ] **Step 1: Remove success page**

```bash
rm -rf apps/web/src/app/success/
```

- [ ] **Step 2: Clean up any remaining Polar checkout/portal UI imports**

Search for and remove any remaining references to `authClient.checkout`, `authClient.customer.portal`, or `authClient.customer.state` in non-auth files.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused Polar success page and checkout UI references"
```

---

## Task 15: End-to-End Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
cd /home/rohan/playground/crowd-vibe && npm run dev:web
```

- [ ] **Step 2: Test venue owner flow**

1. Go to `http://localhost:3001/login`, sign up
2. Go to dashboard, create a venue
3. Start a session
4. Verify QR code appears with correct join URL
5. Search for a song, add it
6. Verify YouTube player loads

- [ ] **Step 3: Test guest flow**

1. Open the join URL from the QR code in a separate browser/incognito
2. Enter a display name, join
3. Verify queue shows the owner's added song
4. Search and suggest a song
5. Upvote/downvote songs
6. Verify votes update in real-time on both owner and guest screens

- [ ] **Step 4: Test SSE real-time**

1. Open a third browser tab as another guest
2. Vote on a song
3. Verify all three tabs update simultaneously

- [ ] **Step 5: Test edge cases**

1. End session from owner dashboard → verify guests see "Session ended" overlay
2. Try joining with an invalid code → verify error message
3. Suggest 5 songs → verify 6th is rejected with limit message
4. Downvote a song below -3 → verify auto-skip

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: CrowdVibe MVP complete — crowd-controlled music for venues"
```
