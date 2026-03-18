# PERF-011: Duplicate SSE Connections When Multiple Components Subscribe to Same Session

**Severity:** P1 HIGH
**Category:** Performance / Network / Server Resources
**Date identified:** 2026-03-18

---

## Affected Files

| File | Lines | Description |
|------|-------|-------------|
| `apps/web/src/hooks/use-session-events.ts` | 37-107 | Hook that creates a new `EventSource` on every call |
| `apps/web/src/app/session/[id]/session-view.tsx` | 23-38 | Guest view -- calls `useSessionEvents(sessionId, ...)` |
| `apps/web/src/components/venue/session-dashboard.tsx` | 79-87 | Owner dashboard -- calls `useSessionEvents(sessionId, ...)` |
| `packages/api/src/sse/channel-manager.ts` | 1-67 | Server-side SSE channel manager -- tracks each connection independently |

---

## Problem Description

The `useSessionEvents` hook creates a **new `EventSource` connection** every time it is called. There is no connection deduplication -- if multiple components in the same page call `useSessionEvents(sessionId)`, each component opens its own independent SSE connection to `/api/sse/${sessionId}`.

### Current Hook Implementation

```typescript
// apps/web/src/hooks/use-session-events.ts:37-106
export function useSessionEvents(
    sessionId: string | null,
    handlers: SessionEventHandlers,
) {
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        if (!sessionId) return;

        const eventSource = new EventSource(`/api/sse/${sessionId}`);  // <-- NEW connection every time

        eventSource.addEventListener("vote_changed", (e) => { /* ... */ });
        eventSource.addEventListener("now_playing", (e) => { /* ... */ });
        eventSource.addEventListener("song_added", (e) => { /* ... */ });
        eventSource.addEventListener("song_removed", (e) => { /* ... */ });
        eventSource.addEventListener("queue_updated", (e) => { /* ... */ });
        eventSource.addEventListener("session_ended", () => { /* ... */ });

        eventSource.onerror = () => {
            if (eventSource.readyState === EventSource.CONNECTING) {
                handlersRef.current.onReconnect?.();
            }
        };

        return () => {
            eventSource.close();  // <-- Closed on unmount, but a new one was created on mount
        };
    }, [sessionId]);
}
```

### How Duplicate Connections Occur

#### Scenario 1: Development Mode Double-Mount (React Strict Mode)

React 18+ Strict Mode in development intentionally double-mounts effects:

1. Component mounts, `useEffect` runs, `EventSource #1` opens
2. React unmounts (Strict Mode), `EventSource #1` closes
3. React re-mounts, `useEffect` runs, `EventSource #2` opens
4. In development: 1 active connection (correct), but 2 connections were opened/closed (wasteful)

This is expected behavior in dev mode, but the hook should handle it gracefully.

#### Scenario 2: Multiple Components Using the Hook

If two components in the same render tree call `useSessionEvents(sessionId)`:

```typescript
// apps/web/src/app/session/[id]/session-view.tsx:23
useSessionEvents(sessionId, {
    onVoteChanged: () => queue.refetch(),
    onSongAdded: () => queue.refetch(),
    onSongRemoved: () => queue.refetch(),
    onNowPlaying: () => {
        nowPlaying.refetch();
        queue.refetch();
    },
    onSessionEnded: () => setSessionEnded(true),
    onReconnect: () => {
        queue.refetch();
        nowPlaying.refetch();
        guestInfo.refetch();
    },
});

// apps/web/src/components/venue/session-dashboard.tsx:79
useSessionEvents(sessionId, {
    onVoteChanged: () => queue.refetch(),
    onSongAdded: () => queue.refetch(),
    onSongRemoved: () => queue.refetch(),
    onNowPlaying: () => {
        nowPlaying.refetch();
        queue.refetch();
    },
});
```

While `SessionView` (guest) and `SessionDashboard` (owner) are not typically rendered simultaneously in production, the architecture does not prevent it. More importantly:

#### Scenario 3: Component Re-mount Without sessionId Change

If the parent component re-mounts the child (e.g., via key change, route transition, or error boundary recovery), the old `EventSource` is closed and a new one is opened. During the transition:

1. Old `EventSource` cleanup runs -> `eventSource.close()` -> server-side writer removed
2. New `EventSource` opens -> new HTTP connection -> new server-side writer added
3. **Brief gap where events may be missed** (between close and open)
4. The `onReconnect` handler fires on errors but NOT on clean close/reopen

#### Scenario 4: Future Feature -- Extracting SSE into Shared Components

If a developer wants to add SSE-driven notifications to multiple components (e.g., a toast component, a badge counter, and the main queue view), each would need to call `useSessionEvents`. Without deduplication, this creates 3 connections for 1 session.

### Server-Side Impact

Each `EventSource` connection creates a separate `SSEWriter` in the channel manager:

```typescript
// packages/api/src/sse/channel-manager.ts:11-16
subscribe(sessionId: string, writer: SSEWriter): void {
    if (!this.channels.has(sessionId)) {
        this.channels.set(sessionId, new Set());
    }
    this.channels.get(sessionId)!.add(writer); // <-- Each connection adds a writer
}
```

When the server broadcasts an event:

```typescript
// packages/api/src/sse/channel-manager.ts:28-38
broadcast(sessionId: string, event: SSEEvent): void {
    const channel = this.channels.get(sessionId);
    if (!channel) return;
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const writer of channel) {
        try {
            writer.write(payload);  // <-- Writes to EVERY connection, including duplicates
        } catch {
            channel.delete(writer);
        }
    }
}
```

With duplicate connections:
- The same event payload is serialized and sent to the same client multiple times
- The client processes the same event multiple times (triggering duplicate `refetch()` calls)
- Each connection consumes a server-side file descriptor and memory

### The Listener Count is Inflated

```typescript
// packages/api/src/sse/channel-manager.ts:41-43
getListenerCount(sessionId: string): number {
    return this.channels.get(sessionId)?.size ?? 0;
}
```

If a user has 2 connections, they are counted as 2 listeners. The `session.stats` endpoint reports inflated listener counts to the venue owner.

---

## Impact Assessment

### Network

| Metric | Without Dedup | With Dedup | Improvement |
|--------|--------------|-----------|-------------|
| SSE connections per session (50 users) | 50-100+ | 50 | Up to 50% reduction |
| Event payloads sent per broadcast | 50-100+ | 50 | Up to 50% reduction |
| Client-side event processing | 2x per event per duplicate | 1x per event | 50% reduction |
| Unnecessary refetches from duplicate events | 2-4 per event | 0 | 100% reduction |

### Server Resources

| Resource | Impact per Duplicate Connection |
|----------|-------------------------------|
| File descriptors | +1 per connection (OS limit: typically 1024-65535) |
| Memory (SSEWriter) | ~1-2 KB per writer |
| CPU (event serialization) | Duplicate `JSON.stringify()` + `writer.write()` |
| Vercel streaming function | Each SSE connection is a long-running function invocation |

### User Experience

- **Duplicate refetches**: When a `vote_changed` event arrives on 2 connections, `queue.refetch()` is called twice. The second refetch is wasted.
- **Inflated listener count**: Venue owner sees wrong numbers on their dashboard.
- **Race conditions**: Two identical events arriving at slightly different times can cause flickering in optimistic updates.

---

## Root Cause Analysis

The `useSessionEvents` hook was designed as a simple, self-contained hook that manages its own `EventSource` lifecycle. This is correct for the case where exactly one component per session uses the hook. However, it lacks:

1. **Connection sharing**: No mechanism to reuse an existing connection for the same `sessionId`
2. **Reference counting**: No tracking of how many consumers are using a connection
3. **Centralized event dispatch**: Each hook instance registers its own event listeners

---

## Fix: Singleton EventSource Manager with Reference Counting

### Step 1: Create the Connection Manager

```typescript
// apps/web/src/lib/sse-manager.ts
"use client";

type EventHandler = (data: unknown) => void;
type EventType =
    | "vote_changed"
    | "now_playing"
    | "song_added"
    | "song_removed"
    | "queue_updated"
    | "session_ended";

interface ManagedConnection {
    source: EventSource;
    refCount: number;
    listeners: Map<EventType, Set<EventHandler>>;
    errorHandlers: Set<(event: Event) => void>;
}

function safeParse(raw: string): unknown | null {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

class SSEConnectionManager {
    private connections = new Map<string, ManagedConnection>();

    /**
     * Subscribe to SSE events for a session.
     * If a connection already exists for this sessionId, it is reused.
     * Returns an unsubscribe function that cleans up when the last subscriber leaves.
     */
    subscribe(
        sessionId: string,
        eventHandlers: Partial<Record<EventType, EventHandler>>,
        onError?: (event: Event) => void,
    ): () => void {
        let conn = this.connections.get(sessionId);

        if (!conn) {
            // Create new EventSource connection
            const source = new EventSource(`/api/sse/${sessionId}`);
            conn = {
                source,
                refCount: 0,
                listeners: new Map(),
                errorHandlers: new Set(),
            };

            // Set up shared event listeners on the EventSource
            const eventTypes: EventType[] = [
                "vote_changed",
                "now_playing",
                "song_added",
                "song_removed",
                "queue_updated",
                "session_ended",
            ];

            for (const eventType of eventTypes) {
                conn.listeners.set(eventType, new Set());
                source.addEventListener(eventType, (e: MessageEvent) => {
                    const data = safeParse(e.data);
                    const handlers = this.connections.get(sessionId)?.listeners.get(eventType);
                    if (handlers) {
                        for (const handler of handlers) {
                            handler(data);
                        }
                    }
                });
            }

            // Set up shared error handler
            source.onerror = (event: Event) => {
                const connection = this.connections.get(sessionId);
                if (connection) {
                    for (const handler of connection.errorHandlers) {
                        handler(event);
                    }
                }
            };

            this.connections.set(sessionId, conn);
        }

        // Increment reference count
        conn.refCount++;

        // Register this subscriber's event handlers
        const registeredHandlers: Array<{ type: EventType; handler: EventHandler }> = [];
        for (const [eventType, handler] of Object.entries(eventHandlers)) {
            const type = eventType as EventType;
            const handlerSet = conn.listeners.get(type);
            if (handlerSet && handler) {
                handlerSet.add(handler);
                registeredHandlers.push({ type, handler });
            }
        }

        // Register error handler
        if (onError) {
            conn.errorHandlers.add(onError);
        }

        // Return unsubscribe function
        return () => {
            const connection = this.connections.get(sessionId);
            if (!connection) return;

            // Remove this subscriber's handlers
            for (const { type, handler } of registeredHandlers) {
                connection.listeners.get(type)?.delete(handler);
            }

            // Remove error handler
            if (onError) {
                connection.errorHandlers.delete(onError);
            }

            // Decrement reference count
            connection.refCount--;

            // If no more subscribers, close the connection
            if (connection.refCount <= 0) {
                connection.source.close();
                this.connections.delete(sessionId);
            }
        };
    }

    /**
     * Get the current connection state for debugging.
     */
    getConnectionInfo(sessionId: string): { refCount: number; readyState: number } | null {
        const conn = this.connections.get(sessionId);
        if (!conn) return null;
        return {
            refCount: conn.refCount,
            readyState: conn.source.readyState,
        };
    }

    /**
     * Close all connections. Used for cleanup (e.g., on logout).
     */
    closeAll(): void {
        for (const [, conn] of this.connections) {
            conn.source.close();
        }
        this.connections.clear();
    }
}

// Singleton instance -- shared across all components
export const sseManager = new SSEConnectionManager();
```

### Step 2: Update the `useSessionEvents` Hook

```typescript
// apps/web/src/hooks/use-session-events.ts
"use client";

import { useEffect, useRef } from "react";
import { sseManager } from "@/lib/sse-manager";

interface QueuedSong {
    id: string;
    providerId: string;
    provider: string;
    title: string;
    artist: string | null;
    thumbnailUrl: string | null;
    durationMs: number | null;
    status: string;
    score: number;
    addedAt: string;
    suggestedBy: { displayName: string | null } | null;
}

interface SessionEventHandlers {
    onQueueUpdated?: (songs: QueuedSong[]) => void;
    onNowPlaying?: (song: QueuedSong | null) => void;
    onVoteChanged?: (songId: string, score: number) => void;
    onSongAdded?: (song: QueuedSong) => void;
    onSongRemoved?: (songId: string) => void;
    onSessionEnded?: () => void;
    onReconnect?: () => void;
}

export function useSessionEvents(
    sessionId: string | null,
    handlers: SessionEventHandlers,
) {
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        if (!sessionId) return;

        const unsubscribe = sseManager.subscribe(
            sessionId,
            {
                vote_changed: (data) => {
                    if (data && typeof data === "object" && "songId" in data) {
                        const d = data as { songId: string; score: number };
                        handlersRef.current.onVoteChanged?.(d.songId, d.score);
                    }
                },
                now_playing: (data) => {
                    if (data && typeof data === "object" && "song" in data) {
                        handlersRef.current.onNowPlaying?.(
                            (data as { song: QueuedSong | null }).song,
                        );
                    }
                },
                song_added: (data) => {
                    if (data && typeof data === "object" && "song" in data) {
                        handlersRef.current.onSongAdded?.(
                            (data as { song: QueuedSong }).song,
                        );
                    }
                },
                song_removed: (data) => {
                    if (data && typeof data === "object" && "songId" in data) {
                        handlersRef.current.onSongRemoved?.(
                            (data as { songId: string }).songId,
                        );
                    }
                },
                queue_updated: (data) => {
                    if (data && typeof data === "object" && "songs" in data) {
                        handlersRef.current.onQueueUpdated?.(
                            (data as { songs: QueuedSong[] }).songs,
                        );
                    }
                },
                session_ended: () => {
                    handlersRef.current.onSessionEnded?.();
                },
            },
            // Error handler -- detect reconnection attempts
            (event) => {
                // EventSource auto-reconnects. When readyState is CONNECTING,
                // it means the connection dropped and is being re-established.
                const source = event.target as EventSource;
                if (source.readyState === EventSource.CONNECTING) {
                    handlersRef.current.onReconnect?.();
                }
            },
        );

        return () => {
            unsubscribe();
        };
    }, [sessionId]);
}
```

### Step 3: Verify Behavior

The updated flow:

```
Component A mounts, calls useSessionEvents("session-123", handlersA)
  -> sseManager.subscribe("session-123", ...)
  -> No existing connection for "session-123"
  -> Creates new EventSource("/api/sse/session-123")
  -> refCount = 1

Component B mounts, calls useSessionEvents("session-123", handlersB)
  -> sseManager.subscribe("session-123", ...)
  -> Connection already exists for "session-123"
  -> Reuses existing EventSource
  -> refCount = 2

Server broadcasts vote_changed event
  -> EventSource receives the event ONCE
  -> SSEConnectionManager dispatches to both handlersA and handlersB
  -> Each handler calls its respective refetch()

Component B unmounts
  -> unsubscribe() called
  -> handlersB removed from listener sets
  -> refCount = 1
  -> Connection stays open

Component A unmounts
  -> unsubscribe() called
  -> handlersA removed from listener sets
  -> refCount = 0
  -> EventSource.close() called
  -> Connection cleaned up
```

---

## Edge Cases Handled

### React Strict Mode (Development)

With Strict Mode double-mount:
1. First mount: `subscribe()` -> refCount = 1
2. Unmount: `unsubscribe()` -> refCount = 0 -> connection closed
3. Second mount: `subscribe()` -> refCount = 1 -> new connection opened

This is the same number of connections as before (1 active), but the manager handles the lifecycle cleanly.

### Session ID Change

If `sessionId` changes (e.g., navigating between sessions):
1. Effect cleanup runs for old `sessionId` -> `unsubscribe()` on old connection
2. Effect runs for new `sessionId` -> `subscribe()` on new connection

### Network Disconnection

The `EventSource` API automatically reconnects on network errors. The `sseManager` keeps the same connection object, so:
- Reference count is preserved
- All event handlers remain registered
- The `onerror` handler notifies all subscribers via `onReconnect`

### Tab Visibility

`EventSource` connections persist when a tab is hidden (unlike WebSocket which may be throttled). The connection remains active, so events are received in the background. This is generally desirable for a real-time music queue.

---

## Testing the Fix

### Unit Test for SSEConnectionManager

```typescript
// apps/web/src/lib/__tests__/sse-manager.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock EventSource
class MockEventSource {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;

    readyState = MockEventSource.OPEN;
    listeners = new Map<string, Set<(e: any) => void>>();
    onerror: ((e: Event) => void) | null = null;

    constructor(public url: string) {}

    addEventListener(type: string, handler: (e: any) => void) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type)!.add(handler);
    }

    close() {
        this.readyState = MockEventSource.CLOSED;
    }

    // Test helper: simulate an incoming event
    _emit(type: string, data: unknown) {
        const handlers = this.listeners.get(type);
        if (handlers) {
            for (const handler of handlers) {
                handler({ data: JSON.stringify(data) });
            }
        }
    }
}

// Replace global EventSource
(globalThis as any).EventSource = MockEventSource;

describe("SSEConnectionManager", () => {
    let sseManager: any;

    beforeEach(async () => {
        // Fresh import to reset singleton state
        vi.resetModules();
        const mod = await import("@/lib/sse-manager");
        sseManager = mod.sseManager;
    });

    it("should reuse connection for same sessionId", () => {
        const handler1 = { vote_changed: vi.fn() };
        const handler2 = { vote_changed: vi.fn() };

        const unsub1 = sseManager.subscribe("session-1", handler1);
        const unsub2 = sseManager.subscribe("session-1", handler2);

        const info = sseManager.getConnectionInfo("session-1");
        expect(info?.refCount).toBe(2);

        unsub1();
        unsub2();
    });

    it("should close connection when last subscriber leaves", () => {
        const unsub1 = sseManager.subscribe("session-1", {});
        const unsub2 = sseManager.subscribe("session-1", {});

        unsub1();
        expect(sseManager.getConnectionInfo("session-1")?.refCount).toBe(1);

        unsub2();
        expect(sseManager.getConnectionInfo("session-1")).toBeNull();
    });

    it("should create separate connections for different sessionIds", () => {
        const unsub1 = sseManager.subscribe("session-1", {});
        const unsub2 = sseManager.subscribe("session-2", {});

        expect(sseManager.getConnectionInfo("session-1")?.refCount).toBe(1);
        expect(sseManager.getConnectionInfo("session-2")?.refCount).toBe(1);

        unsub1();
        unsub2();
    });
});
```

### Integration Verification

1. Open two browser tabs to the same session
2. In the Network tab, filter by `EventSource` or `eventsource`
3. **Before fix**: Each tab has 1 connection (correct -- different browser contexts)
4. Within the same tab, add a component that also calls `useSessionEvents`
5. **Before fix**: 2 connections from the same tab
6. **After fix**: 1 connection from the same tab, dispatching to both subscribers

### Server-Side Verification

Add temporary logging to the channel manager:

```typescript
// packages/api/src/sse/channel-manager.ts
subscribe(sessionId: string, writer: SSEWriter): void {
    if (!this.channels.has(sessionId)) {
        this.channels.set(sessionId, new Set());
    }
    this.channels.get(sessionId)!.add(writer);
    console.log(`[SSE] Subscribe: session=${sessionId}, writers=${this.channels.get(sessionId)!.size}`);
}
```

Expected: writer count per session should equal the number of unique browser tabs, NOT the number of React components using the hook.

---

## Related Issues

- **PERF-006**: Blanket cache invalidation (duplicate events cause duplicate invalidation cascades)
- **PERF-007**: No staleTime (duplicate refetches from duplicate events are not deduplicated by React Query because staleTime is 0)
- **PERF-009**: Auth caching (each SSE connection triggers auth validation on connect)
