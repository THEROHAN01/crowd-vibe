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

- Payment systems / credit economy
- Advanced recommendation algorithms / AI music selection
- Complex moderation systems (blocklists, genre filters, profanity filters)
- Multi-venue management per owner
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

Extends the existing Better-Auth tables (User, Account, Session, Verification) without modifying them.

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
  venue         Venue    @relation(fields: [venueId], references: [id])
  name          String?
  musicProvider String   @default("youtube")
  isActive      Boolean  @default(true)
  qrCode        String?
  joinCode      String   @unique
  startedAt     DateTime @default(now())
  endedAt       DateTime?

  songs         Song[]
  guests        GuestUser[]
}
```

A VenueSession is time-bound — one per evening, clean slate each time. History available to venue owner.

- `joinCode` — short human-readable code (e.g., "BLUE-7X2K") for manual entry
- `musicProvider` — determines which provider implementation is used for this session

### GuestUser

```prisma
model GuestUser {
  id            String   @id @default(cuid())
  sessionId     String
  session       VenueSession @relation(fields: [sessionId], references: [id])
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
  session       VenueSession @relation(fields: [sessionId], references: [id])
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
  song      Song     @relation(fields: [songId], references: [id])
  guestId   String
  guest     GuestUser @relation(fields: [guestId], references: [id])
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
packages/music/
  src/
    types.ts              ← MusicTrack, SearchResult, PlayerData, MusicProvider interface
    providers/
      youtube.ts          ← YouTube Data API v3 implementation (MVP)
      spotify.ts          ← Spotify Web API implementation (stub/future)
    index.ts              ← getMusicProvider(type) factory function
```

- `YouTubeProvider` — uses YouTube Data API v3. Search costs 100 quota units (10,000/day default).
- `SpotifyProvider` — stub for MVP. Returns "not implemented" errors. Ready for implementation when a venue wants Spotify.
- `getMusicProvider(session.musicProvider)` — factory resolves the correct implementation at runtime.

### Frontend Player Abstraction

```tsx
{playerData.type === "youtube" && <YouTubePlayer data={playerData} />}
{playerData.type === "spotify" && <SpotifyPlayer data={playerData} />}
```

Each player component handles its own embed/SDK integration. The parent component only deals with `PlayerData`.

### Client-Side Search Caching

Search results are cached via React Query with `staleTime: 5 minutes`. Cache key: `[provider, query, page]`. Same query within a session returns cached results instantly. React Query deduplicates concurrent identical searches into a single API call.

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

### SSE Endpoint

```
GET /api/sse/[sessionId]
Content-Type: text/event-stream
```

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
  → Server: upserts Vote, recalculates Song.score in transaction
  → Server: channelManager.broadcast(sessionId, { type: "vote_changed", ... })
  → SSE pushes to all connected clients
  → Every phone's queue UI updates instantly
```

---

## 5. API Layer (tRPC Routers)

### Router Structure

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
│   ├── getByJoinCode   (public)      // customer looks up session by code
│   ├── getActive       (public)      // get active session for a venue
│   └── stats           (protected)   // listener count, votes, songs played
│
├── guest
│   ├── join            (public)      // create GuestUser from fingerprint
│   └── me              (public)      // get current guest's info + votes
│
├── queue
│   ├── list            (public)      // ordered queue for a session
│   ├── nowPlaying      (public)      // currently playing song
│   ├── next            (protected)   // owner triggers next song
│   └── skip            (protected)   // owner force-skips current song
│
├── song
│   ├── search          (public)      // search via music provider
│   ├── suggest         (public)      // guest suggests a song
│   └── remove          (protected)   // owner removes a song
│
└── vote
    └── cast            (public)      // guest upvotes/downvotes
```

### Key Procedure Details

**`guest.join`**
```
Input:  { joinCode, fingerprint, displayName? }
Output: { guestId, sessionId, venueName }
```
Upserts GuestUser by `[sessionId, fingerprint]`. Sets `cv_guest` httpOnly cookie. No sign-up flow.

**`song.suggest`**
```
Input:  { sessionId, providerId, guestId }
Flow:   1. Check suggestion count < venue max (default 5)
        2. Check cooldown (default 30s since last suggestion)
        3. Check duplicate providerId in session
        4. Fetch track metadata via musicProvider.getTrack()
        5. Create Song with status "queued", score 0
        6. Auto-upvote by suggester (+1)
        7. Broadcast "song_added" via SSE
```

**`vote.cast`**
```
Input:  { songId, guestId, value: 1 | -1 }
Flow:   1. Lookup existing vote for guest+song
        2. Same value exists → remove vote (toggle off)
        3. Opposite value → update to new value
        4. No vote → create vote
        5. Recalculate song.score = SUM(votes.value) in transaction
        6. Broadcast "vote_changed" via SSE
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

```typescript
async function createContext({ req }) {
  // Try Better-Auth first (venue owner)
  const authSession = await auth.api.getSession(req)
  if (authSession) return { type: "owner", user: authSession.user }

  // Fall back to guest cookie
  const guestId = getCookie(req, "cv_guest")
  if (guestId) return { type: "guest", guestId }

  // Unauthenticated
  return { type: "anonymous" }
}
```

Three context types. Protected procedures require `type: "owner"`. Guest procedures require `type: "guest"`. Public procedures work for all.

---

## 6. Guest Access & Authentication

### Venue Owners

Existing Better-Auth flow (email/password). No changes needed. Gates venue creation, session management, moderation.

### Venue Customers

```
Scan QR → crowdvibe.app/join/BLUE-7X2K
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
- **Cookie:** `cv_guest`, httpOnly, sameSite strict, expires with session or after 24 hours
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

1. **Auto-advance** — frontend player fires `onEnded`, calls `queue.next`
2. **Manual skip** — venue owner taps "Skip" on dashboard

No server-side duration tracking. The player is the source of truth.

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
  → joinCode auto-generated (e.g., "BLUE-7X2K")
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
| End session | Mark inactive, disconnect all guests |
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

---

## 9. Customer Experience (Mobile-First)

### Join Screen

```
crowdvibe.app/join/BLUE-7X2K

  Blue Tokai Koramangala
  "Friday Night Vibes"

  [Your name (optional)]
  [Join the Vibe]

  23 people vibing now
```

### Main Session View

- **Now Playing (hero)** — large thumbnail/album art, song title, artist, progress bar
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

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TailwindCSS 4 |
| Backend | Self-hosted in Next.js, tRPC 11 |
| Auth (owners) | Better-Auth (email/password) |
| Auth (guests) | FingerprintJS + httpOnly cookie |
| Database | PostgreSQL via Neon, Prisma 7 |
| Real-time | Server-Sent Events (SSE) |
| Music (MVP) | YouTube Data API v3 |
| Music (future) | Spotify Web API + Web Playback SDK |
| UI components | shadcn/ui, Lucide icons |
| Dev tools | Biome, TypeScript 5 |

---

## Package Structure

```
crowd-vibe/
├── apps/
│   └── web/                    # Next.js application
│       └── src/
│           ├── app/
│           │   ├── (venue)/         # Venue owner pages (auth required)
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
│   │       ├── sse/
│   │       │   └── channel-manager.ts
│   │       └── context.ts
│   ├── music/                  # Music provider abstraction (NEW)
│   │   └── src/
│   │       ├── types.ts
│   │       ├── providers/
│   │       │   ├── youtube.ts
│   │       │   └── spotify.ts
│   │       └── index.ts
│   ├── db/                     # Prisma schema + client
│   ├── auth/                   # Better-Auth config
│   ├── ui/                     # Shared shadcn components
│   └── env/                    # Environment validation
```
