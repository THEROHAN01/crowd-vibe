# CrowdVibe — Development Guide

Crowd-controlled music platform for venues. Owners start sessions, customers scan QR codes to join, and the crowd votes in real-time to decide what plays next.

## Quick Start

```bash
npm install                    # Install all workspace dependencies
npm run db:generate            # Generate Prisma client
npm run dev:web                # Start web app on port 3001
npm run dev                    # Start all workspaces in dev mode
```

## Monorepo Structure

```
apps/web              → Next.js 16 frontend (port 3001)
packages/api          → @crowd-vibe/api — tRPC routers, SSE, music providers
packages/auth         → @crowd-vibe/auth — Better-Auth config
packages/db           → @crowd-vibe/db — Prisma schema & client
packages/env          → @crowd-vibe/env — Zod-validated environment variables
packages/config       → @crowd-vibe/config — Shared TypeScript & Biome configs
packages/ui           → @crowd-vibe/ui — shadcn/ui components, Tailwind globals
```

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | ^16.1.1 |
| UI | React + React Compiler | ^19.2.3 |
| Styling | Tailwind CSS 4 + shadcn/ui | ^4.1.18 / ^3.6.2 |
| API | tRPC (fetch adapter) | ^11.7.2 |
| Database | PostgreSQL via Prisma + Neon | Prisma ^7.2.0 |
| Auth (owners) | Better-Auth (email/password + Google OAuth) | 1.5.2 |
| Auth (guests) | Browser fingerprint + HMAC-signed cookie | @fingerprintjs ^5.1.0 |
| Realtime | Server-Sent Events (SSE) | Native EventSource |
| Music | YouTube Data API v3 | — |
| State | TanStack React Query | ^5.90.12 |
| Icons | Lucide React (exclusively) | ^0.546.0 |
| Toasts | Sonner | ^2.0.5 |
| Linting | Biome | ^2.2.0 |
| Testing | Vitest | ^4.1.0 |

## Commands

### Development
```bash
npm run dev:web                # Web app only (port 3001)
npm run dev                    # All workspaces
npm run check                  # Biome format + lint (with auto-fix)
npm run check-types            # TypeScript check all workspaces
```

### Database
```bash
npm run db:generate            # Generate Prisma client
npm run db:push                # Push schema to database
npm run db:migrate             # Create and apply migration
npm run db:studio              # Open Prisma Studio GUI
```

### Testing
```bash
npm test                       # Unit tests only
npm run test:integration       # Integration tests (needs test DB)
npm run test:all               # Both unit + integration
npm run test:watch             # Watch mode (unit)
npm run test:coverage          # Coverage report
npm run test:db:up             # Start test PostgreSQL (Docker, port 5433)
npm run test:db:down           # Stop test DB
npm run test:db:reset          # Reset test DB schema
```

Tests use `.env.test` via `dotenv-cli`. Integration tests require `npm run test:db:up` first.

### Build
```bash
npm run build                  # Build all workspaces
```

## Architecture

### API Layer (tRPC)

Endpoint: `/api/trpc` — tRPC routers live in `packages/api/src/routers/`:

| Router | Purpose |
|---|---|
| `venue.ts` | Create, list, update venues |
| `session.ts` | Start/end music sessions, stats |
| `song.ts` | Search, suggest, add, remove songs |
| `vote.ts` | Cast upvotes/downvotes, auto-skip logic |
| `queue.ts` | Queue ordering, now-playing management |
| `guest.ts` | Guest join, fingerprint, cookie management |

**Procedure types** (defined in `packages/api/src/index.ts`):
- `publicProcedure` — no auth required
- `protectedProcedure` — venue owner only
- `guestProcedure` — authenticated guest only
- `authenticatedProcedure` — owner OR guest

### SSE Realtime System

Endpoint: `/api/sse/[sessionId]` — one EventSource per client per session.

**Channel Manager** (`packages/api/src/sse/channel-manager.ts`):
- In-memory `Map<sessionId, Set<SSEWriter>>`
- Max 100 subscribers per session
- Heartbeat every 30s
- Debounced `listener_changed` broadcasts (500ms) to prevent O(n²) amplification
- 60s sweep interval for empty channels

**SSE Event Types** (`packages/api/src/sse/types.ts`):
```
queue_updated    — full queue refresh
now_playing      — current song changed
vote_changed     — song score updated
song_added       — new song in queue
song_removed     — song removed/skipped
listener_changed — connected count changed (debounced)
session_ended    — session closed by owner
```

**Client hook**: `useSessionEvents(sessionId, handlers)` in `apps/web/src/hooks/use-session-events.ts`

### Database Schema

Prisma multi-file schema in `packages/db/prisma/schema/`:
- `schema.prisma` — datasource & generator config
- `auth.prisma` — User, Session, Account, Verification (Better-Auth)
- `domain.prisma` — Venue, VenueSession, GuestUser, Song, Vote

Key relationships:
```
User → Venue → VenueSession → Song → Vote
                            → GuestUser → Vote
                                        → Song (suggestions)
```

**Production**: Neon PostgreSQL (`@prisma/adapter-neon`)
**Testing**: Local PostgreSQL on port 5433 (`@prisma/adapter-pg`)

### Music Provider System

`packages/api/src/music/` — provider abstraction with YouTube implemented, Spotify stubbed.

- YouTube search: filters `videoCategoryId=10` (music), parses ISO 8601 durations
- Server-side search cache with TTL (quota protection)
- Client-side React Query cache: 5min staleTime

### Authentication

**Venue owners**: Better-Auth email/password + Google OAuth. Session via httpOnly cookies.

**Guests**: Browser fingerprint → `POST /api/guest/join` → HMAC-signed `cv_guest` cookie → `GuestUser` record. No account creation required.

## Code Conventions

### Formatting & Linting
- **Biome** — tabs, double quotes for JS/TS
- Sorted Tailwind classes enforced via `useSortedClasses` (Biome)
- Run `npm run check` to auto-fix

### Imports
```typescript
import { ... } from "@crowd-vibe/ui/components/button"  // UI package
import { ... } from "@crowd-vibe/api/..."                // API package
import prisma from "@crowd-vibe/db"                      // Database
import { env } from "@crowd-vibe/env/server"             // Server env
import { ... } from "@/components/..."                   // Web app (@ = src/)
```

### Component Patterns
- Icons: **Lucide React only** — no emojis in UI
- Toasts: `toast.success()` / `toast.error()` from sonner
- Mutations: always include `onError` with `toast.error(err.message)`
- Cache invalidation: `queryClient.invalidateQueries()` on mutation success
- SSE updates: prefer `queryClient.setQueryData()` over `refetch()` for realtime events

### Styling
- Tailwind CSS 4 with custom OKLch color tokens
- Dark mode default (`next-themes`, attribute="class")
- Functional color tokens: `--upvote`, `--downvote`, `--now-playing`, `--score-*`
- Motion tokens: `--ease-standard`, `--ease-spring`, `--duration-*`
- Breakpoints: mobile (0-639px), tablet (640-1023px), desktop (1024px+)
- `max-w-lg` for guest session view, `max-w-4xl` for dashboard, `max-w-sm` for auth forms

### Flex Row Overflow Pattern
All thumbnail+text+action flex rows must use:
1. `overflow-hidden` on the flex container
2. `shrink-0` on fixed-size elements (thumbnails, vote buttons)
3. `min-w-0 flex-1` on the text column + `truncate` on text

### Accessibility
- WCAG AA minimum (4.5:1 contrast)
- Touch targets: 44x44px minimum
- `aria-live="polite"` on queue container and now-playing
- `role="status"` only on realtime-updating stat cards (opt-in via `live` prop)
- `aria-hidden="true"` on decorative icons
- `prefers-reduced-motion` respected

### Error Handling
- tRPC: `throw new TRPCError({ code: "...", message: "user-facing message" })`
- Client: `QueryCache.onError` catches query failures with toast + retry
- Mutation errors: handled per-mutation with `onError: (err) => toast.error(err.message)`

### Rate Limiting
- 5 song suggestions per guest per session
- 30s cooldown between suggestions
- 1 vote per guest per song (DB unique constraint)
- 10 searches per minute per guest
- 3 session joins per minute per IP

## Environment Variables

### Required
```
DATABASE_URL          — PostgreSQL connection string
BETTER_AUTH_SECRET    — Min 32 characters, used for cookie signing
BETTER_AUTH_URL       — Auth base URL (e.g., http://localhost:3001)
YOUTUBE_API_KEY       — YouTube Data API v3 key
CORS_ORIGIN           — Allowed CORS origin
```

### Optional
```
GOOGLE_CLIENT_ID      — Google OAuth (enables social login)
GOOGLE_CLIENT_SECRET  — Google OAuth
POLAR_ACCESS_TOKEN    — Polar payment integration
POLAR_SUCCESS_URL     — Payment callback URL
NODE_ENV              — development | production | test
```

## Key File Locations

### API
- `packages/api/src/index.ts` — tRPC setup, procedure definitions
- `packages/api/src/context.ts` — Request context (auth resolution)
- `packages/api/src/routers/` — All API routers
- `packages/api/src/sse/channel-manager.ts` — SSE broadcasting
- `packages/api/src/music/` — Music provider abstraction

### Web App
- `apps/web/src/app/` — Next.js App Router pages
- `apps/web/src/app/api/sse/[sessionId]/route.ts` — SSE endpoint
- `apps/web/src/app/api/trpc/[trpc]/route.ts` — tRPC endpoint
- `apps/web/src/components/` — React components
- `apps/web/src/hooks/use-session-events.ts` — SSE client hook
- `apps/web/src/utils/trpc.ts` — tRPC client + QueryClient
- `apps/web/src/middleware.ts` — Security headers

### Config
- `biome.json` — Linter/formatter rules
- `vitest.config.ts` — Test configuration (unit + integration projects)
- `packages/db/prisma/schema/` — Multi-file Prisma schema
- `packages/ui/src/styles/globals.css` — Tailwind theme + color tokens

## Testing Conventions

- **Unit tests**: `*.test.ts` in `packages/api/src/` — run in parallel
- **Integration tests**: `*.integration.test.ts` — run serially, need test DB
- Test DB: Docker PostgreSQL on port 5433 (`npm run test:db:up`)
- Global setup validates DB name contains "crowdvibe_test" (safety check)
- Test helpers in `packages/api/test/helpers/` (contexts, fixtures, DB utils)
- Use `vi.useFakeTimers()` scoped to describe blocks for timer-dependent tests

## Git Conventions

- Commit style: `type: description` (feat, fix, refactor, test, docs)
- Do not add co-author lines to commits
- Run review agents before committing during plan execution (3 minimum)
