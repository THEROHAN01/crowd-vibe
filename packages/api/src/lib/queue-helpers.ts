import prisma from "@crowd-vibe/db";
import { channelManager } from "../sse/channel-manager";
import { getMusicProvider } from "../music/index";

/**
 * Marks the current playing song with the given status, picks the next
 * queued song by score, marks it as playing, and broadcasts the change.
 * Wrapped in a $transaction to prevent race conditions.
 *
 * Returns the next song and playerData, or null if the queue is empty.
 */
export async function advanceQueue(
  sessionId: string,
  musicProvider: string,
  markCurrentAs: "played" | "skipped" = "played"
) {
  const result = await prisma.$transaction(async (tx) => {
    // Mark current playing song
    await tx.song.updateMany({
      where: { sessionId, status: "playing" },
      data: { status: markCurrentAs, playedAt: new Date() },
    });

    // Pick next by score, tiebreak by addedAt
    const nextSong = await tx.song.findFirst({
      where: { sessionId, status: "queued" },
      orderBy: [{ score: "desc" }, { addedAt: "asc" }],
      include: { suggestedBy: { select: { displayName: true } } },
    });

    if (nextSong) {
      await tx.song.update({
        where: { id: nextSong.id },
        data: { status: "playing", playedAt: new Date() },
      });
    }

    return nextSong;
  });

  // Broadcast outside the transaction
  if (result) {
    const provider = getMusicProvider(musicProvider);
    const playerData = provider.getPlayerData(result.providerId);

    channelManager.broadcast(sessionId, {
      type: "now_playing",
      data: {
        song: {
          id: result.id,
          providerId: result.providerId,
          provider: result.provider,
          title: result.title,
          artist: result.artist,
          thumbnailUrl: result.thumbnailUrl,
          durationMs: result.durationMs,
          status: "playing",
          score: result.score,
          addedAt: result.addedAt.toISOString(),
          suggestedBy: result.suggestedBy,
        },
      },
    });

    return { song: result, playerData };
  }

  channelManager.broadcast(sessionId, {
    type: "now_playing",
    data: { song: null },
  });

  return { song: null, playerData: null };
}
