"use client";

import { Button } from "@crowd-vibe/ui/components/button";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
			<h1 className="font-bold font-heading text-2xl">Something went wrong</h1>
			<p className="max-w-md text-center text-muted-foreground">
				An unexpected error occurred. Please try again.
			</p>
			<Button onClick={reset}>Try Again</Button>
		</div>
	);
}
