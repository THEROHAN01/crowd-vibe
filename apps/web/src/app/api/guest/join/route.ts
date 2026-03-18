import { signCookie } from "@crowd-vibe/api/lib/cookie";
import { RateLimiter } from "@crowd-vibe/api/lib/rate-limiter";
import prisma from "@crowd-vibe/db";
import { env } from "@crowd-vibe/env/server";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const joinRateLimiter = new RateLimiter(3, 60_000); // 3 per minute per IP

const JoinSchema = z.object({
	joinCode: z.string().min(1),
	fingerprint: z.string().min(1),
	displayName: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
	// Rate limit by IP
	const ip =
		req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
	const { allowed } = joinRateLimiter.check(ip);
	if (!allowed) {
		return NextResponse.json(
			{ error: "Too many join attempts. Try again in a minute." },
			{ status: 429 },
		);
	}

	// Parse and validate body
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 },
		);
	}

	const parsed = JoinSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "joinCode and fingerprint are required" },
			{ status: 400 },
		);
	}

	const { joinCode, fingerprint, displayName } = parsed.data;

	// Find active session by join code
	const session = await prisma.venueSession.findUnique({
		where: { joinCode },
		select: {
			id: true,
			isActive: true,
			venue: { select: { name: true } },
			name: true,
		},
	});

	if (!session || !session.isActive) {
		return NextResponse.json(
			{ error: "No active session found for this code." },
			{ status: 404 },
		);
	}

	// Upsert guest user by session + fingerprint
	const guest = await prisma.guestUser.upsert({
		where: {
			sessionId_fingerprint: {
				sessionId: session.id,
				fingerprint,
			},
		},
		create: {
			sessionId: session.id,
			fingerprint,
			displayName: displayName || null,
		},
		update: {
			displayName: displayName || undefined,
		},
	});

	// Sign the cookie
	const signedCookie = signCookie(guest.id, env.BETTER_AUTH_SECRET);

	const response = NextResponse.json({
		sessionId: session.id,
		venueName: session.venue.name,
		displayName: guest.displayName,
	});

	response.cookies.set("cv_guest", signedCookie, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		maxAge: 86400, // 24 hours
		secure: env.NODE_ENV === "production",
	});

	return response;
}
