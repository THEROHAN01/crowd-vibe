<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/logo-full-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="apps/web/public/logo-full.svg">
    <img alt="CrowdVibe" src="apps/web/public/logo-full.svg" width="240">
  </picture>
</p>

<p align="center">
  <strong>Crowd-controlled music for venues</strong><br>
  Let your customers vote on what plays next
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/next.js-16-black" alt="Next.js 16">
  <img src="https://img.shields.io/badge/typescript-5-blue" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/tailwindcss-4-38bdf8" alt="TailwindCSS 4">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
</p>

<p align="center">
  <a href="#what-is-crowdvibe">About</a> ·
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

## What is CrowdVibe?

CrowdVibe lets bars, cafes, and event spaces hand the DJ booth to their crowd. Venue owners start a music session, customers scan a QR code to join, and the crowd votes in real time to decide what plays next.

### Why CrowdVibe?

- **For venue owners** — Music automatically adapts to the crowd mood. No more managing playlists manually.
- **For customers** — Influence what plays next with a single tap. No app download, no sign-up.
- **For the vibe** — When the crowd picks the music, everyone's more engaged and having a better time.

## How It Works

1. **Venue starts a session** — The owner creates a music session from the dashboard and gets a QR code.
2. **Customers scan & join** — Guests scan the QR code on their phone. No sign-up required — they're in instantly.
3. **Crowd votes** — Everyone upvotes or downvotes songs. The highest-voted track plays next.

## Features

- **QR code join** — Customers scan and vote in seconds, no account needed
- **Real-time voting** — Upvote, downvote, and watch the queue reorder live via SSE
- **Song search** — Search YouTube's catalog and suggest songs to the queue
- **Venue dashboard** — Manage sessions, view stats, control playback, share QR codes
- **Fairness system** — Suggestion limits, cooldowns, vote dedup, auto-skip on downvotes
- **Dark-first UI** — MD3-inspired violet/emerald design system, mobile-first, accessible
- **Music provider abstraction** — YouTube for MVP, Spotify-ready architecture

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 16](https://nextjs.org/) |
| UI | [React 19](https://react.dev/), [TailwindCSS 4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) |
| API | [tRPC 11](https://trpc.io/) |
| Database | [Prisma 7](https://www.prisma.io/), [PostgreSQL](https://www.postgresql.org/) |
| Auth | [Better-Auth](https://www.better-auth.com/) |
| Music | [YouTube Data API v3](https://developers.google.com/youtube/v3) |
| Real-time | Server-Sent Events (SSE) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [npm](https://www.npmjs.com/) v10+
- [PostgreSQL](https://www.postgresql.org/) database (or [Neon](https://neon.tech/) for serverless)
- [YouTube Data API key](https://console.cloud.google.com/apis/library/youtube.googleapis.com)

### Setup

```bash
# Clone the repo
git clone https://github.com/your-username/crowd-vibe.git
cd crowd-vibe

# Install dependencies
npm install

# Configure environment variables
cp apps/web/.env.example apps/web/.env
# Fill in: DATABASE_URL, BETTER_AUTH_SECRET, YOUTUBE_API_KEY

# Push the schema to your database
npm run db:push

# Start the dev server
npm run dev:web
```

Open [http://localhost:3001](http://localhost:3001) to see the app.

## Project Structure

```
crowd-vibe/
├── apps/
│   └── web/              # Next.js application
│       ├── src/app/       # Pages (landing, login, dashboard, join, session)
│       ├── src/components/# UI components (venue, session, player, ui)
│       └── src/hooks/     # Custom hooks (SSE events, guest identity)
├── packages/
│   ├── api/              # tRPC routers, SSE channel manager, music providers
│   ├── auth/             # Better-Auth configuration
│   ├── db/               # Prisma schema & database client
│   ├── env/              # Environment variable validation
│   └── ui/               # Shared shadcn/ui components & design tokens
├── docs/                 # Design specs, implementation plans, testing guide
└── design-system/        # Design system documentation
```

## Testing

The project uses **Vitest** with two test layers:

- **Unit tests** — Pure logic (cookie signing, rate limiting, join codes, queue helpers, search cache, SSE channels)
- **Integration tests** — tRPC routers against a real PostgreSQL database (via Docker)

```bash
npm run test:db:up         # Start test database (Docker, once)
npm test                   # Run unit tests
npm run test:integration   # Run integration tests
npm run test:all           # Run everything
npm run test:watch         # Watch mode for TDD
npm run test:coverage      # Coverage report
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:web` | Start the web app in dev mode |
| `npm run build` | Build for production |
| `npm run db:push` | Push schema changes to database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run check` | Run Biome formatting & linting |
| `npm run check-types` | Type-check across all packages |
| `npm test` | Run unit tests |
| `npm run test:all` | Run all tests |

## Deployment

CrowdVibe uses Server-Sent Events (SSE) for real-time updates. This requires a **single long-lived Node.js process** — serverless platforms (e.g., Vercel default) will not work.

**Recommended:** [Railway](https://railway.app/), [Fly.io](https://fly.io/), [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform), or any VPS with `next start`.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- [Open an issue](../../issues) to report bugs or request features
- [Submit a PR](../../pulls) to contribute code
- Read the [design specs](docs/superpowers/specs/) for architecture context

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

CrowdVibe is [MIT licensed](LICENSE).
