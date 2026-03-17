# CrowdVibe MVP — Design Specification

## Problem Statement

In public venues (cafes, hotels, coworking spaces, lounges, restaurants), background music is controlled by a single authority — staff, a DJ, or a static playlist. This creates a disconnect between the music playing and the preferences of the people actually present. Customers have no way to influence what plays, staff waste time on manual requests, and the vibe becomes stale and impersonal.

**CrowdVibe solves this by letting the crowd collectively control the music through voting.**

## Product Overview

CrowdVibe is a web-based platform where venues create live music sessions and customers join via QR code to vote on, suggest, and collectively shape the playlist in real time. The system dynamically reorders the queue based on crowd votes — the music reflects the mood of the people present.

### Target Users

- **Venue owners/staff** — cafes, bars, coworking spaces, restaurants, lounges
- **Venue customers** — anyone physically present who wants to influence the music

### MVP Goal

Validate one hypothesis: **Do people actually interact with crowd voting for music in a physical venue?**

### MVP Scope

- Venue creates a session
- Customers join via QR code (no sign-up)
- Customers see the playlist, upvote/downvote, suggest songs
- System reorders queue by votes
- Music plays via YouTube (with Spotify-ready abstraction)

### Non-Goals for MVP

- Payment systems / credit economy (the existing Polar plugin stays in auth config but is unused — no payment routes or UI will be built)
- Advanced recommendation algorithms / AI music selection
- Complex moderation systems (blocklists, genre filters, profanity filters)
- Multi-venue management UI (data model supports multiple venues per owner for forward compatibility, but MVP UI shows a simple list — no multi-venue dashboard)
- Seed playlists / pre-loaded queues
- Analytics dashboard beyond live stats

---

## Reference Analysis: Crowdify

[github.com/Fahad-Dezloper/Crowdify](https://github.com/Fahad-Dezloper/Crowdify) is an open-source project with a similar concept. CrowdVibe improves on it in every dimension:

| Area | Crowdify | CrowdVibe |
|---|---|---|
| Access | Google OAuth required | QR code, no sign-up |
| Music source | YouTube (with ads, video UI) | YouTube MVP + Spotify-ready abstraction |
| Architecture | Split frontend + separate Node.js backend | Single Next.js monorepo with tRPC |
| Real-time | Separate WebSocket server + Redis | SSE from same server process |
| Song discovery | Paste raw YouTube URL | In-app search with cached results |
| Voting | Upvote only | Upvote + downvote + fairness constraints |
| Target user | Generic (anyone creates rooms) | Venue-first (owner vs. customer roles) |
| Mobile | Desktop-oriented sidebar layout | Mobile-first customer experience |
| Sessions | Permanent rooms | Time-bound venue sessions |
| Moderation | None | Rate limiting, suggestion caps, owner controls |

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      CLIENTS                              │
│                                                           │
│  ┌──────────────┐     ┌──────────────────────────────┐    │
│  │ Venue Owner  │     │ Venue Customers (mobile)     │    │
│  │ (dashboard)  │     │ join via QR / link            │    │
│  │ Auth required│     │ Guest access (no sign-up)     │    │
│  └──────┬───────┘     └──────────────┬────────────────┘   │
└─────────┼────────────────────────────┼────────────────────┘
          │                            │
          │  tRPC mutations/queries    │  tRPC mutations + SSE stream
          │                            │
┌─────────┼────────────────────────────┼────────────────────┐
│         ▼          NEXT.JS APP       ▼                    │
│  ┌──────────────────────────────────────────────────┐     │
│  │               tRPC Router Layer                   │     │
│  │  venue.*  │  session.*  │  queue.*  │  vote.*     │     │
│  └──────────────────────┬────────────────────────────┘     │
│                         │                                  │
│  ┌──────────────────────▼────────────────────────────┐     │
│  │            Business Logic Layer                    │     │
│  │  QueueManager  │  VoteEngine  │  SessionManager    │    │
│  └──────────────────────┬────────────────────────────┘     │
│                         │                                  │
│  ┌──────────────────────▼────────────────────────────┐     │
│  │          Music Provider Abstraction                │     │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐       │    │
│  │  │ YouTube  │   │ Spotify  │   │ Future   │       │    │
│  │  │ Provider │   │ Provider │   │ Provider │       │    │
│  │  └──────────┘   └──────────┘   └──────────┘       │    │
│  └────────────────────────────────────────────────────┘    │
│                         │                                  │
│  ┌──────────────────────▼────────────────────────────┐     │
│  │          SSE Broadcast Layer                       │     │
│  │  Per-session event channels                        │     │
│  │  Events: queue_update, now_playing, vote_change    │     │
│  └────────────────────────────────────────────────────┘    │
│                         │                                  │
│  ┌──────────────────────▼────────────────────────────┐     │
│  │          Prisma + Neon PostgreSQL                  │     │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

### Key Decisions

- **Single Next.js deployment** — no separate backend process. tRPC handles API, SSE handles push.
- **Two user types, one app** — venue owners use Better-Auth (email/password). Customers use frictionless guest sessions.
- **SSE per session** — each venue session has its own event channel. Only connected clients receive updates.
- **Music provider is pluggable** — YouTube for MVP, Spotify ready to swap in via provider interface.

---

## 2. Data Model

Extends the existing Better-Auth tables (User, Account, Session, Verification). The `User` model requires a `venues Venue[]` back-relation to be added — this is safe with Better-Auth's Prisma adapter, which allows additional fields/relations on its managed models.

**Naming note:** Throughout this spec, "session" in the domain context always refers to `VenueSession` (a time-bound music session at a venue). Better-Auth's `Session` model (for authentication) is referred to as "auth session" when disambiguation is needed.

### Venue

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
}
```

A Venue is a permanent entity (e.g., "Blue Tokai Koramangala"). It persists across sessions.

- `slug` — URL-friendly identifier, unique across the platform
- `settings` — Json field for venue-level configuration (max suggestions, cooldowns, thresholds). Avoids schema migrations for new settings.

### VenueSession

```prisma
model VenueSession {
  id            String   @id @default(cuid())
  venueId       String
  venue         Venue    @relation(fields: [venueId], references: [id], onDelete: Cascade)
  name          String?
  musicProvider String   @default("youtube")
  isActive      Boolean  @default(true)
  joinCode      String   @unique
  startedAt     DateTime @default(now())
  endedAt       DateTime?

  songs         Song[]
  guests        GuestUser[]
}
```

A VenueSession is time-bound — one per evening, clean slate each time. History available to venue owner.

- `joinCode` — 6-character alphanumeric code (A-Z, 2-9 — excludes ambiguous characters O/0/I/1/L). Generated randomly on session start. Uniqueness enforced by DB constraint; regenerated on collision. Example: "V7KX3R".
- `musicProvider` — determines which provider implementation is used for this session

### GuestUser

```prisma
model GuestUser {
  id            String   @id @default(cuid())
  sessionId     String
  session       VenueSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  displayName   String?
  fingerprint   String
  createdAt     DateTime @default(now())

  votes         Vote[]
  suggestions   Song[]   @relation("SuggestedBy")

  @@unique([sessionId, fingerprint])
}
```

Lightweight identity for venue customers. No email, no password, no OAuth.

- `fingerprint` — browser fingerprint via FingerprintJS for dedup
- `@@unique([sessionId, fingerprint])` — same phone rejoining gets the same identity (votes preserved)
- Scoped to a single session. No cross-session tracking.

### Song

```prisma
model Song {
  id            String   @id @default(cuid())
  sessionId     String
  session       VenueSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  providerId    String
  provider      String   @default("youtube")
  title         String
  artist        String?
  thumbnailUrl  String?
  durationMs    Int?
  status        String   @default("queued")
  score         Int      @default(0)
  addedAt       DateTime @default(now())
  playedAt      DateTime?
  suggestedById String?
  suggestedBy   GuestUser? @relation("SuggestedBy", fields: [suggestedById], references: [id])

  votes         Vote[]

  @@index([sessionId, status, score])
}
```

- `providerId` — YouTube video ID or Spotify track ID
- `status` — `"queued"` | `"playing"` | `"played"` | `"skipped"`
- `score` — denormalized net vote score for fast queue ordering. Updated atomically in a transaction.
- `@@index([sessionId, status, score])` — optimized for the primary query: "get queued songs ordered by score"

### Vote

```prisma
model Vote {
  id        String   @id @default(cuid())
  songId    String
  song      Song     @relation(fields: [songId], references: [id], onDelete: Cascade)
  guestId   String
  guest     GuestUser @relation(fields: [guestId], references: [id], onDelete: Cascade)
  value     Int
  createdAt DateTime @default(now())

  @@unique([songId, guestId])
}
```

- `value` — `+1` (upvote) or `-1` (downvote)
- `@@unique([songId, guestId])` — one vote per guest per song, enforced at DB level

---

## 3. Music Provider Abstraction

### Interface

```typescript
interface MusicTrack {
  providerId: string
  provider: "youtube" | "spotify"
  title: string
  artist: string | null
  thumbnailUrl: string | null
  durationMs: number | null
}

interface SearchResult {
  tracks: MusicTrack[]
  nextPageToken?: string
}

interface PlayerData {
  type: "youtube" | "spotify"
  embedUrl?: string
  trackUri?: string
  providerId: string
}

interface MusicProvider {
  search(query: string, limit?: number): Promise<SearchResult>
  getTrack(providerId: string): Promise<MusicTrack | null>
  getPlayerData(providerId: string): PlayerData
  validate(providerId: string): Promise<boolean>
}
```

### Provider Implementations

```
packages/api/
  src/
    music/
      types.ts              ← MusicTrack, SearchResult, PlayerData, MusicProvider interface
      providers/
        youtube.ts          ← YouTube Data API v3 implementation (MVP)
        spotify.ts          ← Spotify Web API implementation (stub/future)
      search-cache.ts       ← Server-side search result cache
      index.ts              ← getMusicProvider(type) factory function
```

The music provider logic lives inside `packages/api` rather than a separate package, since it's small for MVP and avoids workspace configuration overhead. It can be extracted into `@crowd-vibe/music` later if it grows.

- `YouTubeProvider` — uses YouTube Data API v3. Search costs 100 quota units (10,000/day default).
- `SpotifyProvider` — stub for MVP. Returns "not implemented" errors. Ready for implementation when a venue wants Spotify.
- `getMusicProvider(session.musicProvider)` — factory resolves the correct implementation at runtime.

### Frontend Player Abstraction

```tsx
{playerData.type === "youtube" && <YouTubePlayer data={playerData} />}
{playerData.type === "spotify" && <SpotifyPlayer data={playerData} />}
```

Each player component handles its own embed/SDK integration. The parent component only deals with `PlayerData`.

### Search Caching (Two Layers)

**Server-side cache (critical for YouTube API quota):** An in-memory cache keyed by `[provider, query]` with a 15-minute TTL. When 20 guests search "drake", only the first request hits YouTube API. All subsequent requests within 15 minutes return the cached result. This is essential — without it, the 10,000 units/day YouTube quota (~100 searches) would be exhausted in minutes at a busy venue.

**Client-side cache:** React Query with `staleTime: 5 minutes`. Cache key: `[provider, query, page]`. Same query on the same phone returns cached results instantly without any network request. React Query deduplicates concurrent identical searches into a single API call.

---

## 4. Real-Time System (SSE)

### Event Types

```typescript
type SSEEvent =
  | { type: "queue_updated";  data: { songs: QueuedSong[] } }
  | { type: "now_playing";    data: { song: QueuedSong | null } }
  | { type: "vote_changed";   data: { songId: string; score: number } }
  | { type: "song_added";     data: { song: QueuedSong } }
  | { type: "song_removed";   data: { songId: string } }
  | { type: "session_ended";  data: {} }
```

### Server: Channel Manager

```typescript
class SSEChannelManager {
  private channels: Map<string, Set<WritableStream>>

  subscribe(sessionId: string, stream: WritableStream): void
  unsubscribe(sessionId: string, stream: WritableStream): void
  broadcast(sessionId: string, event: SSEEvent): void
  getListenerCount(sessionId: string): number
}
```

Singleton in the server process. All tRPC routes access the same instance. After any mutation that changes queue state, the relevant event is broadcast to all connected clients in that session.

**Deployment constraint:** The SSE channel manager requires that the tRPC route handler and the SSE route handler share the same Node.js process. This means:
- The app must run as a **single long-lived Node.js process** (not serverless functions)
- The SSE route must export `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`
- This rules out Vercel's default serverless deployment for MVP. The app should be deployed on a VPS (e.g., Railway, Fly.io, DigitalOcean) or run locally with `next start`
- The channel manager is instantiated as a module-level singleton (via `globalThis` to survive HMR in development)

### SSE Endpoint

```
GET /api/sse/[sessionId]
Content-Type: text/event-stream
```

**Authentication:** The SSE endpoint validates that the connecting client has either (a) a valid `cv_guest` cookie linked to the requested session, or (b) a valid Better-Auth session for the venue owner of that session. Unauthenticated connections are rejected with 401. This prevents arbitrary access by session ID guessing.

Subscribes the response stream to the channel manager. Sends heartbeats every 30 seconds to prevent timeout.

### Client: Event Hook

```typescript
function useSessionEvents(sessionId: string, handlers: {
  onQueueUpdated?: (songs: QueuedSong[]) => void
  onNowPlaying?: (song: QueuedSong | null) => void
  onVoteChanged?: (songId: string, score: number) => void
  onSongAdded?: (song: QueuedSong) => void
  onSongRemoved?: (songId: string) => void
  onSessionEnded?: () => void
})
```

Creates an `EventSource` connection. Auto-reconnects on disconnect. On reconnect, fetches full queue state via `queue.list` to catch up on missed events. Cleans up on component unmount.

### Flow Example: Voting

```
Customer taps upvote
  → tRPC mutation: vote.cast({ songId, value: +1 })
  → Server: reads guestId from ctx (cv_guest cookie)
  → Server: upserts Vote, recalculates Song.score in transaction
  → Server: channelManager.broadcast(sessionId, { type: "vote_changed", ... })
  → SSE pushes to all connected clients
  → Every phone's queue UI updates instantly
```

---

## 5. API Layer (tRPC Routers)

### Router Structure

Four procedure types:
- **`protectedProcedure`** — requires Better-Auth session (`ctx.type === "owner"`)
- **`guestProcedure`** — requires valid `cv_guest` cookie (`ctx.type === "guest"`). Reads `guestId` from context, never from user input.
- **`authenticatedProcedure`** — requires either owner or guest auth (`ctx.type !== "anonymous"`). Used for endpoints both user types need (queue viewing, song search).
- **`publicProcedure`** — no auth required

```
appRouter
├── venue
│   ├── create          (protected)   // owner creates a venue
│   ├── update          (protected)   // update name, logo, settings
│   ├── getBySlug       (public)      // fetch venue info by slug
│   └── listMine        (protected)   // owner sees their venues
│
├── session
│   ├── start           (protected)   // owner starts a new session
│   ├── end             (protected)   // owner ends the session
│   ├── getByJoinCode   (public)      // returns venue name, session name, listener count (NOT sessionId)
│   ├── getActive       (public)      // get active session for a venue
│   └── stats           (protected)   // listener count, votes, songs played
│
├── guest
│   ├── join            (public)      // create GuestUser from fingerprint
│   └── me              (guest)       // get current guest's info + votes
│
├── queue
│   ├── list            (authenticated)  // ordered queue (guest or owner)
│   ├── nowPlaying      (authenticated)  // currently playing (guest or owner)
│   ├── next            (protected)      // owner triggers next song
│   └── skip            (protected)      // owner force-skips current song
│
├── song
│   ├── search          (authenticated)  // search via music provider (guest or owner)
│   ├── suggest         (guest)          // guest suggests a song
│   ├── add             (protected)      // owner adds a song (no rate limits)
│   └── remove          (protected)   // owner removes a song
│
└── vote
    └── cast            (guest)       // guest upvotes/downvotes
```

### Key Procedure Details

**`guest.join`**
```
Input:  { joinCode, fingerprint, displayName? }
Output: { sessionId, venueName, displayName }
```
Upserts GuestUser by `[sessionId, fingerprint]`. Sets `cv_guest` httpOnly cookie (guestId is in the cookie, not exposed in the response). Returns the session ID for redirect and the confirmed display name. No sign-up flow.

**`song.suggest`** (guest procedure — `guestId` read from `ctx.guestId`, never from input)
```
Input:  { sessionId, providerId }
Flow:   1. Check suggestion count < venue max (default 5)
        2. Check cooldown (default 30s since last suggestion)
        3. Check duplicate providerId in session
        4. Fetch track metadata via musicProvider.getTrack()
        5. Create Song with status "queued", score 0
        6. Auto-upvote by suggester (+1)
        7. Broadcast "song_added" via SSE
```

**`song.add`** (protected procedure — venue owner adds songs, no rate limits)
```
Input:  { sessionId, providerId }
Flow:   1. Verify owner owns the venue for this session
        2. Fetch track metadata via musicProvider.getTrack()
        3. Create Song with status "queued", score 0
        4. Broadcast "song_added" via SSE
```
This allows the venue owner to seed the queue at the start of a session before guests arrive. Owner-added songs start at score 0 (no auto-upvote since the owner has no GuestUser record). This is intentional — owner-seeded songs provide a starting baseline, and the crowd's votes determine what rises above them. The owner can always use "Skip" or "Next" to force playback if needed.

**`vote.cast`** (guest procedure — `guestId` read from `ctx.guestId`, never from input)
```
Input:  { songId, value: 1 | -1 }
Flow:   1. Lookup existing vote for guest+song
        2. Same value exists → remove vote (toggle off)
        3. Opposite value → update to new value
        4. No vote → create vote
        5. Recalculate song.score = SUM(votes.value) in transaction
        6. Broadcast "vote_changed" via SSE
        7. If song status is "playing" and song.score <= downvoteSkipThreshold,
           mark song as "skipped" and call queue.next logic to advance
        8. If song status is "queued" and song.score <= downvoteSkipThreshold,
           mark song as "skipped" and broadcast "song_removed"
```

**`queue.next`**
```
Flow:   1. Mark current "playing" song as "played"
        2. Select next: highest score among "queued", tiebreak by addedAt ASC
        3. Mark as "playing", set playedAt
        4. Broadcast "now_playing" via SSE
        5. Return PlayerData
```

### Auth Context

The existing `createContext` must be rewritten to return a discriminated union type:

```typescript
type Context =
  | { type: "owner"; user: User; session: AuthSession }
  | { type: "guest"; guestId: string; guestSessionId: string }
  | { type: "anonymous" }

async function createContext({ req }: { req: NextRequest }): Promise<Context> {
  // Try Better-Auth first (venue owner)
  const authSession = await auth.api.getSession({ headers: req.headers })
  if (authSession) return { type: "owner", user: authSession.user, session: authSession.session }

  // Fall back to guest cookie (HMAC-signed)
  const rawCookie = req.cookies.get("cv_guest")?.value
  if (rawCookie) {
    const guestId = verifySignedCookie(rawCookie, env.BETTER_AUTH_SECRET)
    if (guestId) {
      // Look up guest to get their sessionId for cross-session validation
      const guest = await db.guestUser.findUnique({ where: { id: guestId } })
      if (guest) return { type: "guest", guestId, guestSessionId: guest.sessionId }
    }
  }

  // Unauthenticated
  return { type: "anonymous" }
}
```

Three context types. Protected procedures require `type: "owner"`. Guest procedures require `type: "guest"` (guestId and guestSessionId available on ctx). Public procedures work for all.

The `guestProcedure` middleware:
```typescript
const guestProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (ctx.type !== "guest" || !ctx.guestId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { ...ctx, guestId: ctx.guestId, guestSessionId: ctx.guestSessionId } })
})
```

**Cross-session validation:** The `guestSessionId` from context is used to validate that the guest belongs to the session they're acting on. For `song.suggest`, the procedure checks `ctx.guestSessionId === input.sessionId`. For `vote.cast`, the procedure resolves the song's `sessionId` and checks `ctx.guestSessionId === song.sessionId`. This prevents a guest with a valid cookie for session A from injecting songs or votes into session B.

---

## 6. Guest Access & Authentication

### Venue Owners

Existing Better-Auth flow (email/password). No changes needed. Gates venue creation, session management, moderation.

### Venue Customers

```
Scan QR → crowdvibe.app/join/V7KX3R
  → Landing page: venue name + "Join the Vibe"
  → Optional display name input
  → Tap "Join"
  → FingerprintJS generates browser fingerprint
  → guest.join({ joinCode, fingerprint, displayName })
  → Server sets httpOnly cookie: cv_guest=<guestId>
  → Redirect to /session/[sessionId]
```

No sign-up. No email. No OAuth. One tap.

### Fingerprint Strategy

- **Library:** @fingerprintjs/fingerprintjs (open-source version)
- **Generates from:** canvas, fonts, screen resolution, WebGL, timezone, etc.
- **Scoped to session:** `@@unique([sessionId, fingerprint])` — same phone = same GuestUser within a session
- **Cross-session:** different GuestUser records. No tracking across sessions.
- **Cookie:** `cv_guest`, httpOnly, sameSite strict, expires after 24 hours. The cookie value is HMAC-signed: `cv_guest=<guestId>.<hmac_signature>` using `BETTER_AUTH_SECRET` as the signing key. On every `guestProcedure` call, the server verifies the HMAC before trusting the guestId. This prevents cookie forgery — a user cannot impersonate another guest by guessing their CUID.
- **Not bulletproof:** incognito windows get different fingerprints. But the effort-to-impact ratio (new incognito tab to get 5 more suggestions) makes abuse impractical in a casual venue setting.

---

## 7. Queue Logic & Fairness

### Ordering Algorithm

```
Next song = FROM songs WHERE status = "queued"
            ORDER BY score DESC, addedAt ASC
```

Highest votes win. Ties broken by first-suggested. Simple, transparent, predictable.

### Song Advancement Triggers

1. **Auto-advance** — the YouTube player embed runs ONLY on the venue owner's dashboard. When the song ends, the dashboard's player fires `onEnded` and calls `queue.next`. Customers do NOT have a playable embed — they see a display-only "Now Playing" card (thumbnail, title, artist).
2. **Manual skip** — venue owner taps "Skip" on dashboard

No server-side duration tracking. The owner's dashboard player is the single source of truth for playback state. If the dashboard tab closes mid-song, the owner must reopen it and manually skip to resume.

### Fairness Constraints

| Rule | Default | Mechanism |
|---|---|---|
| Max suggestions per guest | 5 per session | Application-level check in `song.suggest` |
| Suggestion cooldown | 30 seconds | Timestamp check against last suggestion |
| One vote per guest per song | Enforced always | `@@unique([songId, guestId])` at DB level |
| No self-vote stacking | 1 auto-upvote | Same constraint as everyone else |
| Auto-skip on downvote threshold | Score < -3 | Checked after each vote recalculation |

### Vote Recalculation

Atomic transaction: upsert vote, aggregate all votes for the song, update song.score. Broadcast outside the transaction.

### Empty Queue

When no queued songs remain, `now_playing` broadcasts `null`. Player shows idle state with QR code: "Add songs to get the vibe going!"

---

## 8. Venue Management & Dashboard

### Venue Onboarding

```
Sign up → Dashboard → "Create Your Venue"
  → Name, slug (auto-generated, editable), logo (optional)
  → Venue created → "Start Session" button
```

### Starting a Session

```
"Start Session" → optional name → select provider (YouTube; Spotify greyed "Coming Soon")
  → joinCode auto-generated (e.g., "V7KX3R")
  → QR code auto-generated
  → Dashboard switches to live session view
```

### Live Session Dashboard

The venue owner sees:

- **Now Playing** — current song with skip button and score
- **Queue** — ordered list with remove [x] button per song
- **Live stats** — listener count, songs played count
- **QR code** — displayed for screen-sharing/printing, with download and copy-link buttons

### Owner Capabilities

| Action | Effect |
|---|---|
| Skip | Force-skip current song, advance to next |
| Remove song | Remove from queue, broadcast `song_removed` |
| End session | Mark inactive, set `endedAt`, disconnect all guests via SSE `session_ended` event. All data (songs, votes, guests) is preserved for historical review. SSE endpoint returns 410 Gone for ended sessions. |
| Download QR | PNG download for printing on tables |
| Copy link | Copy join URL to clipboard |

### Venue Settings

Stored in `settings` Json field. Hardcoded defaults for MVP:

```json
{
  "maxSuggestionsPerGuest": 5,
  "suggestionCooldownSec": 30,
  "downvoteSkipThreshold": -3,
  "allowExplicitContent": true
}
```

Settings UI is a post-MVP feature. Changing defaults requires a code change for now.

Settings are parsed at read time with a Zod schema that provides defaults:
```typescript
const VenueSettingsSchema = z.object({
  maxSuggestionsPerGuest: z.number().default(5),
  suggestionCooldownSec: z.number().default(30),
  downvoteSkipThreshold: z.number().default(-3),
  allowExplicitContent: z.boolean().default(true),
})
```
This ensures missing or malformed keys fall back to safe defaults rather than crashing.

---

## 9. Customer Experience (Mobile-First)

### Join Screen

```
crowdvibe.app/join/V7KX3R

  Blue Tokai Koramangala
  "Friday Night Vibes"

  [Your name (optional)]
  [Join the Vibe]

  23 people vibing now
```

### Main Session View

- **Now Playing (hero)** — large thumbnail/album art, song title, artist (no progress bar — playback runs on the owner's dashboard, not on customer devices)
- **Up Next (queue)** — scrollable list, each song shows title, artist, score, upvote/downvote buttons
- **Search & Add (bottom)** — button opens bottom sheet with search input and results

### Interaction Details

| Element | Behavior |
|---|---|
| Upvote (▲) | Toggle. Green when active. Score updates via SSE. |
| Downvote (▼) | Toggle. Red when active. Mutually exclusive with upvote on same song. |
| Score | Net score. Live updates. Queue visibly reorders with animation. |
| Search & Add | Bottom sheet. Debounced search (300ms). Cached results (5min staleTime). |
| Add button | Calls `song.suggest`. Song appears in queue at scored position. Shows "Suggestions left: X/5". |

### Edge Cases

| Scenario | Behavior |
|---|---|
| Session ends | "This session has ended" overlay. Interactions disabled. |
| Empty queue | "No songs yet — be the first to add one!" with prominent search. |
| Duplicate suggestion | Error: "This song is already in the queue — vote for it instead!" |
| Guest rejoins (same phone) | Fingerprint match → same GuestUser. Votes restored. |
| Slow/lost connection | SSE auto-reconnects. On reconnect, full queue fetch via `queue.list`. |

---

## 10. Moderation & Abuse Prevention

### Rate Limits (Server-Enforced)

| Action | Limit | Scope |
|---|---|---|
| Song suggestions | Max 5 per session | Per guest |
| Suggestion cooldown | 30s between suggestions | Per guest |
| Vote casting | 1 per song | Per guest (DB enforced) |
| Search requests | 10 per minute | Per guest |
| Guest join | 3 per minute | Per IP |

**Implementation:** Rate limits for search and join use an in-memory `Map<string, { count: number, resetAt: number }>` keyed by guestId (for search) or IP (for join). Suggestion count and cooldown are derived from database queries (count of songs by guestId in session, timestamp of last suggestion). The in-memory rate limiter resets on server restart, which is acceptable for MVP.

### Anti-Gaming

| Attack | Defense |
|---|---|
| Multiple tabs | Fingerprint dedup — same browser = same GuestUser |
| Incognito window | New fingerprint, but still limited to 5 suggestions + 1 vote/song |
| Bot flooding | Rate limiting + search rate limiting |
| Offensive songs | Venue owner removes via dashboard (human moderation) |
| Mass downvoting | Each guest gets one downvote per song — one troll is noise against genuine votes |

### Venue Owner Overrides

- Remove any song instantly
- Skip current song
- End session (disconnects everyone)

### Not in MVP

- Profanity/content filters
- Guest banning
- Song blocklists
- Reporting mechanism
- Automated content scanning

**Philosophy:** In a 30-person cafe, social dynamics are the best moderation. The crowd downvotes bad songs. The owner removes offensive ones. Complex automation is a V2 concern.

---

## 11. QR Code Generation

QR codes are generated **client-side** using `qrcode.react`. The QR encodes the join URL: `{ORIGIN}/join/{joinCode}`. No `qrCode` field is stored in the database — it's derived from the `joinCode` at render time.

For the "Download QR" feature, the QR is rendered to a canvas element and exported as PNG via `canvas.toDataURL()`.

---

## 12. YouTube Integration: Known Limitations

The YouTube IFrame embed has limitations that are acceptable for MVP but should be understood:

- **Ads:** YouTube embeds may show pre-roll ads on non-Premium accounts. The venue should use a YouTube Premium-signed-in browser to avoid this. This is a known UX tradeoff for MVP.
- **Tab must stay active:** The owner's dashboard tab with the YouTube embed must remain open and focused for playback to continue. Minimizing/backgrounding may pause playback.
- **Video UI:** The embed shows video, not audio-only. This is acceptable — the venue can display it on a screen, or the owner can minimize the visual.
- **Commercial use:** YouTube's Terms of Service do not explicitly permit background music playback in commercial venues via embeds. For MVP validation in a single venue, this is acceptable. Spotify integration (with proper commercial licensing) is the intended long-term solution.

---

## 13. Error Handling

### Principles

- All tRPC errors use standard error codes: `NOT_FOUND`, `FORBIDDEN`, `TOO_MANY_REQUESTS`, `BAD_REQUEST`, `UNAUTHORIZED`, `INTERNAL_SERVER_ERROR`
- The client shows toast notifications (via Sonner, already installed) for user-facing errors
- Errors are descriptive: "You've used all 5 song suggestions" not "Rate limit exceeded"

### Specific Error Scenarios

| Scenario | Error Code | User-Facing Message |
|---|---|---|
| YouTube API down/rate-limited | `INTERNAL_SERVER_ERROR` | "Search is temporarily unavailable. Try again in a moment." (returns empty results, does not crash) |
| Vote transaction fails | Retry once, then `INTERNAL_SERVER_ERROR` | "Couldn't register your vote. Tap to try again." |
| Session not found | `NOT_FOUND` | "This session doesn't exist or has ended." |
| Suggestion limit reached | `TOO_MANY_REQUESTS` | "You've used all 5 song suggestions for this session." |
| Suggestion cooldown active | `TOO_MANY_REQUESTS` | "Wait a few seconds before suggesting another song." |
| Duplicate song in queue | `BAD_REQUEST` | "This song is already in the queue — vote for it instead!" |
| Invalid join code | `NOT_FOUND` | "No active session found for this code." |
| Network error (client-side) | N/A | Toast: "Connection lost. Reconnecting..." (SSE auto-reconnects) |

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TailwindCSS 4 |
| Backend | Self-hosted in Next.js, tRPC 11 |
| Auth (owners) | Better-Auth (email/password) |
| Auth (guests) | @fingerprintjs/fingerprintjs v4 + HMAC-signed httpOnly cookie |
| Database | PostgreSQL via Neon, Prisma 7 |
| Real-time | Server-Sent Events (SSE) |
| Music (MVP) | YouTube Data API v3 (requires `YOUTUBE_API_KEY` env var — must be added to `packages/env/src/server.ts` validation) |
| Music (future) | Spotify Web API + Web Playback SDK |
| UI components | shadcn/ui, Lucide icons, qrcode.react |
| Dev tools | Biome, TypeScript 5 |

---

## Package Structure

```
crowd-vibe/
├── apps/
│   └── web/                    # Next.js application
│       └── src/
│           ├── app/
│           │   ├── (venue)/         # Venue owner pages (auth required) — migrated from existing app/dashboard/
│           │   │   ├── dashboard/
│           │   │   └── venue/[slug]/
│           │   ├── join/[joinCode]/ # Guest join page
│           │   ├── session/[id]/    # Guest session view
│           │   ├── api/
│           │   │   ├── trpc/[trpc]/ # tRPC endpoint
│           │   │   ├── auth/[...all]/ # Better-Auth endpoint
│           │   │   └── sse/[sessionId]/ # SSE endpoint
│           │   └── login/
│           ├── components/
│           │   ├── venue/           # Dashboard components
│           │   ├── session/         # Customer session components
│           │   └── player/          # YouTubePlayer, SpotifyPlayer
│           └── hooks/
│               ├── use-session-events.ts
│               └── use-guest.ts
├── packages/
│   ├── api/                    # tRPC routers + business logic
│   │   └── src/
│   │       ├── routers/
│   │       │   ├── venue.ts
│   │       │   ├── session.ts
│   │       │   ├── guest.ts
│   │       │   ├── queue.ts
│   │       │   ├── song.ts
│   │       │   └── vote.ts
│   │       ├── music/
│   │       │   ├── types.ts
│   │       │   ├── providers/
│   │       │   │   ├── youtube.ts
│   │       │   │   └── spotify.ts
│   │       │   ├── search-cache.ts
│   │       │   └── index.ts
│   │       ├── sse/
│   │       │   └── channel-manager.ts
│   │       └── context.ts
│   ├── db/                     # Prisma schema + client
│   ├── auth/                   # Better-Auth config
│   ├── ui/                     # Shared shadcn components
│   └── env/                    # Environment validation
```
