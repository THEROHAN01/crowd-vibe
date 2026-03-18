# PERF-005: All images use raw `<img>` tags -- no Next.js image optimization

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| **Severity**     | P0 CRITICAL                                    |
| **Category**     | Performance / Frontend                         |
| **Files**        | 5 component files (listed below)               |
| **Discovered**   | 2026-03-18                                     |
| **Status**       | Open                                           |

---

## Summary

Every image in the CrowdVibe web app uses raw HTML `<img>` tags instead of Next.js's `<Image>` component. This bypasses the entire Next.js image optimization pipeline -- no automatic WebP/AVIF conversion, no responsive srcSet generation, no built-in lazy loading, no blur placeholders, and no size optimization. For a music queue app that displays dozens of thumbnails per page, this creates a severe mobile performance problem.

---

## Affected Files

| # | File | Line(s) | Context | Image source |
|---|------|---------|---------|-------------|
| 1 | `apps/web/src/components/session/now-playing.tsx` | 36-39 | Album art (hero, above fold) | YouTube thumbnail |
| 2 | `apps/web/src/components/session/song-queue.tsx` | 50-53 | Song thumbnails in scrollable list | YouTube thumbnail |
| 3 | `apps/web/src/components/session/song-search.tsx` | 94-99 | Search result thumbnails in bottom sheet | YouTube thumbnail |
| 4 | `apps/web/src/components/venue/session-dashboard.tsx` | 198-203 | Owner search result thumbnails | YouTube thumbnail |
| 5 | `apps/web/src/components/venue/queue-manager.tsx` | 46-49 | Owner queue item thumbnails | YouTube thumbnail |

---

## Current Code in Each File

### 1. Now Playing -- Album art (hero position)

**File: `apps/web/src/components/session/now-playing.tsx`, lines 35-40**

```tsx
{song.thumbnailUrl && (
	<img
		src={song.thumbnailUrl}
		alt={song.title}
		className="h-20 w-20 rounded-xl border-2 border-primary/30 object-cover"
	/>
)}
```

This is the **above-the-fold hero image**. It loads the full YouTube thumbnail (typically `https://i.ytimg.com/vi/{id}/hqdefault.jpg`, 480x360px, ~30-50KB JPEG) to display at 80x80px CSS (160x160px on 2x retina). The browser downloads 480x360 and discards most pixels.

### 2. Song Queue -- Scrollable list thumbnails

**File: `apps/web/src/components/session/song-queue.tsx`, lines 49-54**

```tsx
{song.thumbnailUrl && (
	<img
		src={song.thumbnailUrl}
		alt=""
		className="h-12 w-12 rounded-md object-cover"
	/>
)}
```

Rendered for **every song in the queue**. With 50 songs visible, that's 50 unoptimized images loading simultaneously. Display size is 48x48px (96x96px on retina) but the source image is 480x360px.

### 3. Song Search -- Bottom sheet search results

**File: `apps/web/src/components/session/song-search.tsx`, lines 94-99**

```tsx
{track.thumbnailUrl && (
	<img
		src={track.thumbnailUrl}
		alt=""
		className="h-12 w-12 rounded object-cover"
	/>
)}
```

Search results appear in a scrollable bottom sheet. Up to 20 results are returned per search. All 20 thumbnails load immediately, even though only ~5-6 are visible in the sheet viewport.

### 4. Session Dashboard -- Owner search results

**File: `apps/web/src/components/venue/session-dashboard.tsx`, lines 198-203**

```tsx
{track.thumbnailUrl && (
	<img
		src={track.thumbnailUrl}
		alt={track.title}
		className="h-10 w-10 rounded"
	/>
)}
```

Same issue as #3 but on the owner dashboard. Display size is 40x40px, downloading 480x360px source.

### 5. Queue Manager -- Owner queue view

**File: `apps/web/src/components/venue/queue-manager.tsx`, lines 45-50**

```tsx
{song.thumbnailUrl && (
	<img
		src={song.thumbnailUrl}
		alt=""
		className="h-10 w-10 rounded object-cover"
	/>
)}
```

Owner's queue view. Same unbounded list problem as #2 -- every song's thumbnail loads immediately at full resolution.

---

## Why This Is Critical

### 1. No format conversion

YouTube thumbnails are served as JPEG from `i.ytimg.com`. Next.js `<Image>` automatically converts to WebP (30% smaller) or AVIF (50% smaller) based on browser support. Raw `<img>` downloads the original JPEG every time.

| Format | Typical size (480x360) | Savings vs JPEG |
|--------|----------------------|-----------------|
| JPEG   | 35 KB                | baseline        |
| WebP   | 24 KB                | -31%            |
| AVIF   | 17 KB                | -51%            |

### 2. No responsive sizing

Next.js `<Image>` generates multiple sizes via `srcSet` and serves the smallest one that fits the display. A 48x48 display slot on a 2x screen needs at most a 96x96 image (~3 KB in WebP). Currently, a 480x360 image (~35 KB) is downloaded -- **10x more data than needed**.

### 3. No lazy loading

All `<img>` tags load eagerly by default. When the queue has 50 songs, all 50 thumbnails start downloading immediately, even those below the fold. This contends for bandwidth with the SSE connection and API requests.

Next.js `<Image>` defaults to `loading="lazy"`, only loading images as they enter the viewport.

### 4. No blur placeholder

During image load, users see a blank space that then "pops" into place (CLS -- Cumulative Layout Shift). Next.js `<Image>` supports `placeholder="blur"` with a tiny base64-encoded preview that shows immediately and transitions smoothly.

### 5. No size constraints on layout

Raw `<img>` without explicit `width`/`height` attributes causes layout shift when the image loads. The browser doesn't know the aspect ratio until download completes, so the layout reflows.

---

## Impact Calculation

### Scenario: Guest view with 50 songs in queue + now playing

| Component        | Images | Size per image | Total (JPEG) | Total (optimized WebP) |
|------------------|--------|---------------|--------------|----------------------|
| Now Playing      | 1      | 35 KB         | 35 KB        | 3 KB (80x80 WebP)   |
| Song Queue       | 50     | 35 KB         | 1,750 KB     | 150 KB (48x48 WebP) |
| **Total**        | **51** |               | **1,785 KB** | **153 KB**           |

**Savings: 1,632 KB (91% reduction)**

### Mobile performance impact

| Network   | 1,785 KB download | 153 KB download | Difference     |
|-----------|--------------------|-----------------|----------------|
| 3G (0.4 MB/s) | 4.5 seconds    | 0.4 seconds     | -4.1 seconds   |
| 4G (1.5 MB/s) | 1.2 seconds    | 0.1 seconds     | -1.1 seconds   |
| WiFi (5 MB/s)  | 0.4 seconds    | 0.03 seconds    | -0.37 seconds  |

On 3G, the queue page takes **4.5 extra seconds** to fully load images. This is unacceptable for a real-time music voting app where users expect instant feedback.

### Additional impact: Search results

When a guest searches for songs, up to 20 results load simultaneously in the bottom sheet. That's another 700 KB of unoptimized thumbnails on every search action.

---

## Missing Next.js Configuration

**File: `apps/web/next.config.ts`**

The current config has no `images` configuration:

```typescript
import "@crowd-vibe/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
};

export default nextConfig;
```

Next.js `<Image>` with external URLs requires `remotePatterns` to be configured. Without this, `<Image src="https://i.ytimg.com/..." />` throws a build-time error. This missing config is likely why raw `<img>` was used in the first place.

---

## Fix

### Step 1: Configure `remotePatterns` in next.config.ts

**File: `apps/web/next.config.ts`**

```typescript
import "@crowd-vibe/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "i.ytimg.com",
				pathname: "/vi/**",
			},
			{
				protocol: "https",
				hostname: "img.youtube.com",
				pathname: "/vi/**",
			},
		],
	},
};

export default nextConfig;
```

Both `i.ytimg.com` and `img.youtube.com` are included as YouTube serves thumbnails from both domains.

### Step 2: Fix now-playing.tsx (hero image, above fold)

**File: `apps/web/src/components/session/now-playing.tsx`**

```tsx
import Image from "next/image";
import EqualizerBars from "@/components/ui/equalizer-bars";

// ... interface unchanged ...

export default function NowPlaying({ song }: NowPlayingProps) {
	// ... null check unchanged ...

	return (
		<div
			className="m-4 rounded-lg border border-primary/20 bg-card p-4"
			style={{
				boxShadow:
					"0 0 20px color-mix(in oklch, var(--primary) 10%, transparent)",
			}}
		>
			<p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-widest">
				Now Playing
			</p>
			<div className="flex items-center gap-4">
				{song.thumbnailUrl && (
					<Image
						src={song.thumbnailUrl}
						alt={song.title}
						width={80}
						height={80}
						className="h-20 w-20 rounded-xl border-2 border-primary/30 object-cover"
						priority  // Above-fold hero image -- load immediately
					/>
				)}
				<div className="min-w-0 flex-1">
					<p className="truncate font-bold font-heading text-lg">
						{song.title}
					</p>
					{song.artist && (
						<p className="truncate text-muted-foreground">{song.artist}</p>
					)}
					<EqualizerBars />
				</div>
			</div>
		</div>
	);
}
```

Key changes:
- `import Image from "next/image"`
- `<img>` replaced with `<Image>`
- `width={80} height={80}` -- explicit dimensions prevent layout shift
- `priority` -- this is the above-fold hero image; skip lazy loading

### Step 3: Fix song-queue.tsx (list thumbnails, lazy loaded)

**File: `apps/web/src/components/session/song-queue.tsx`**

```tsx
import Image from "next/image";
import { ListMusic } from "lucide-react";
import VoteButton from "./vote-button";

// ... interfaces unchanged ...

// Inside the map render:
{song.thumbnailUrl && (
	<Image
		src={song.thumbnailUrl}
		alt=""
		width={48}
		height={48}
		className="h-12 w-12 rounded-md object-cover"
		// loading="lazy" is the default for next/image
	/>
)}
```

Key changes:
- `width={48} height={48}` matches the CSS `h-12 w-12` (48px)
- Default lazy loading ensures below-fold thumbnails don't load immediately

### Step 4: Fix song-search.tsx (search result thumbnails)

**File: `apps/web/src/components/session/song-search.tsx`**

```tsx
import Image from "next/image";

// Inside the search results map (line 94-99):
{track.thumbnailUrl && (
	<Image
		src={track.thumbnailUrl}
		alt=""
		width={48}
		height={48}
		className="h-12 w-12 rounded object-cover"
	/>
)}
```

### Step 5: Fix session-dashboard.tsx (owner search results)

**File: `apps/web/src/components/venue/session-dashboard.tsx`**

```tsx
import Image from "next/image";

// Inside the search results map (line 198-203):
{track.thumbnailUrl && (
	<Image
		src={track.thumbnailUrl}
		alt={track.title}
		width={40}
		height={40}
		className="h-10 w-10 rounded"
	/>
)}
```

### Step 6: Fix queue-manager.tsx (owner queue thumbnails)

**File: `apps/web/src/components/venue/queue-manager.tsx`**

```tsx
import Image from "next/image";

// Inside the queue items map (line 46-49):
{song.thumbnailUrl && (
	<Image
		src={song.thumbnailUrl}
		alt=""
		width={40}
		height={40}
		className="h-10 w-10 rounded object-cover"
	/>
)}
```

---

## Verification

### 1. Build-time check

After adding `remotePatterns`, verify the build succeeds:

```bash
cd apps/web && npm run build
```

If `remotePatterns` is misconfigured, Next.js will throw an error at build time referencing the blocked hostname.

### 2. Runtime check -- Network tab

1. Open DevTools > Network tab
2. Load a session with 20+ songs in queue
3. Filter by "Img" type

**Before fix:**
- All images load immediately (no lazy loading)
- Content-Type: `image/jpeg`
- Each image: ~30-50KB
- Total: ~1-2MB

**After fix:**
- Only visible images load initially (lazy loading)
- Content-Type: `image/webp` or `image/avif`
- Each image: ~2-5KB (resized to display dimensions)
- Total: ~50-100KB

### 3. Lighthouse audit

Run Lighthouse Performance audit on the session page:

**Before:** Expect warnings for:
- "Properly size images" (oversized thumbnails)
- "Serve images in next-gen formats" (JPEG instead of WebP/AVIF)
- "Defer offscreen images" (all loading eagerly)

**After:** All three warnings should be resolved.

### 4. Visual regression check

Verify all thumbnails still render correctly:
- Now Playing: 80x80 rounded with border
- Song Queue: 48x48 rounded
- Song Search: 48x48 rounded
- Session Dashboard: 40x40 rounded
- Queue Manager: 40x40 rounded with object-cover

---

## Related Files

- `apps/web/next.config.ts` -- Needs `remotePatterns` configuration (primary blocker)
- `apps/web/src/components/session/now-playing.tsx` -- Hero album art (lines 36-39)
- `apps/web/src/components/session/song-queue.tsx` -- Queue list thumbnails (lines 50-53)
- `apps/web/src/components/session/song-search.tsx` -- Search result thumbnails (lines 94-99)
- `apps/web/src/components/venue/session-dashboard.tsx` -- Owner search thumbnails (lines 198-203)
- `apps/web/src/components/venue/queue-manager.tsx` -- Owner queue thumbnails (lines 46-49)
- `packages/api/src/music/providers/youtube.ts` -- Source of thumbnail URLs (likely `i.ytimg.com`)
