# PERF-004: SSE connections leak -- no heartbeat-based cleanup or subscriber limits

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| **Severity**     | P0 CRITICAL                                    |
| **Category**     | Performance / Infrastructure / Security        |
| **File**         | `packages/api/src/sse/channel-manager.ts`      |
| **Lines**        | 1-66 (entire file)                             |
| **Also affects** | `apps/web/src/app/api/sse/[sessionId]/route.ts`|
| **Discovered**   | 2026-03-18                                     |
| **Status**       | Open                                           |

---

## Summary

The SSE channel manager stores writers in a `Map<string, Set<SSEWriter>>` but has **no proactive mechanism** to detect and remove dead connections. While the SSE route has a heartbeat timer and abort listener, there are race conditions and edge cases where writers remain in the set after the client has disconnected. Additionally, there is **no subscriber limit per channel** (DDoS amplification vector), **no periodic sweep** of dead writers, and the **broadcast loop is synchronous** -- one slow/dead write blocks all other subscribers.

---

## Architecture Overview

### Channel Manager (`packages/api/src/sse/channel-manager.ts`, lines 1-66)

```typescript
type SSEWriter = {
	write: (data: string) => void;
	close: () => void;
};

class SSEChannelManager {
	private channels = new Map<string, Set<SSEWriter>>();

	subscribe(sessionId: string, writer: SSEWriter): void {
		if (!this.channels.has(sessionId)) {
			this.channels.set(sessionId, new Set());
		}
		this.channels.get(sessionId)!.add(writer);
	}

	unsubscribe(sessionId: string, writer: SSEWriter): void {
		const channel = this.channels.get(sessionId);
		if (channel) {
			channel.delete(writer);
			if (channel.size === 0) {
				this.channels.delete(sessionId);
			}
		}
	}

	broadcast(sessionId: string, event: SSEEvent): void {
		const channel = this.channels.get(sessionId);
		if (!channel) return;
		const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
		for (const writer of channel) {
			try {
				writer.write(payload);
			} catch {
				channel.delete(writer);
			}
		}
	}
	// ...
}
```

### SSE Route (`apps/web/src/app/api/sse/[sessionId]/route.ts`, lines 62-101)

```typescript
const stream = new ReadableStream({
	start(controller) {
		const writer = {
			write: (data: string) => {
				try {
					controller.enqueue(encoder.encode(data));
				} catch {
					// Stream closed
				}
			},
			close: () => {
				try {
					controller.close();
				} catch {
					// Already closed
				}
			},
		};

		channelManager.subscribe(sessionId, writer);

		// Send initial heartbeat
		writer.write(": connected\n\n");

		// Heartbeat every 30 seconds
		const heartbeat = setInterval(() => {
			try {
				writer.write(": heartbeat\n\n");
			} catch {
				clearInterval(heartbeat);
				channelManager.unsubscribe(sessionId, writer);
			}
		}, 30000);

		// Cleanup on close
		req.signal.addEventListener("abort", () => {
			clearInterval(heartbeat);
			channelManager.unsubscribe(sessionId, writer);
		});
	},
});
```

---

## Root Cause Analysis

### Problem 1: Race condition between abort and broadcast

The SSE route registers cleanup on `req.signal.abort` (line 98). The channel manager's `broadcast()` iterates the Set synchronously (lines 32-38). There is a race condition:

```
Timeline:
  T1: broadcast() starts iterating channel Set
  T2: Client disconnects -> abort signal fires
  T3: abort handler calls unsubscribe() -> deletes writer from Set
  T4: broadcast() is still iterating -> may have already passed the writer reference

  OR:

  T1: Client disconnects -> abort signal fires
  T2: abort handler calls unsubscribe()
  T3: broadcast() starts -> writer already removed -> OK (this path works)

  OR:

  T1: broadcast() calls writer.write() -> enqueue succeeds (buffered)
  T2: Client has disconnected but controller.enqueue() doesn't throw yet
  T3: Writer stays in Set because no error was thrown
  T4: Next broadcast: same thing (buffered writes don't immediately fail)
```

The critical issue is **T1-T4 in the first scenario** and the **buffered write problem**. `controller.enqueue()` writes to the ReadableStream's internal buffer. If the client has disconnected but the buffer isn't full, `enqueue()` succeeds silently. The writer appears alive but is writing to nowhere. The error only surfaces when the buffer overflows or when Node.js detects the TCP connection is dead (which can take minutes).

### Problem 2: Heartbeat catch block in the route doesn't always fire

The route's heartbeat (lines 88-95) attempts a write every 30 seconds:

```typescript
const heartbeat = setInterval(() => {
	try {
		writer.write(": heartbeat\n\n");
	} catch {
		clearInterval(heartbeat);
		channelManager.unsubscribe(sessionId, writer);
	}
}, 30000);
```

The `writer.write()` calls `controller.enqueue()` which catches errors silently:

```typescript
write: (data: string) => {
	try {
		controller.enqueue(encoder.encode(data));
	} catch {
		// Stream closed -- SWALLOWED, never propagated
	}
},
```

This means the heartbeat's catch block **never fires** because errors in `controller.enqueue()` are caught inside the writer. The heartbeat writes silently succeed (or silently fail), and the channel manager is never notified.

### Problem 3: No maximum subscriber limit

There is no cap on how many writers can subscribe to a single channel. An attacker (or a bug in the client that reconnects in a loop) could open thousands of SSE connections to a single session:

```typescript
subscribe(sessionId: string, writer: SSEWriter): void {
	if (!this.channels.has(sessionId)) {
		this.channels.set(sessionId, new Set());
	}
	this.channels.get(sessionId)!.add(writer);
	// No check: channel.size >= MAX_SUBSCRIBERS
}
```

Each subscriber increases the cost of every broadcast. With 1000 dead subscribers, a single vote event triggers 1000 write attempts (most failing silently), consuming CPU and blocking the event loop.

### Problem 4: No periodic sweep of dead connections

The `RateLimiter` class (`packages/api/src/lib/rate-limiter.ts`, lines 14-16) has a 5-minute sweep:

```typescript
// Sweep expired entries every 5 minutes to prevent unbounded memory growth
this.cleanupTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
this.cleanupTimer.unref();
```

The `SearchCache` (`packages/api/src/music/search-cache.ts`, lines 13-15) also has a sweep:

```typescript
// Sweep expired entries every 5 minutes
this.cleanupTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
this.cleanupTimer.unref();
```

The channel manager has **no sweep**. Dead writers accumulate indefinitely until a broadcast happens to trigger an error (which, as shown above, may never happen due to the swallowed catch).

### Problem 5: Broadcast is synchronous -- one slow write blocks all

```typescript
broadcast(sessionId: string, event: SSEEvent): void {
	const channel = this.channels.get(sessionId);
	if (!channel) return;
	const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
	for (const writer of channel) {  // <-- synchronous iteration
		try {
			writer.write(payload);   // <-- if this blocks, all others wait
		} catch {
			channel.delete(writer);
		}
	}
}
```

While `controller.enqueue()` is technically synchronous and fast, if the underlying stream back-pressures (slow client, full buffer), it can block. With 100+ subscribers, this serialized iteration adds latency to every broadcast.

---

## Leak Scenario Walkthrough

```
Time 0:00 - Session starts
  Channel A: 0 subscribers

Time 0:05 - 100 guests connect
  Channel A: 100 subscribers (100 active writers)

Time 0:30 - 50 guests close browsers / lose WiFi
  Actual clients: 50 alive, 50 dead
  Channel A: still 100 subscribers

  Why? The abort signal may not fire immediately on network drops.
  The heartbeat writes succeed silently (buffered, no throw).

Time 0:35 - Heartbeat fires for dead connections
  writer.write(": heartbeat\n\n") -> controller.enqueue() -> catch swallows error
  Dead writers remain in Set

Time 1:00 - 25 more guests leave, 30 new guests arrive
  Actual clients: 55 alive
  Channel A: 130 subscribers (75 dead, 55 alive)

Time 1:00 - Someone votes
  broadcast() iterates 130 writers:
    - 55 successful writes (real clients receive event)
    - 75 silent failures (writing to dead streams, no throw)
    - Total CPU: ~130 * enqueue overhead

Time 4:00 - Session has been running for hours
  Actual clients: 40 alive
  Channel A: 300+ subscribers (260+ dead)
  Every broadcast wastes CPU on 260+ dead writes
  Memory: 300+ writer objects + closures held in memory
```

---

## Impact Assessment

| Metric                     | Value                                           |
| -------------------------- | ----------------------------------------------- |
| **Memory leak rate**       | ~1-2 KB per dead writer (closure + references)  |
| **After 4hr session**      | 500+ dead writers = ~500KB-1MB leaked memory    |
| **CPU waste per broadcast**| O(dead_writers) unnecessary operations           |
| **Security risk**          | No subscriber cap = DDoS amplification          |
| **Attack vector**          | Open 10,000 SSE connections -> every vote triggers 10K writes |

---

## Fix

### Step 1: Fix writer error propagation

**File: `apps/web/src/app/api/sse/[sessionId]/route.ts`**

The writer's `write` method must propagate errors so the heartbeat catch block can fire:

```typescript
const writer = {
	write: (data: string) => {
		controller.enqueue(encoder.encode(data));
		// DO NOT catch here -- let errors propagate to callers
		// (heartbeat catch block, broadcast catch block)
	},
	close: () => {
		try {
			controller.close();
		} catch {
			// Already closed
		}
	},
};
```

### Step 2: Add heartbeat-based dead connection detection to channel manager

**File: `packages/api/src/sse/channel-manager.ts`**

```typescript
class SSEChannelManager {
	private channels = new Map<string, Set<SSEWriter>>();
	private sweepTimer: ReturnType<typeof setInterval>;
	private static readonly MAX_SUBSCRIBERS_PER_CHANNEL = 500;

	constructor() {
		// Sweep dead connections every 60 seconds
		this.sweepTimer = setInterval(() => this.sweep(), 60_000);
		this.sweepTimer.unref();
	}

	subscribe(sessionId: string, writer: SSEWriter): boolean {
		if (!this.channels.has(sessionId)) {
			this.channels.set(sessionId, new Set());
		}
		const channel = this.channels.get(sessionId)!;

		// Enforce subscriber limit
		if (channel.size >= SSEChannelManager.MAX_SUBSCRIBERS_PER_CHANNEL) {
			return false; // Caller should return 503
		}

		channel.add(writer);
		return true;
	}

	broadcast(sessionId: string, event: SSEEvent): void {
		const channel = this.channels.get(sessionId);
		if (!channel) return;
		const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
		const dead: SSEWriter[] = [];
		for (const writer of channel) {
			try {
				writer.write(payload);
			} catch {
				dead.push(writer);
			}
		}
		// Remove dead writers after iteration (safe -- not modifying Set during iteration)
		for (const writer of dead) {
			channel.delete(writer);
			try { writer.close(); } catch { /* already closed */ }
		}
		if (channel.size === 0) {
			this.channels.delete(sessionId);
		}
	}

	/**
	 * Sweep all channels -- attempt a no-op comment write to detect dead connections.
	 * SSE comment lines (starting with `:`) are ignored by EventSource clients.
	 */
	private sweep(): void {
		for (const [sessionId, channel] of this.channels) {
			const dead: SSEWriter[] = [];
			for (const writer of channel) {
				try {
					writer.write(": ping\n\n");
				} catch {
					dead.push(writer);
				}
			}
			for (const writer of dead) {
				channel.delete(writer);
				try { writer.close(); } catch { /* already closed */ }
			}
			if (channel.size === 0) {
				this.channels.delete(sessionId);
			}
		}
	}

	// ... rest of methods unchanged
}
```

### Step 3: Return 503 when subscriber limit is reached

**File: `apps/web/src/app/api/sse/[sessionId]/route.ts`**

```typescript
const subscribed = channelManager.subscribe(sessionId, writer);
if (!subscribed) {
	return new Response("Session is full. Try again later.", { status: 503 });
}
```

### Step 4: Make broadcast async with Promise.allSettled (optional optimization)

For very large channels (100+ subscribers), async broadcast prevents blocking the event loop:

```typescript
async broadcast(sessionId: string, event: SSEEvent): Promise<void> {
	const channel = this.channels.get(sessionId);
	if (!channel) return;
	const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;

	const results = await Promise.allSettled(
		Array.from(channel).map(async (writer) => {
			try {
				writer.write(payload);
			} catch {
				channel.delete(writer);
				try { writer.close(); } catch { /* already closed */ }
			}
		}),
	);
}
```

Note: Since `controller.enqueue()` is synchronous, the async version primarily helps if writers are ever changed to have async write methods (e.g., for WebSocket transport). For now, the sync version with post-iteration cleanup (Step 2) is sufficient.

---

## Verification

### 1. Test dead connection cleanup

```typescript
// In a test file
import { channelManager } from "@crowd-vibe/api/sse/channel-manager";

test("removes dead writers on broadcast", () => {
	const aliveWriter = { write: vi.fn(), close: vi.fn() };
	const deadWriter = {
		write: vi.fn(() => { throw new Error("stream closed"); }),
		close: vi.fn(),
	};

	channelManager.subscribe("session-1", aliveWriter);
	channelManager.subscribe("session-1", deadWriter);
	expect(channelManager.getListenerCount("session-1")).toBe(2);

	channelManager.broadcast("session-1", { type: "vote_changed", data: { songId: "s1", score: 5 } });

	expect(channelManager.getListenerCount("session-1")).toBe(1);
	expect(deadWriter.close).toHaveBeenCalled();
});
```

### 2. Test subscriber limit

```typescript
test("rejects subscription beyond limit", () => {
	for (let i = 0; i < 500; i++) {
		const result = channelManager.subscribe("session-2", { write: vi.fn(), close: vi.fn() });
		expect(result).toBe(true);
	}

	const result = channelManager.subscribe("session-2", { write: vi.fn(), close: vi.fn() });
	expect(result).toBe(false);
	expect(channelManager.getListenerCount("session-2")).toBe(500);
});
```

### 3. Monitor in production

Add logging to the sweep to track dead connection removal:

```typescript
private sweep(): void {
	let totalRemoved = 0;
	for (const [sessionId, channel] of this.channels) {
		// ... removal logic ...
		totalRemoved += dead.length;
	}
	if (totalRemoved > 0) {
		console.log(`[SSE] Sweep removed ${totalRemoved} dead connections`);
	}
}
```

---

## Related Files

- `packages/api/src/sse/channel-manager.ts` -- Channel manager implementation (primary fix location)
- `apps/web/src/app/api/sse/[sessionId]/route.ts` -- SSE route with writer creation and heartbeat (lines 62-101)
- `packages/api/src/sse/types.ts` -- SSE event type definitions
- `packages/api/src/lib/rate-limiter.ts` -- Reference implementation for periodic sweep pattern (lines 14-16)
- `packages/api/src/music/search-cache.ts` -- Reference implementation for periodic sweep pattern (lines 13-15)
- `packages/api/src/sse/channel-manager.test.ts` -- Existing tests (need to be extended)
