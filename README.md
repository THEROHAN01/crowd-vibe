<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/logo-full-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="apps/web/public/logo-full.svg">
    <img alt="CrowdVibe" src="apps/web/public/logo-full.svg" width="850">
  </picture>
</p>



---

## What is CrowdVibe?

CrowdVibe lets bars, cafes, and event spaces hand the DJ booth to their crowd. Venue owners start a music session, customers scan a QR code to join, and the crowd votes in real time to decide what plays next. The result: higher engagement, happier customers, and a playlist that actually matches the room.

## How It Works

1. **Venue starts a session** -- The owner creates a music session from the dashboard and displays a QR code.
2. **Customers scan & browse** -- Guests scan the QR code on their phone, see the current queue, and search for songs.
3. **Crowd votes** -- Everyone votes on upcoming tracks. The highest-voted song plays next.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 |
| UI | React 19, TailwindCSS 4, shadcn/ui |
| API | tRPC 11 |
| Database | Prisma 7, PostgreSQL |
| Auth | Better-Auth |
| Music | YouTube API |
| Real-time | Server-Sent Events (SSE) |

## Getting Started

```bash
# Install dependencies
npm install

# Configure environment variables
cp apps/web/.env.example apps/web/.env
# then fill in your database URL, YouTube API key, etc.

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
│   └── web/          # Next.js application (pages, components, styles)
├── packages/
│   ├── api/          # tRPC routers & business logic
│   ├── auth/         # Better-Auth configuration
│   ├── config/       # Shared config (Tailwind, TypeScript)
│   ├── db/           # Prisma schema & database client
│   ├── env/          # Environment variable validation
│   └── ui/           # Shared shadcn/ui components & design tokens
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in dev mode |
| `npm run dev:web` | Start only the web app |
| `npm run build` | Build all apps |
| `npm run db:push` | Push schema changes to the database |
| `npm run db:studio` | Open the database studio UI |
| `npm run check` | Run Biome formatting & linting |
| `npm run check-types` | Type-check across all packages |
