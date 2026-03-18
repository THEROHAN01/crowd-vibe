import { describe, it, expect, beforeEach } from "vitest";
import { channelManager } from "./channel-manager";

function createMockWriter() {
  const messages: string[] = [];
  let closed = false;
  return {
    writer: {
      write: (data: string) => {
        if (closed) throw new Error("Writer closed");
        messages.push(data);
      },
      close: () => {
        closed = true;
      },
    },
    messages,
    get closed() {
      return closed;
    },
  };
}

describe("SSEChannelManager", () => {
  beforeEach(() => {
    channelManager.reset();
  });

  it("subscribe and broadcast reaches writer", () => {
    const mock = createMockWriter();
    channelManager.subscribe("session-1", mock.writer);
    channelManager.broadcast("session-1", { type: "vote_changed", data: { songId: "s1", score: 5 } });

    expect(mock.messages).toHaveLength(1);
    expect(mock.messages[0]).toContain("event: vote_changed");
    expect(mock.messages[0]).toContain('"songId":"s1"');
  });

  it("broadcast to non-existent channel is a no-op", () => {
    channelManager.broadcast("no-channel", { type: "session_ended", data: {} });
  });

  it("unsubscribe stops delivery", () => {
    const mock = createMockWriter();
    channelManager.subscribe("session-1", mock.writer);
    channelManager.unsubscribe("session-1", mock.writer);
    channelManager.broadcast("session-1", { type: "session_ended", data: {} });

    expect(mock.messages).toHaveLength(0);
  });

  it("dead writer is auto-cleaned on broadcast", () => {
    const dead = createMockWriter();
    dead.writer.close();
    const alive = createMockWriter();

    channelManager.subscribe("session-1", dead.writer);
    channelManager.subscribe("session-1", alive.writer);
    channelManager.broadcast("session-1", { type: "session_ended", data: {} });

    expect(alive.messages).toHaveLength(1);
    expect(channelManager.getListenerCount("session-1")).toBe(1);
  });

  it("getListenerCount returns correct count", () => {
    expect(channelManager.getListenerCount("session-1")).toBe(0);

    const m1 = createMockWriter();
    const m2 = createMockWriter();
    channelManager.subscribe("session-1", m1.writer);
    channelManager.subscribe("session-1", m2.writer);

    expect(channelManager.getListenerCount("session-1")).toBe(2);
  });

  it("channels are isolated", () => {
    const mock1 = createMockWriter();
    const mock2 = createMockWriter();
    channelManager.subscribe("session-1", mock1.writer);
    channelManager.subscribe("session-2", mock2.writer);

    channelManager.broadcast("session-1", { type: "session_ended", data: {} });

    expect(mock1.messages).toHaveLength(1);
    expect(mock2.messages).toHaveLength(0);
  });

  it("reset clears all channels and closes writers", () => {
    const mock = createMockWriter();
    channelManager.subscribe("session-1", mock.writer);

    channelManager.reset();

    expect(channelManager.getListenerCount("session-1")).toBe(0);
    expect(mock.closed).toBe(true);
  });
});
