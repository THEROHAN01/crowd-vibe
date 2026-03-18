import type { SSEEvent } from "./types";

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
	}
}

const globalForSSE = globalThis as unknown as {
	channelManager: SSEChannelManager;
};
export const channelManager =
	globalForSSE.channelManager ?? new SSEChannelManager();
globalForSSE.channelManager = channelManager;

export type { SSEEvent };
