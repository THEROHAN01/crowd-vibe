# Contributing to CrowdVibe

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/crowd-vibe.git
cd crowd-vibe

# Install dependencies
npm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env
# Fill in your database URL, YouTube API key, etc.

# Push the schema to your database
npm run db:push

# Start the dev server
npm run dev:web
```

## Code Style

This project uses [Biome](https://biomejs.dev/) for formatting and linting. Run before committing:

```bash
npm run check
```

## Making Changes

1. Create a branch from `main` for your changes
2. Make your changes with clear, focused commits
3. Run `npm run check` to format and lint
4. Run `npm run build --workspace web` to verify the build
5. Run tests if applicable: `npm test`
6. Open a pull request against `main`

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Write a clear description of what changed and why
- Include screenshots for UI changes
- Make sure the build passes

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS info if relevant

## Feature Requests

Open an issue describing the feature, the use case, and why it would be valuable.
