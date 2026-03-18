# CrowdVibe UI/UX & Branding Design Specification

## Overview

This spec defines the complete visual identity, design system, component language, page layouts, and motion design for CrowdVibe — a crowd-controlled music voting platform for physical venues.

**Design Philosophy:** Dark-first music interface inspired by Material Design 3 principles (HCT color system, tonal palettes, elevation model, state layers, motion choreography) — adapted for web with shadcn/ui + TailwindCSS 4.

**Research Basis:** UI/UX Pro Max analysis across 6 domains (product patterns, styles, colors, typography, landing patterns, UX guidelines) + Material Design 3 foundations.

---

## 1. Brand Identity

### Brand Name & Voice

- **Name:** CrowdVibe
- **Tagline:** "Let the crowd control the vibe"
- **Voice:** Energetic but not loud. Confident but welcoming. Like a great DJ — in control but responsive to the room.

### Logo Concept

- **Wordmark:** "CrowdVibe" in Space Grotesk Bold (700), with "Crowd" in `--on-surface` and "Vibe" in `--primary` (violet)
- **Logomark:** A stylized sound wave / equalizer formed from 3 vertical bars of different heights — represents music + voting (bars as vote counts)
- **Minimum size:** 24px height for logomark, 120px width for full wordmark
- **Clear space:** 8px minimum around all sides

### Brand Colors

- **Primary brand color:** Violet (#7C3AED / #C4B5FD dark mode) — music, creativity, nightlife
- **Energy accent:** Emerald (#10B981 / #34D399 dark mode) — life, now-playing, active
- **Caution accent:** Red (#EF4444 / #FCA5A5 dark mode) — downvotes, destructive, errors

---

## 2. Color System

### Design Tokens (CSS Custom Properties)

Based on MD3's semantic color roles with HCT-informed tonal values.

#### Dark Mode (Default)

```css
:root[data-theme="dark"], .dark {
  /* Surfaces */
  --background: oklch(0.08 0.02 280);       /* #0F0B1E — deep violet-black */
  --card: oklch(0.13 0.025 280);             /* #1A1530 — elevated surface */
  --muted: oklch(0.17 0.03 280);             /* #241F3D — hover/input bg */
  --popover: oklch(0.13 0.025 280);          /* same as card */

  /* Text */
  --foreground: oklch(0.96 0.01 280);        /* #F5F3FF — violet-50 tint */
  --muted-foreground: oklch(0.65 0.01 280);  /* #A1A1AA — secondary text */
  --card-foreground: oklch(0.96 0.01 280);
  --popover-foreground: oklch(0.96 0.01 280);

  /* Brand */
  --primary: oklch(0.78 0.15 280);           /* #C4B5FD — violet-300 */
  --primary-foreground: oklch(0.15 0.06 280);/* #1E1B4B — dark violet */

  /* Secondary */
  --secondary: oklch(0.17 0.03 280);         /* tonal surface */
  --secondary-foreground: oklch(0.96 0.01 280);

  /* Accent (now-playing, success) */
  --accent: oklch(0.72 0.17 160);            /* #34D399 — emerald-400 */
  --accent-foreground: oklch(0.15 0.04 160);

  /* Destructive (errors, downvote) */
  --destructive: oklch(0.75 0.15 25);        /* #FCA5A5 — red-300 */
  --destructive-foreground: oklch(0.15 0.04 25);

  /* Borders & Rings */
  --border: oklch(0.25 0.02 280);            /* rgba(255,255,255,0.08) equivalent */
  --input: oklch(0.25 0.02 280);
  --ring: oklch(0.78 0.15 280);              /* matches primary */

  /* Functional */
  --upvote: oklch(0.72 0.17 160);            /* emerald — same as accent */
  --downvote: oklch(0.75 0.15 25);           /* red — same as destructive */
  --now-playing: oklch(0.72 0.17 160);       /* emerald pulse */
  --score-positive: oklch(0.72 0.17 160);
  --score-negative: oklch(0.75 0.15 25);
  --score-neutral: oklch(0.65 0.01 280);     /* muted */

  /* Radius */
  --radius: 0.75rem;                          /* 12px — MD3 rounded */

  /* Chart colors */
  --chart-1: oklch(0.78 0.15 280);
  --chart-2: oklch(0.72 0.17 160);
  --chart-3: oklch(0.75 0.15 25);
  --chart-4: oklch(0.7 0.15 220);
  --chart-5: oklch(0.7 0.15 60);
}
```

#### Light Mode

```css
:root, .light {
  --background: oklch(0.985 0.002 280);      /* #FAFAF9 — warm white */
  --card: oklch(1.0 0 0);                    /* #FFFFFF */
  --muted: oklch(0.97 0.005 280);            /* #F5F3FF — violet tinted */
  --popover: oklch(1.0 0 0);

  --foreground: oklch(0.15 0.01 280);        /* #1C1917 — near black */
  --muted-foreground: oklch(0.45 0.01 280);  /* #71717A */
  --card-foreground: oklch(0.15 0.01 280);
  --popover-foreground: oklch(0.15 0.01 280);

  --primary: oklch(0.55 0.2 280);            /* #7C3AED — violet-600 */
  --primary-foreground: oklch(1.0 0 0);      /* white */

  --secondary: oklch(0.97 0.005 280);
  --secondary-foreground: oklch(0.15 0.01 280);

  --accent: oklch(0.55 0.18 160);            /* #10B981 — emerald-500 */
  --accent-foreground: oklch(1.0 0 0);

  --destructive: oklch(0.55 0.2 25);         /* #EF4444 — red-500 */
  --destructive-foreground: oklch(1.0 0 0);

  --border: oklch(0.9 0.005 280);
  --input: oklch(0.9 0.005 280);
  --ring: oklch(0.55 0.2 280);

  --upvote: oklch(0.55 0.18 160);
  --downvote: oklch(0.55 0.2 25);
  --now-playing: oklch(0.55 0.18 160);
  --score-positive: oklch(0.55 0.18 160);
  --score-negative: oklch(0.55 0.2 25);
  --score-neutral: oklch(0.45 0.01 280);

  --radius: 0.75rem;
}
```

### Color Usage Rules

1. **Never hardcode hex values in components** — always use CSS variables via Tailwind classes
2. **Vote colors use semantic tokens** (`--upvote`, `--downvote`) not raw green/red
3. **Text on surfaces must meet 4.5:1 contrast** (WCAG AA minimum, AAA preferred)
4. **Primary color for interactive elements only** — not for large surface areas
5. **Dark mode is the default** — system preference respected via `next-themes`

---

## 3. Typography

### Font Stack

| Role | Font | Weights | Loading Strategy |
|---|---|---|---|
| **Headings** | Space Grotesk | 500, 600, 700 | `next/font/google` with `display: swap` |
| **Body / UI** | DM Sans | 400, 500, 600 | `next/font/google` with `display: swap` |
| **Monospace** | Geist Mono | 400 | Already loaded in project |

### Type Scale

| Token | Size | Weight | Line Height | Spacing | Font | Usage |
|---|---|---|---|---|---|---|
| `display-lg` | 48px | 700 | 1.1 | -0.02em | Space Grotesk | Landing hero |
| `display-sm` | 36px | 700 | 1.15 | -0.01em | Space Grotesk | Page titles |
| `headline` | 24px | 600 | 1.3 | 0 | Space Grotesk | Section headings |
| `title-lg` | 20px | 600 | 1.4 | 0 | Space Grotesk | Card titles, song names |
| `title-sm` | 16px | 600 | 1.4 | 0 | DM Sans | Sub-headings, labels |
| `body` | 16px | 400 | 1.6 | 0 | DM Sans | Body text |
| `body-sm` | 14px | 400 | 1.5 | 0 | DM Sans | Secondary text, artist names |
| `label` | 12px | 500 | 1.4 | 0.04em | DM Sans | Uppercase eyebrows ("NOW PLAYING") |
| `code` | 14px | 400 | 1.5 | 0.02em | Geist Mono | Join codes |

### Typography Rules

- One `h1` per page using `display-sm`
- Section headings use `label` (uppercase eyebrow) above `headline`
- Song titles: `title-lg`, truncate with ellipsis on overflow
- Artist names: `body-sm` in `--muted-foreground`
- Score numbers: `title-sm` with `font-variant-numeric: tabular-nums`
- Join codes: `code` at 24px in Geist Mono, letter-spaced
- Minimum body text: 16px on mobile (avoids iOS auto-zoom)
- Line length: 35-60 chars mobile, 60-75 chars desktop

---

## 4. Component Design Language

### Foundation Tokens

| Token | Value | Usage |
|---|---|---|
| Border radius (cards) | `12px` | Cards, dialogs, sheets |
| Border radius (buttons/inputs) | `8px` | Interactive elements |
| Border radius (pills) | `9999px` | Badges, chips, status dots |
| Spacing grid | 4px increments | All padding/margin/gaps |
| Transition standard | `200ms cubic-bezier(0.2, 0, 0, 1)` | Most transitions |
| Transition micro | `150ms cubic-bezier(0.2, 0, 0, 1)` | Hover states |
| Transition emphasis | `300ms cubic-bezier(0.2, 0, 0, 1)` | Sheet open, queue reorder |

### Cards

- Background: `--card`
- Border: `1px solid var(--border)`
- Radius: `12px`
- Padding: `16px`
- Hover: `+rgba(255,255,255,0.04)` overlay
- Active: `scale(0.98)` for 150ms
- Now Playing card: additional `border-color: var(--primary)` with subtle `box-shadow: 0 0 20px var(--primary/10%)`

### Buttons

| Variant | Background | Text | Usage |
|---|---|---|---|
| Filled (Primary) | `--primary` | `--primary-foreground` | Main CTAs |
| Tonal | `--primary/15%` | `--primary` | Secondary actions |
| Outlined | transparent | `--foreground` | Tertiary actions |
| Ghost | transparent | `--muted-foreground` | Icon buttons |
| Destructive | `--destructive` | white | Dangerous actions |

All buttons: min-height `44px`, radius `8px`, weight `600`, hover with MD3 state layer `+8% overlay`, active `scale(0.97)`.

### Vote Buttons

- Size: `40x40px`, `rounded-full`
- Idle: `--muted-foreground` icon, transparent bg
- Hover: `rgba(255,255,255,0.06)` overlay
- Active upvote: `--upvote/15%` bg, `--upvote` icon color
- Active downvote: `--downvote/15%` bg, `--downvote` icon color
- Tap: `scale(0.85)` for 100ms → spring back
- Score: `title-sm`, tabular figures, colored by sign

### Inputs

- Height: `44px`
- Background: `--muted` (slightly lighter than card)
- Border: `1px solid var(--border)`, focus: `2px solid var(--primary)` + ring
- Label: above, `body-sm` weight 500
- Placeholder: `--muted-foreground`
- Error: `--destructive` border + helper text below

### Song Search Bottom Sheet

- Slides from bottom with spring animation (`300ms`)
- Drag handle: `32x4px`, centered, `--muted-foreground` bg
- Sheet bg: `--card`, radius `16px 16px 0 0`
- Backdrop: `rgba(0,0,0,0.5)` + `backdrop-filter: blur(4px)`
- Exit: faster than enter (`200ms`)
- Dismiss: swipe down, tap backdrop, or Escape key

---

## 5. Page Layouts

### Guest Join Page (`/join/[joinCode]`)

- Full viewport height, vertically centered
- No header/nav bar — zero friction
- Background: radial gradient `--primary/5%` from center
- Venue info in a card with `--primary/20%` border glow
- Live listener count with emerald dot
- Single full-width CTA: "Join the Vibe"

### Guest Session View (`/session/[id]`)

- Minimal top bar (48px): CrowdVibe wordmark + emerald "Live" dot
- **Now Playing:** hero card with large thumbnail (80x80), primary glow border, animated equalizer bars (CSS-only, 3 bars)
- **Queue:** scrollable list filling remaining height, each song as a horizontal card with thumbnail + text + vote controls
- **Search & Add:** sticky bottom button (tonal variant), opens bottom sheet
- Mobile-first layout, `max-w-lg mx-auto`
- Empty state: illustration placeholder + "Be the first to add a song" + prominent search CTA

### Venue Owner Dashboard (`/dashboard`)

**Three states:**

1. **No venue:** centered card (max-w-md) with create venue form
2. **No session:** venue header card + "Start Session" CTA
3. **Live session:** full dashboard

**Live session layout:**
- Header row: venue name + "Live" badge + "End Session" destructive button
- Stats row: 3 compact stat cards (listeners, songs played, total votes) with icons
- Two-column grid (desktop): Now Playing with YouTube player + QR code display
- Single column below: song search + queue manager
- Mobile: all single-column, stacked

### Auth Pages (`/login`)

- Centered card, max-w-sm
- CrowdVibe logo above form
- Background: subtle `--primary/3%` gradient
- Clean inputs with visible labels
- Toggle sign-in/sign-up as text link below

### Landing Page (`/`)

- Hero: large display text + tagline + CTA button
- Background: subtle animated gradient (violet to transparent)
- Single CTA: "Venue Dashboard" → `/dashboard`

---

## 6. Motion & Micro-Interactions

### Motion Tokens

| Token | Value | Usage |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Most UI transitions |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Vote tap, button press |
| `--duration-fast` | `100ms` | Scale feedback |
| `--duration-micro` | `150ms` | Hover, color changes |
| `--duration-standard` | `200ms` | Card transitions |
| `--duration-emphasis` | `300ms` | Sheet open, queue reorder |
| `--duration-enter` | `300ms` | Elements entering |
| `--duration-exit` | `200ms` | Elements leaving (MD3: 60-70% of enter) |

### Vote Interaction

1. Button: `scale(0.85)` → spring back [100ms + spring]
2. Icon: color transition [150ms]
3. Background: tinted overlay fade in [150ms]
4. Score: brief `scale(1.2)` pulse [200ms spring]
5. Queue reorder: cards slide to new positions [300ms]

### Now Playing Transitions

- Current thumbnail: fade out + slide left [200ms]
- New thumbnail: fade in + slide from right [300ms, 50ms delay]
- Title/artist: crossfade [200ms]
- Equalizer bars: continuous CSS animation (3 bars, alternating heights, 0.8s loop)

### Queue Animations

- Song moves up: `translateY` to new position [300ms] + brief highlight flash
- Song added: slides in from right [300ms] with slight scale
- Song removed: `scale(0.95)` + `opacity(0)` [200ms] → others slide to fill

### Loading States

| Context | Pattern |
|---|---|
| Page load | Skeleton screens (`animate-pulse`) |
| Song search | Spinner icon in input |
| Vote submitting | Button opacity pulse |
| SSE queue update | Instant swap, no loader |
| YouTube player | Skeleton with equalizer placeholder |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Preserves state changes while removing all motion.

---

## 7. Accessibility Checklist

| Requirement | Standard | Implementation |
|---|---|---|
| Text contrast | 4.5:1 AA minimum | All text tokens verified against surface tokens |
| Touch targets | 44x44px minimum | All buttons, vote controls, inputs |
| Focus states | Visible 2-4px ring | `--ring` color on `:focus-visible` |
| Keyboard nav | Full tab support | All interactive elements focusable |
| Screen reader | Descriptive labels | `aria-label` on icon-only buttons |
| Reduced motion | Respect preference | `prefers-reduced-motion` media query |
| Color not only | Icons + text | Vote state uses icon direction + color + bg tint |
| Heading hierarchy | Sequential h1→h6 | One h1 per page, sequential sub-headings |
| Alt text | All meaningful images | Thumbnail alt = song title |
| Input labels | Visible, not placeholder-only | Label element above every input |

---

## 8. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|---|---|---|
| Mobile (default) | 0-639px | Single column, bottom sheet search, full-width cards |
| Tablet | 640-1023px | Wider cards, 2-column stats row |
| Desktop | 1024px+ | 2-column dashboard (player + QR side by side), wider queue |
| Large desktop | 1440px+ | Max container width, centered with comfortable margins |

**Container:** `max-w-4xl` for dashboard, `max-w-lg` for guest session view, `max-w-sm` for auth forms.

---

## 9. shadcn/ui Components Needed

### Already Installed
- Button, Input, Label, Card, Dropdown Menu, Skeleton, Checkbox, Sonner (toast)

### Need to Add
- **Sheet** — for song search bottom sheet (replaces full-screen div)
- **Badge** — for "Live" indicator, score badges, song count
- **Dialog** — for confirmation dialogs (end session)
- **Separator** — for visual dividers in queue
- **Tooltip** — for icon-only buttons (skip, remove)
- **ScrollArea** — for smoother queue scrolling

### Custom Components to Build
- **VoteButton** — upvote/downvote with spring animation
- **NowPlayingCard** — hero card with equalizer bars
- **SongCard** — horizontal card for queue items
- **QRDisplay** — QR code with download/copy actions
- **StatCard** — compact metric display (icon + number + label)
- **EqualizerBars** — CSS-only animated equalizer visualization
- **JoinCodeDisplay** — monospace styled join code
- **LiveBadge** — animated emerald dot + "Live" text

---

## 10. Implementation Priority

| Phase | Scope | Impact |
|---|---|---|
| **Phase 1** | Color system + typography + globals.css rewrite | Foundation for everything |
| **Phase 2** | Component restyling (buttons, cards, inputs) | Immediate visual improvement |
| **Phase 3** | Page layouts (guest session, dashboard, join, auth) | User experience transformation |
| **Phase 4** | Motion & micro-interactions (vote animation, queue reorder, sheets) | Polish & delight |
| **Phase 5** | Landing page, branding, empty states | Marketing & completeness |

---

## 11. Anti-Patterns to Avoid

- **No emojis as icons** — use Lucide SVG icons exclusively
- **No hardcoded colors** — always use CSS variables via Tailwind
- **No animations > 500ms** — feels sluggish
- **No hover-only interactions** — all must work with tap
- **No placeholder-only labels** — always use visible label elements
- **No layout-shifting transforms** — use `transform` only, never animate `width`/`height`
- **No pure black (#000)** — use `--background` (deep violet-black) to avoid OLED smear
- **No instant state changes** — always transition with `--duration-micro` minimum
- **No invisible focus rings** — `:focus-visible` must show `--ring` color
- **No font size < 16px for body** — prevents iOS auto-zoom on input focus

---

## 12. Pre-Delivery Checklist

Before shipping any UI component:

- [ ] Uses CSS variables, not hardcoded colors
- [ ] All icons from Lucide (consistent stroke width)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Text contrast 4.5:1 minimum in both themes
- [ ] Focus states visible for keyboard nav
- [ ] `prefers-reduced-motion` respected
- [ ] Touch targets 44px minimum
- [ ] Responsive: tested at 375px, 768px, 1024px
- [ ] No horizontal scroll on mobile
- [ ] Skeleton loading for async content
- [ ] Empty states with helpful message + action
- [ ] Error states with `--destructive` + recovery guidance
- [ ] Dark mode tested independently (not assumed from light)
