import { auth } from "@crowd-vibe/auth";
import prisma from "@crowd-vibe/db";
import { env } from "@crowd-vibe/env/server";
import { channelManager } from "@crowd-vibe/api/sse/channel-manager";
import { verifySignedCookie } from "@crowd-vibe/api/lib/cookie";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Check session exists and is active
  const session = await prisma.venueSession.findUnique({
    where: { id: sessionId },
    select: { isActive: true, venueId: true, venue: { select: { ownerId: true } } },
  });

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }
  if (!session.isActive) {
    return new Response("Session ended", { status: 410 });
  }

  // Authenticate: guest cookie OR venue owner
  const guestCookie = req.cookies.get("cv_guest")?.value;
  const authSession = await auth.api.getSession({ headers: req.headers });

  let authorized = false;

  if (guestCookie) {
    const guestId = verifySignedCookie(guestCookie, env.BETTER_AUTH_SECRET);
    if (guestId) {
      const guest = await prisma.guestUser.findUnique({
        where: { id: guestId },
        select: { sessionId: true },
      });
      if (guest?.sessionId === sessionId) authorized = true;
    }
  }

  if (!authorized && authSession?.user) {
    if (session.venue.ownerId === authSession.user.id) authorized = true;
  }

  if (!authorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
