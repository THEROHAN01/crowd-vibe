import { auth } from "@crowd-vibe/auth";
import prisma from "@crowd-vibe/db";
import { env } from "@crowd-vibe/env/server";
import type { NextRequest } from "next/server";

import { verifySignedCookie } from "./lib/cookie";

export type Context =
	| { type: "owner"; user: { id: string; name: string; email: string } }
	| { type: "guest"; guestId: string; guestSessionId: string }
	| { type: "anonymous" };

export async function createContext(req: NextRequest): Promise<Context> {
	// Check guest cookie first (HMAC-signed) — most requests are from guests
	const rawCookie = req.cookies.get("cv_guest")?.value;
	if (rawCookie) {
		const guestId = verifySignedCookie(rawCookie, env.BETTER_AUTH_SECRET);
		if (guestId) {
			const guest = await prisma.guestUser.findUnique({
				where: { id: guestId },
				select: { sessionId: true },
			});
			if (guest) {
				return {
					type: "guest",
					guestId,
					guestSessionId: guest.sessionId,
				};
			}
		}
	}

	// Fall back to Better-Auth (venue owner)
	const authSession = await auth.api.getSession({
		headers: req.headers,
	});
	if (authSession?.user) {
		return {
			type: "owner",
			user: {
				id: authSession.user.id,
				name: authSession.user.name,
				email: authSession.user.email,
			},
		};
	}

	return { type: "anonymous" };
}
