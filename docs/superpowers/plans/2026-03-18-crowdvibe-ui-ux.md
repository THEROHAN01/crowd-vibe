# CrowdVibe UI/UX & Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the visually bare CrowdVibe MVP into a polished, dark-first music interface with MD3-inspired design system, custom typography, motion design, and brand identity.

**Architecture:** Phased UI overhaul — foundation (colors, fonts, tokens) first, then component restyling, then page layouts, then motion/polish. Each phase produces a visually improved, working app. No backend changes.

**Tech Stack:** TailwindCSS 4 (OKLch tokens), shadcn/ui (base-lyra style), Space Grotesk + DM Sans + Geist Mono, Lucide icons, next-themes (dark-first)

**Spec:** `docs/superpowers/specs/2026-03-18-crowdvibe-ui-ux-design.md`

---

## File Map

### Files to MODIFY

```
packages/ui/src/styles/globals.css              — Replace :root/.dark color blocks, add @theme inline entries
packages/ui/src/components/button.tsx           — Remove rounded-none, add tonal variant, fix sizes
packages/ui/src/components/input.tsx            — Remove rounded-none, fix height to 44px
packages/ui/src/components/card.tsx             — Remove rounded-none from all sub-components
packages/ui/src/components/label.tsx            — Increase text size from text-xs
apps/web/src/app/layout.tsx                     — Replace fonts (DM Sans + Space Grotesk)
apps/web/src/components/providers.tsx           — Change defaultTheme to "dark"
apps/web/src/components/header.tsx              — Restyle with brand wordmark + dark theme
apps/web/src/app/page.tsx                       — Restyle landing page with gradient hero
apps/web/src/components/sign-in-form.tsx        — Replace hardcoded indigo with theme tokens
apps/web/src/components/sign-up-form.tsx        — Replace hardcoded indigo with theme tokens
apps/web/src/components/session/vote-button.tsx — Replace hardcoded green/red with upvote/downvote tokens
apps/web/src/components/session/now-playing.tsx — Add equalizer bars, primary glow border
apps/web/src/components/session/song-queue.tsx  — Restyle with design system tokens
apps/web/src/components/session/song-search.tsx — Replace full-screen overlay with Sheet bottom sheet
apps/web/src/components/venue/session-dashboard.tsx — Add stat cards, restyle layout
apps/web/src/components/venue/qr-display.tsx    — Restyle with violet accent border
apps/web/src/components/venue/queue-manager.tsx — Restyle with design system tokens
apps/web/src/app/join/[joinCode]/page.tsx       — Add gradient bg, card glow, emerald dot
apps/web/src/app/session/[id]/session-view.tsx  — Add top bar, session ended overlay
apps/web/src/app/login/page.tsx                 — Add logo, gradient bg
```

### Files to CREATE

```
apps/web/src/components/ui/equalizer-bars.tsx   — CSS-only animated equalizer visualization
apps/web/src/components/ui/live-badge.tsx        — Animated emerald dot + "Live" text
apps/web/src/components/ui/stat-card.tsx         — Compact metric display (icon + number + label)
apps/web/src/components/ui/logo.tsx              — CrowdVibe wordmark + logomark component
```

---

## Task 1: Design System Foundation — Colors & Tokens

**Files:**
- Modify: `packages/ui/src/styles/globals.css`

This is the highest-impact change — every component in the app inherits from these tokens.

- [ ] **Step 1: Replace `:root` color block in globals.css**

**CRITICAL: Do NOT touch lines 1-7.** Lines 1-5 are `@import`/`@source` directives and line 7 is `@custom-variant dark (&:is(.dark *));` which enables dark mode. Deleting line 7 breaks ALL dark mode styling.

Replace ONLY the `:root` block (starts at line 9) with the spec's light mode tokens using `:root, .light` selector (per spec Section 2). The new block must include ALL tokens: background, foreground, card, primary, secondary, accent, destructive, surface-variant, on-surface-variant, outline, scrim, border, input, ring, upvote, downvote, now-playing, score-positive, score-negative, score-neutral, radius, ALL sidebar tokens, AND chart-1 through chart-5.

- [ ] **Step 2: Replace `.dark` color block in globals.css**

Replace the existing `.dark` block with the dark mode tokens from the spec (Section 2, Dark Mode). Must include ALL dark mode tokens including sidebar tokens and chart colors. Use `.dark` selector (not `:root[data-theme]`).

- [ ] **Step 3: Add new entries to the existing `@theme inline` block**

**IMPORTANT: Do NOT replace the existing `@theme inline` block.** The existing block (lines 78-118) already maps ~30 `--color-*` tokens that shadcn needs. ADD these entries to the existing block:

```css
/* Font overrides — REPLACE the existing --font-sans: "Inter Variable" line with: */
--font-sans: "DM Sans", ui-sans-serif, sans-serif;
/* ADD these two new font entries: */
--font-heading: "Space Grotesk", ui-sans-serif, sans-serif;
--font-mono: "Geist Mono", ui-monospace, monospace;

/* New MD3 surface tokens */
--color-surface-variant: var(--surface-variant);
--color-on-surface-variant: var(--on-surface-variant);
--color-outline: var(--outline);
--color-scrim: var(--scrim);

/* Functional color tokens */
--color-upvote: var(--upvote);
--color-downvote: var(--downvote);
--color-now-playing: var(--now-playing);
--color-score-positive: var(--score-positive);
--color-score-negative: var(--score-negative);
--color-score-neutral: var(--score-neutral);

/* Motion tokens */
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--duration-instant: 100ms;
--duration-micro: 150ms;
--duration-standard: 200ms;
--duration-emphasis: 300ms;
--duration-enter: 300ms;
--duration-exit: 200ms;
```

- [ ] **Step 4: Add reduced motion rule to `@layer base`**

Add to the existing `@layer base` block:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Verify the app still builds**

Run: `npm run build --workspace web`
Expected: Build succeeds. All existing pages render with the new color palette.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "feat(ui): replace color system with MD3-inspired violet/emerald dark-first palette"
```

---

## Task 2: Typography — Font Loading

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Replace font imports in layout.tsx**

Replace the current Geist font imports with DM Sans and Space Grotesk. Keep Geist Mono:

```typescript
import { DM_Sans, Space_Grotesk, Geist_Mono } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
```

Update the `<body>` className:
```tsx
<body className={`${dmSans.variable} ${spaceGrotesk.variable} ${geistMono.variable} antialiased`}>
```

- [ ] **Step 2: Verify fonts load correctly**

Run the dev server, inspect the page — body text should be DM Sans, headings (where `font-heading` is applied) should be Space Grotesk.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(ui): replace Geist fonts with DM Sans + Space Grotesk"
```

---

## Task 3: Theme Provider — Dark Default

**Files:**
- Modify: `apps/web/src/components/providers.tsx`

- [ ] **Step 1: Change defaultTheme from "system" to "dark"**

In `providers.tsx`, change:
```tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/providers.tsx
git commit -m "feat(ui): set dark mode as default theme"
```

---

## Task 4: Component Restyling — Button

**Files:**
- Modify: `packages/ui/src/components/button.tsx`

This is a critical change — every button in the app uses this component.

- [ ] **Step 1: Update button base classes**

Replace the CVA base class string. Key changes:
- Remove `rounded-none` → inherit from `--radius` tokens
- Remove `text-xs` → use `text-sm` (larger for readability)
- Add `cursor-pointer` for all interactive states
- Add `transition-[background,color,transform,box-shadow]` with `duration-standard`

- [ ] **Step 2: Add `tonal` variant**

Add to the variants object:
```typescript
tonal: "bg-primary/15 text-primary hover:bg-primary/20 focus-visible:bg-primary/20",
```

- [ ] **Step 3: Update sizes for 44px touch targets**

Update size variants:
- `default`: `h-11 gap-2 px-4` (was h-8)
- `sm`: `h-9 gap-1.5 px-3` (was h-7, exception for compact contexts)
- `lg`: `h-12 gap-2 px-6` (was h-9)
- `icon`: `size-11` (was size-8)
- `icon-lg`: `size-12` (48px, was size-9)
- Remove `xs`, `icon-xs`, `icon-sm` sizes (too small for touch targets)
- Remove `rounded-none` from ALL size variants

- [ ] **Step 4: Verify buttons render correctly across the app**

Check: dashboard buttons, vote buttons, join page CTA, auth form buttons.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/button.tsx
git commit -m "feat(ui): restyle buttons with MD3 state layers, tonal variant, 44px touch targets"
```

---

## Task 5: Component Restyling — Input, Card, Label

**Files:**
- Modify: `packages/ui/src/components/input.tsx`
- Modify: `packages/ui/src/components/card.tsx`
- Modify: `packages/ui/src/components/label.tsx`

- [ ] **Step 1: Update input.tsx**

Key changes:
- Remove `rounded-none` → inherit from tokens
- Change `h-8` → `h-11` (44px)
- Change `text-xs` → `text-sm`
- Add `cursor-text`

- [ ] **Step 2: Update card.tsx**

Key changes in all card sub-components:
- Remove all `rounded-none` instances
- Add `rounded-lg` to Card base (uses `--radius`)
- Update `text-xs` → `text-sm` for card content

- [ ] **Step 3: Update label.tsx**

Change `text-xs` → `text-sm font-medium`

- [ ] **Step 4: Verify forms and cards render correctly**

Check: create venue form, start session form, join page, dashboard cards.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/input.tsx packages/ui/src/components/card.tsx packages/ui/src/components/label.tsx
git commit -m "feat(ui): restyle input (44px), card (rounded-lg), label (text-sm)"
```

---

## Task 6: Install New shadcn Components

- [ ] **Step 1: Add Sheet, Badge, Dialog, Separator, Tooltip, ScrollArea**

```bash
cd /home/rohan/playground/crowd-vibe
npx shadcn@latest add sheet badge dialog separator tooltip scroll-area -c packages/ui
```

Note: This uses the `base-lyra` style. If any component is unavailable in `base-lyra`, fall back to building a custom equivalent.

- [ ] **Step 2: Verify the added components have no `rounded-none`**

Check each new component file. If any have `rounded-none`, remove it.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/
git commit -m "feat(ui): add shadcn Sheet, Badge, Dialog, Separator, Tooltip, ScrollArea"
```

---

## Task 7: Custom UI Components — Logo, LiveBadge, StatCard, EqualizerBars

**Files:**
- Create: `apps/web/src/components/ui/logo.tsx`
- Create: `apps/web/src/components/ui/live-badge.tsx`
- Create: `apps/web/src/components/ui/stat-card.tsx`
- Create: `apps/web/src/components/ui/equalizer-bars.tsx`

- [ ] **Step 0: Create the ui components directory**

```bash
mkdir -p apps/web/src/components/ui
```

- [ ] **Step 1: Create Logo component**

CrowdVibe wordmark: "Crowd" in `text-foreground` + "Vibe" in `text-primary`, font-heading (Space Grotesk), font-bold. Optional `size` prop for small/default variants.

- [ ] **Step 2: Create LiveBadge component**

Animated emerald dot (pulsing via `animate-pulse`) + "Live" text in accent color. Uses Badge component from shadcn.

- [ ] **Step 3: Create StatCard component**

Props: `icon` (Lucide component), `value` (number), `label` (string). Compact card with `--card` bg, `--border`, icon at 20px, value in `title-lg` with `tabular-nums`, label in `label` uppercase.

- [ ] **Step 4: Create EqualizerBars component**

3 animated bars using CSS keyframes. Each bar: 3px wide, `rounded-full`, `bg-accent` (emerald). Different `animation-delay` per bar. Respects `prefers-reduced-motion`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/
git commit -m "feat(ui): add Logo, LiveBadge, StatCard, EqualizerBars components"
```

---

## Task 8: Restyle Auth Pages

**Files:**
- Modify: `apps/web/src/components/sign-in-form.tsx`
- Modify: `apps/web/src/components/sign-up-form.tsx`
- Modify: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: Replace hardcoded colors in sign-in-form.tsx**

- Change `text-red-500` → `text-destructive`
- Change `text-indigo-600 hover:text-indigo-800` → `text-primary hover:text-primary/80`
- Add Logo component above the form
- Update heading to use `font-heading` class

- [ ] **Step 2: Same changes in sign-up-form.tsx**

- [ ] **Step 3: Restyle login page**

Add subtle background gradient `bg-gradient-to-b from-primary/3 to-background`. Center with proper spacing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/sign-in-form.tsx apps/web/src/components/sign-up-form.tsx apps/web/src/app/login/page.tsx
git commit -m "feat(ui): restyle auth pages with brand tokens, logo, gradient bg"
```

---

## Task 9: Restyle Guest Join Page

**Files:**
- Modify: `apps/web/src/app/join/[joinCode]/page.tsx`

- [ ] **Step 1: Apply design spec layout**

Key changes:
- Remove header (set in a route group or conditionally hide)
- Add radial gradient background: `bg-[radial-gradient(circle_at_center,var(--primary)/5%,transparent)]`
- Venue card: add `border-primary/20` glow, `shadow-lg shadow-primary/5`
- Listener count: add emerald dot (`bg-accent rounded-full w-2 h-2 animate-pulse`)
- CTA button: use `size="lg"` with `w-full`, tonal or filled variant
- Add Logo component at top
- Use `font-heading` for venue name heading

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/join/
git commit -m "feat(ui): restyle guest join page with gradient bg, glow card, brand tokens"
```

---

## Task 10: Restyle Vote Button with Design Tokens

**Files:**
- Modify: `apps/web/src/components/session/vote-button.tsx`

- [ ] **Step 1: Replace hardcoded colors**

Replace:
- `text-green-500` → `text-upvote`
- `text-red-500` → `text-downvote`

Add:
- Active upvote bg: `bg-upvote/15`
- Active downvote bg: `bg-downvote/15`
- Idle state: `text-on-surface-variant` (was `text-muted-foreground`)
- Size: `w-11 h-11` (44px touch target, was implicit from p-1)
- Add `rounded-full` and `flex items-center justify-center`
- Add spring animation: `active:scale-85 transition-transform duration-instant ease-spring`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/session/vote-button.tsx
git commit -m "feat(ui): restyle vote button with semantic tokens and spring animation"
```

---

## Task 11: Restyle Now Playing Card

**Files:**
- Modify: `apps/web/src/components/session/now-playing.tsx`

- [ ] **Step 1: Apply design spec styling**

Key changes:
- Add `label` eyebrow: "NOW PLAYING" in `text-xs uppercase tracking-widest text-muted-foreground font-medium`
- Thumbnail: `w-20 h-20 rounded-xl` (was rounded-lg) with `border-2 border-primary/30` glow
- Add `box-shadow: 0 0 20px color-mix(in oklch, var(--primary) 10%, transparent)` via inline style
- Add `EqualizerBars` component below title/artist
- Use `font-heading` for song title
- Card wrapper: `border border-primary/20 bg-card rounded-lg p-4`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/session/now-playing.tsx
git commit -m "feat(ui): restyle now-playing card with glow border, equalizer bars"
```

---

## Task 12: Restyle Song Queue

**Files:**
- Modify: `apps/web/src/components/session/song-queue.tsx`

- [ ] **Step 1: Apply design spec styling**

Key changes:
- Song card: `bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors duration-micro`
- Thumbnail: `w-12 h-12 rounded-md` (was w-10 h-10 rounded)
- Score: `text-sm font-bold tabular-nums` + color by sign (text-score-positive/negative/neutral)
- Empty state: use Lucide `ListMusic` icon at 64px + "No songs yet" text + tonal "Search & Add" button
- Add `aria-live="polite"` to the queue container

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/session/song-queue.tsx
git commit -m "feat(ui): restyle song queue with design tokens, score colors, empty state"
```

---

## Task 13: Replace Song Search with Bottom Sheet

**Files:**
- Modify: `apps/web/src/components/session/song-search.tsx`

- [ ] **Step 1: Replace full-screen overlay with shadcn Sheet**

Rewrite `song-search.tsx` to use the `Sheet` component (side="bottom") instead of `fixed inset-0`. Key changes:
- Use `<Sheet>` + `<SheetTrigger>` + `<SheetContent side="bottom">` from shadcn
- Trigger button: tonal variant, full width, with Search icon
- Sheet content: search input + results list + "Suggestions left" counter
- Sheet has rounded top corners (`rounded-t-2xl`)
- Backdrop uses `--scrim` with `backdrop-filter: blur(4px)`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/session/song-search.tsx
git commit -m "feat(ui): replace full-screen search overlay with bottom Sheet"
```

---

## Task 14: Restyle Session View

**Files:**
- Modify: `apps/web/src/app/session/[id]/session-view.tsx`

- [ ] **Step 1: Apply design spec layout**

Key changes:
- Add minimal top bar (48px): Logo component + LiveBadge on the right
- Session ended overlay: use spec's design (fixed, z-50, blurred bg, Music icon, centered text)
- Add `aria-live="polite"` to the now-playing section
- Background: `bg-background`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/session/
git commit -m "feat(ui): restyle session view with top bar, live badge, session ended overlay"
```

---

## Task 15: Restyle Venue Owner Dashboard

**Files:**
- Modify: `apps/web/src/components/venue/session-dashboard.tsx`
- Modify: `apps/web/src/components/venue/qr-display.tsx`
- Modify: `apps/web/src/components/venue/queue-manager.tsx`

- [ ] **Step 1: Add stat cards to session-dashboard.tsx**

Replace inline stats text with StatCard components:
```tsx
<div className="grid grid-cols-2 gap-4">
  <StatCard icon={Users} value={stats.data?.listenerCount ?? 0} label="Listeners" />
  <StatCard icon={Music} value={stats.data?.songsPlayed ?? 0} label="Played" />
</div>
```

- [ ] **Step 2: Add LiveBadge to header**

Replace plain text with:
```tsx
<div className="flex items-center gap-3">
  <h1 className="text-xl font-heading font-bold">{venueName}</h1>
  <LiveBadge />
</div>
```

- [ ] **Step 3: Restyle QR display**

Add violet accent border: `border-primary/20`, use `shadow-lg shadow-primary/5`. Style join code with `font-mono text-2xl font-bold tracking-widest`.

- [ ] **Step 4: Restyle queue manager**

Use same design tokens as guest queue: `bg-card border-border rounded-lg`. Use `font-heading` for section titles.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/venue/
git commit -m "feat(ui): restyle dashboard with stat cards, live badge, violet QR accent"
```

---

## Task 16: Restyle Landing Page + Header

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/components/header.tsx`

- [ ] **Step 1: Restyle landing page**

Replace current plain text with:
- Large display heading using `font-heading text-5xl font-bold`
- "Crowd" in `text-foreground`, "Vibe" in `text-primary`
- Tagline in `text-lg text-muted-foreground`
- Background: subtle radial gradient from primary/5
- CTA: filled primary button, `size="lg"`

- [ ] **Step 2: Restyle header**

- Replace text "CrowdVibe" with Logo component
- Style nav links with `text-sm font-medium text-muted-foreground hover:text-foreground transition-colors`
- Add proper spacing: `px-4 py-3 border-b border-border`
- Remove the bare `<hr />`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/header.tsx
git commit -m "feat(ui): restyle landing page hero and header with brand identity"
```

---

## Task 17: Toast Restyling & Accessibility Extras

**Files:**
- Modify: `apps/web/src/components/providers.tsx`
- Modify: `apps/web/src/app/session/[id]/session-view.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Configure Sonner toast position and styling**

In `providers.tsx`, update the Toaster component:
```tsx
<Toaster
  richColors
  position="bottom-center"
  toastOptions={{
    className: "border border-border bg-card text-foreground",
  }}
/>
```

- [ ] **Step 2: Add skip-navigation link in layout.tsx**

Add before `<Header />`:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">
  Skip to main content
</a>
```

And add `id="main-content"` to the children container div.

- [ ] **Step 3: Restyle YouTube player container in session-dashboard.tsx**

Wrap the YouTube player in a card-style container:
```tsx
<div className="bg-card border border-border rounded-lg overflow-hidden">
  <YouTubePlayer ... />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/providers.tsx apps/web/src/app/session/ apps/web/src/app/layout.tsx apps/web/src/components/venue/session-dashboard.tsx
git commit -m "feat(ui): add toast styling, skip-nav link, YouTube player container"
```

---

## Task 18: Final Build Verification & Cleanup

- [ ] **Step 1: Build the app**

```bash
npm run build --workspace web
```

Expected: Clean build, no type errors, all routes present.

- [ ] **Step 2: Visual check in dark mode (default)**

Open each page and verify:
- `/` — Landing page with gradient, violet "Vibe" accent
- `/login` — Auth form with logo, gradient bg
- `/dashboard` — Dashboard with stat cards, live badge, styled QR
- `/join/[code]` — Join page with glow card, gradient bg
- `/session/[id]` — Session view with styled now-playing, queue, bottom sheet search

- [ ] **Step 3: Visual check in light mode**

Toggle theme to light, verify contrast and readability on all pages.

- [ ] **Step 4: Mobile responsiveness check**

Check at 375px width: all pages, queue scrolling, bottom sheet, vote buttons (44px targets).

- [ ] **Step 5: Run the pre-delivery checklist from spec Section 13**

Go through each item and verify.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(ui): CrowdVibe UI/UX overhaul complete — dark-first violet/emerald design system"
```
