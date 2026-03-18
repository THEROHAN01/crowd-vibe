# PERF-020: Home Page Is Unnecessarily a Client Component

| Field        | Value                                                           |
|--------------|-----------------------------------------------------------------|
| **Severity** | P2 MEDIUM                                                       |
| **Category** | Performance / Bundle Size                                       |
| **File**     | `apps/web/src/app/page.tsx`                                     |
| **Status**   | Open                                                            |
| **Date**     | 2026-03-18                                                      |

---

## Problem Statement

The home/landing page has a `"use client"` directive but renders only static content: a Logo, a heading, a paragraph, a `Link`, and a `Button`. None of these require client-side interactivity (no state, no effects, no event handlers besides the Link navigation). As a server component, this page would be rendered as static HTML with zero client JavaScript.

### Current Implementation

**File: `apps/web/src/app/page.tsx`** (lines 1-32)

```tsx
"use client";

import { Button } from "@crowd-vibe/ui/components/button";
import Link from "next/link";
import Logo from "@/components/ui/logo";

export default function Home() {
    return (
        <div
            className="flex h-full flex-col items-center justify-center gap-8 px-4"
            style={{
                background:
                    "radial-gradient(ellipse at center, color-mix(in oklch, var(--primary) 5%, transparent), transparent)",
            }}
        >
            <div className="text-center">
                <h1 className="mb-2">
                    <Logo size="lg" />
                </h1>
                <p className="max-w-md text-lg text-muted-foreground">
                    Let the crowd control the vibe. Vote on songs in real-time at your
                    favorite venues.
                </p>
            </div>
            <div className="flex gap-4">
                <Link href="/dashboard">
                    <Button size="lg">Venue Dashboard</Button>
                </Link>
            </div>
        </div>
    );
}
```

### Why `"use client"` Is Unnecessary Here

Let's analyze every element on this page:

| Element            | Requires Client JS? | Notes                                              |
|--------------------|---------------------|----------------------------------------------------|
| `<div>` with style | No                  | Static inline style, no dynamic values             |
| `<Logo size="lg">` | **See below**       | Currently has `"use client"` but doesn't need it   |
| `<p>` text         | No                  | Static text                                        |
| `<Link>`           | No                  | Next.js `Link` works in server components          |
| `<Button>`         | **See below**       | May have `"use client"` in the UI library          |

The root cause is likely that the `Logo` component has `"use client"` (see below), which made the developer add `"use client"` to the page as well. However, in Next.js App Router, a server component can render client components -- the client component simply becomes a hydration boundary.

### Logo Component Analysis

**File: `apps/web/src/components/ui/logo.tsx`** (lines 1-43)

```tsx
"use client";

interface LogoProps {
    size?: "sm" | "default" | "lg";
    showMark?: boolean;
}

function LogoMark({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 40 40"
            fill="none"
            className={className}
            aria-hidden="true"
        >
            <rect x="4" y="20" width="8" height="16" rx="4" fill="currentColor" />
            <rect x="16" y="8" width="8" height="28" rx="4" fill="currentColor" />
            <rect x="28" y="14" width="8" height="22" rx="4" fill="currentColor" />
        </svg>
    );
}

const sizeMap = {
    sm: { text: "text-lg", mark: "h-5 w-5" },
    default: { text: "text-2xl", mark: "h-6 w-6" },
    lg: { text: "text-5xl", mark: "h-10 w-10" },
};

export default function Logo({ size = "default", showMark = true }: LogoProps) {
    const s = sizeMap[size];
    return (
        <span className={`inline-flex items-center gap-2 font-bold font-heading ${s.text} tracking-tight`}>
            {showMark && <LogoMark className={`${s.mark} text-primary`} />}
            <span>
                <span className="text-foreground">Crowd</span>
                <span className="text-primary">Vibe</span>
            </span>
        </span>
    );
}
```

The Logo component also has `"use client"` but contains:
- No `useState`, `useEffect`, `useRef`, or any hooks
- No event handlers (`onClick`, `onChange`, etc.)
- No browser APIs (`window`, `document`, etc.)
- Only static SVG and text rendering with className props

This component is a pure render function that can be a server component.

---

## Root Cause

The `"use client"` directive was added to `logo.tsx` (possibly during initial development when it was templated from a component that did need client features), and then propagated to `page.tsx` because the developer assumed a page importing a client component must itself be a client component. In Next.js App Router, this is not the case -- server components can import and render client components.

---

## Impact Assessment

### Bundle Size Impact

With `"use client"`, the page.tsx component and all its imports are sent as JavaScript to the client for hydration:

| Module                         | Estimated Size (gzipped) |
|--------------------------------|--------------------------|
| `page.tsx` component code      | ~0.5 KB                  |
| `Logo` component + SVG         | ~0.5 KB                  |
| `Button` component (shadcn/ui) | ~1-2 KB                  |
| React hydration overhead       | ~2-3 KB                  |
| **Total unnecessary JS**       | **~4-6 KB**              |

### Performance Metrics Impact

| Metric                    | With `"use client"` | As Server Component | Delta |
|---------------------------|--------------------|--------------------|-------|
| **JavaScript bundle**     | 4-6 KB gzipped     | 0 KB (static HTML) | -100% |
| **Time to Interactive**   | Needs hydration     | Instant (no JS)    | Faster |
| **First Contentful Paint**| After JS parse      | On HTML arrival    | Faster |
| **Lighthouse Performance**| Penalized for unused JS | No penalty     | +3-5 pts |

For a landing page, these differences matter disproportionately because:
1. It is the first page new users see -- first impressions count
2. Landing pages should be the fastest page on the site
3. Google's Core Web Vitals use the landing page for ranking signals

### Qualitative Impact

- The landing page loads 4-6 KB of JavaScript that does nothing (no interactivity exists on the page)
- On slow 3G connections, this adds ~100-200ms to Time to Interactive for zero benefit
- The page cannot be statically generated by Next.js as efficiently (client components require hydration payloads in the RSC stream)

---

## Fix Instructions

### Step 1: Remove `"use client"` from Logo

**File: `apps/web/src/components/ui/logo.tsx`**

Remove the `"use client"` directive on line 1. The Logo component is a pure server component -- it has no hooks, event handlers, or browser APIs.

Before:
```tsx
"use client";

interface LogoProps {
```

After:
```tsx
interface LogoProps {
```

**Important:** The Logo component is also used in `session-view.tsx` (line 10) and potentially other client components. When a client component imports a server component, Next.js automatically handles this -- the server component is rendered on the server and its output is serialized into the RSC payload. However, if any client component tries to pass a callback prop or ref to Logo in the future, it would need `"use client"` again.

Check all Logo import sites:
- `apps/web/src/app/page.tsx` -- will be a server component (after Step 2)
- `apps/web/src/app/session/[id]/session-view.tsx` -- client component, but Logo receives no callbacks/refs

Both usage sites are safe for Logo to be a server component.

### Step 2: Remove `"use client"` from the Home Page

**File: `apps/web/src/app/page.tsx`**

Remove the `"use client"` directive on line 1.

Before:
```tsx
"use client";

import { Button } from "@crowd-vibe/ui/components/button";
import Link from "next/link";
import Logo from "@/components/ui/logo";
```

After:
```tsx
import { Button } from "@crowd-vibe/ui/components/button";
import Link from "next/link";
import Logo from "@/components/ui/logo";
```

**Note:** The `Button` component from `@crowd-vibe/ui` likely has its own `"use client"` directive (shadcn/ui buttons are client components because they forward refs and can accept `onClick`). This is fine -- Next.js server components can render client components. The Button will be a client island within the server-rendered page. Since the Button on this page has no `onClick` handler (it's wrapped in a `Link`), even the Button's hydration is minimal.

### Step 3: Verify the Button Component

Check if `@crowd-vibe/ui/components/button` has `"use client"`. If it does, the page will work as-is (server component rendering a client component). If it does not, even better -- the entire page is pure server-rendered HTML.

```bash
grep -n "use client" packages/ui/src/components/button.tsx
```

### Step 4: Consider Adding `export const dynamic = "force-static"`

Since the landing page has no dynamic data, you can force static generation:

```tsx
import { Button } from "@crowd-vibe/ui/components/button";
import Link from "next/link";
import Logo from "@/components/ui/logo";

export const dynamic = "force-static";

export default function Home() {
    // ... same JSX
}
```

This ensures the page is rendered at build time and served as a static HTML file with no server-side computation per request.

---

## Verification

### Step 1: Check Bundle Impact

Before and after the fix, run:

```bash
# Build with bundle analysis
ANALYZE=true pnpm build
```

Or use the Next.js built-in bundle analyzer:

```bash
npx @next/bundle-analyzer
```

Compare the client-side JavaScript bundle for the `/` route. It should drop by 4-6 KB (gzipped).

### Step 2: Check the Page Source

After the fix, view the page source (`View Page Source` in the browser):

- **Before:** The HTML contains a `<script>` tag with the page component serialized for hydration
- **After:** The HTML contains the fully rendered page content with no hydration script for the page itself (client components like Button may still have small hydration markers)

### Step 3: Verify Functionality

1. Navigate to `/` -- the landing page should render identically
2. Click "Venue Dashboard" -- should navigate to `/dashboard`
3. The Logo should render correctly (SVG + text)
4. The radial gradient background should still be visible (inline `style` works in server components)

### Step 4: Lighthouse Audit

Run a Lighthouse audit on the `/` route before and after:

```bash
npx lighthouse http://localhost:3000 --only-categories=performance
```

Expected improvement: +3-5 points on Performance score due to reduced JavaScript.

---

## Related Issues

- This is a standalone issue with no direct dependencies on other P2 issues.
- If more components are found to have unnecessary `"use client"` directives, they should be audited in a similar fashion.
