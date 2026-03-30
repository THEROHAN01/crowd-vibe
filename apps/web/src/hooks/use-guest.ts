"use client";

import { useCallback, useState } from "react";

interface JoinResult {
	sessionId: string;
	venueName: string;
	displayName: string | null;
}

export function useGuest() {
	const [isJoining, setIsJoining] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const join = useCallback(
		async (
			joinCode: string,
			displayName?: string,
		): Promise<JoinResult | null> => {
			setIsJoining(true);
			setError(null);

			try {
				const FingerprintJS = (await import("@fingerprintjs/fingerprintjs"))
					.default;
				const fp = await FingerprintJS.load();
				const result = await fp.get();
				const fingerprint = result.visitorId;

				const res = await fetch("/api/guest/join", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ joinCode, fingerprint, displayName }),
					credentials: "include",
				});

				if (!res.ok) {
					const data = await res.json();
					setError(data.error || "Failed to join session");
					return null;
				}

				return await res.json();
			} catch (err) {
				setError("Failed to join session. Please try again.");
				return null;
			} finally {
				setIsJoining(false);
			}
		},
		[],
	);

	return { join, isJoining, error };
}
