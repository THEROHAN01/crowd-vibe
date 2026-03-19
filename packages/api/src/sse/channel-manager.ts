import type { SSEEvent } from "./types";

type SSEWriter = {
	write: (data: string) => void;
	close: () => void;
};

const MAX_SUBSCRIBERS_PER_SESSION = 100;

class SSEChannelManager {
	private channels = new Map<string, Set<SSEWriter>>();
	private listenerDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor() {
		// Sweep empty channels every 60 seconds
		// .unref() prevents this timer from keeping the Node.js process alive
		setInterval(() => this.sweep(), 60_000).unref();
	}

	subscribe(sessionId: string, writer: SSEWriter): boolean {
		if (!this.channels.has(sessionId)) {
			this.channels.set(sessionId, new Set());
		}
		const channel = this.channels.get(sessionId)!;
		if (channel.size >= MAX_SUBSCRIBERS_PER_SESSION) {
			return false; // reject — too many subscribers
		}
		channel.add(writer);
		this.scheduleBroadcastListenerCount(sessionId);
		return true;
	}

	unsubscribe(sessionId: string, writer: SSEWriter): void {
		const channel = this.channels.get(sessionId);
		if (channel) {
			channel.delete(writer);
			if (channel.size === 0) {
				this.channels.delete(sessionId);
			} else {
				this.scheduleBroadcastListenerCount(sessionId);
			}
		}
	}

	broadcast(sessionId: string, event: SSEEvent): void {
		const channel = this.channels.get(sessionId);
		if (!channel) return;
		const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
		const failed: SSEWriter[] = [];
		for (const writer of channel) {
			try {
				writer.write(payload);
			} catch {
				failed.push(writer);
			}
		}
		// Clean up failed writers
		for (const writer of failed) {
			channel.delete(writer);
		}
	}

	getListenerCount(sessionId: string): number {
		return this.channels.get(sessionId)?.size ?? 0;
	}

	reset() {
		for (const channel of this.channels.values()) {
			for (const writer of channel) {
				try {
					writer.close();
				} catch {
					// Writer already closed
				}
			}
		}
		this.channels.clear();
		for (const timer of this.listenerDebounceTimers.values()) {
			clearTimeout(timer);
		}
		this.listenerDebounceTimers.clear();
	}

	/** Debounce listener count broadcasts to collapse rapid connect/disconnect bursts */
	private scheduleBroadcastListenerCount(sessionId: string): void {
		const existing = this.listenerDebounceTimers.get(sessionId);
		if (existing) clearTimeout(existing);

		const timer = setTimeout(() => {
			this.listenerDebounceTimers.delete(sessionId);
			const count = this.getListenerCount(sessionId);
			if (count > 0) {
				this.broadcast(sessionId, {
					type: "listener_changed",
					data: { count },
				});
			}
		}, 500);

		this.listenerDebounceTimers.set(sessionId, timer);
	}

	private sweep() {
		for (const [sessionId, channel] of this.channels) {
			if (channel.size === 0) {
				this.channels.delete(sessionId);
			}
		}
	}
}

const globalForSSE = globalThis as unknown as {
	channelManager: SSEChannelManager;
};
export const channelManager =
	globalForSSE.channelManager ?? new SSEChannelManager();
globalForSSE.channelManager = channelManager;

export type { SSEEvent };
