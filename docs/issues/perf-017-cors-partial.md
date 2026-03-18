# PERF-017: CORS Only Configured for Better Auth Routes — tRPC and SSE Routes Unprotected

| Field        | Value                                                                 |
|--------------|-----------------------------------------------------------------------|
| **Severity** | P2 MEDIUM                                                             |
| **Category** | Security / Cross-Origin Access                                        |
| **Files**    | `packages/auth/src/index.ts`, `apps/web/src/app/api/trpc/[trpc]/route.ts`, `apps/web/src/app/api/sse/[sessionId]/route.ts` |
| **Status**   | Open                                                                  |
| **Date**     | 2026-03-18                                                            |

---

## Problem Statement

Better Auth is configured with `trustedOrigins: [env.CORS_ORIGIN]`, which sets CORS headers on `/api/auth/*` routes. However, the tRPC API routes (`/api/trpc/*`) and SSE routes (`/api/sse/*`) have **no CORS headers at all**. This currently works because everything runs on the same origin, but it will break the moment any cross-origin access is needed.

### Better Auth CORS Configuration

**File: `packages/auth/src/index.ts`** (lines 36-47)

```typescript
export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
        enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins,
});
```

The `trustedOrigins` setting only affects Better Auth's own middleware. It adds `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Credentials` headers to responses from `/api/auth/*` endpoints.

### tRPC Route — No CORS Headers

**File: `apps/web/src/app/api/trpc/[trpc]/route.ts`** (lines 1-15)

```typescript
import { createContext } from "@crowd-vibe/api/context";
import { appRouter } from "@crowd-vibe/api/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

function handler(req: NextRequest) {
    return fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: () => createContext(req),
    });
}

export { handler as GET, handler as POST };
```

No CORS headers. No `OPTIONS` handler for preflight requests. A cross-origin `POST` to `/api/trpc/vote.cast` will be blocked by the browser.

### SSE Route — No CORS Headers

**File: `apps/web/src/app/api/sse/[sessionId]/route.ts`** (lines 105-111)

```typescript
return new Response(stream, {
    headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
    },
});
```

Only `Content-Type` and `Cache-Control` are set. No `Access-Control-Allow-Origin`. A cross-origin `EventSource` connection will fail silently (the browser blocks the response without an error visible to JavaScript).

---

## Scenarios Where This Breaks

### 1. Mobile App with WebView or Native HTTP Client

If you build a React Native or Flutter app that calls the API from a different origin (e.g., `capacitor://localhost` or a custom scheme), all tRPC and SSE calls will be CORS-blocked.

### 2. Guest View Embedded in an iframe

If a venue wants to embed the guest view (`/session/[id]`) in their own website via an iframe, the iframe's origin differs from the CrowdVibe API origin. All fetch calls from within the iframe will fail due to CORS.

### 3. Separate Frontend Domain

If you deploy the frontend to `app.crowdvibe.com` and the API to `api.crowdvibe.com` (a common architecture for scaling), all API calls become cross-origin and fail.

### 4. Local Development with Different Ports

If someone runs the API on port 3001 and the frontend on port 3000 during development, CORS errors will block all API calls from the frontend.

---

## Root Cause

CORS was treated as a Better Auth concern rather than an application-wide concern. The `trustedOrigins` configuration only applies to Better Auth's own route handler, leaving tRPC and SSE routes with the browser's default CORS policy (same-origin only).

---

## Impact Assessment

| Dimension               | Impact                                                                 |
|--------------------------|------------------------------------------------------------------------|
| **Current (same-origin)**| No impact -- everything works today                                   |
| **Mobile app**           | All API calls blocked -- complete showstopper                          |
| **iframe embed**         | Guest view unusable when embedded -- feature-blocking                  |
| **Multi-domain deploy**  | Full application failure until CORS is fixed                           |
| **Development**          | Multi-port dev setups silently fail                                    |

This is classified as P2 because it does not affect current production functionality, but it is a **time bomb** that will surface the moment any cross-origin use case is attempted, and the fix is straightforward.

---

## Fix Instructions

### Option A: Next.js Middleware (Recommended — Global Fix)

Add CORS headers to all API routes using Next.js middleware. This is a single-file change that covers all routes.

**File: `apps/web/src/middleware.ts`** (create or modify)

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

export function middleware(req: NextRequest) {
    // Only apply CORS to API routes
    if (!req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.next();
    }

    // Handle preflight OPTIONS requests
    if (req.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    // Add CORS headers to all API responses
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    response.headers.set("Access-Control-Allow-Credentials", "true");

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
```

### Option B: Per-Route CORS Headers

If you prefer explicit per-route control:

#### tRPC Route

**File: `apps/web/src/app/api/trpc/[trpc]/route.ts`**

```typescript
import { createContext } from "@crowd-vibe/api/context";
import { appRouter } from "@crowd-vibe/api/routers/index";
import { env } from "@crowd-vibe/env/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

const corsHeaders = {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
} as const;

// Handle preflight
export function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
}

async function handler(req: NextRequest) {
    const response = await fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: () => createContext(req),
    });

    // Clone response and add CORS headers
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
        newHeaders.set(key, value);
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

export { handler as GET, handler as POST };
```

#### SSE Route

**File: `apps/web/src/app/api/sse/[sessionId]/route.ts`** (around line 105)

```typescript
return new Response(stream, {
    headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Access-Control-Allow-Origin": env.CORS_ORIGIN,
        "Access-Control-Allow-Credentials": "true",
    },
});
```

### Option C: Hybrid Approach

Use middleware for the common case, but also add explicit headers in route handlers as a defense-in-depth measure. This protects against middleware being accidentally removed or misconfigured.

---

## Security Considerations

1. **Do not use `Access-Control-Allow-Origin: *`** -- the API uses cookies for authentication (`cv_guest` cookie and Better Auth session cookies). Wildcard origin is incompatible with `credentials: "include"`.

2. **Validate the origin in production.** If you need to support multiple origins (e.g., web + mobile), use a whitelist:

```typescript
const ALLOWED_ORIGINS = new Set([
    env.CORS_ORIGIN,
    "capacitor://localhost",
    // Add mobile app origins here
]);

function getCorsOrigin(req: NextRequest): string | null {
    const origin = req.headers.get("origin");
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        return origin;
    }
    return null;
}
```

3. **`Access-Control-Allow-Credentials: "true"`** is required because the API uses cookies. Without it, browsers will block cookie-bearing requests even if the origin matches.

---

## Verification

### Test 1: Same-Origin (Regression Check)

1. Run the app normally on `localhost:3000`
2. All existing functionality (auth, search, voting, SSE) should work unchanged

### Test 2: Cross-Origin Simulation

1. Start the app on port 3000
2. Open a browser console on a different origin (e.g., `about:blank` or another local server on port 4000):

```javascript
// tRPC test
fetch("http://localhost:3000/api/trpc/queue.list?input=%7B%22sessionId%22%3A%22test%22%7D", {
    credentials: "include",
})
.then(r => console.log("Status:", r.status))
.catch(e => console.error("CORS blocked:", e));

// SSE test
const es = new EventSource("http://localhost:3000/api/sse/test-session", {
    withCredentials: true,
});
es.onopen = () => console.log("SSE connected");
es.onerror = (e) => console.error("SSE error:", e);
```

**Before fix:** Both calls fail with CORS errors in the console.
**After fix:** The tRPC call returns a response (may be 401, but not CORS-blocked). The SSE connection opens (may be 401, but not CORS-blocked).

### Test 3: Preflight Request

```bash
curl -v -X OPTIONS http://localhost:3000/api/trpc/queue.list \
    -H "Origin: http://localhost:4000" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type"
```

**Expected response:** `204 No Content` with `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers` headers.

---

## Related Issues

- None directly, but this is a prerequisite for any future mobile app or embed feature.
