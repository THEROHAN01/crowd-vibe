# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-03-18

### Added
- Venue management: create venues, start/end music sessions
- Guest access: join sessions via QR code with no sign-up required
- Song voting: upvote/downvote songs to control the queue
- Song suggestions: search YouTube and add songs to the queue
- Real-time updates: SSE-powered live queue sync across all devices
- Queue logic: automatic reordering by vote score, auto-skip on downvote threshold
- YouTube integration: music playback via YouTube IFrame embed on owner dashboard
- Rate limiting: suggestion caps, vote dedup, search throttling, join rate limiting
- Authentication: Better-Auth for venue owners, HMAC-signed cookies for guests
- Dark-first UI: MD3-inspired violet/emerald design system with Space Grotesk + DM Sans
- Accessibility: WCAG AA contrast, 44px touch targets, ARIA live regions, skip navigation, reduced motion support
- Mobile-first: responsive layouts optimized for phone-first guest experience
