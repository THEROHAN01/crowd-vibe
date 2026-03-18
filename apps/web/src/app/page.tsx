"use client";

import { Button } from "@crowd-vibe/ui/components/button";
import Link from "next/link";
import Logo from "@/components/ui/logo";

export default function Home() {
	return (
		<div
			className="flex h-full flex-col items-center justify-center gap-8 px-4"
			style={{
				background:
					"radial-gradient(ellipse at center, color-mix(in oklch, var(--primary) 5%, transparent), transparent)",
			}}
		>
			<div className="text-center">
				<h1 className="mb-2 font-bold font-heading text-5xl">
					<span className="text-foreground">Crowd</span>
					<span className="text-primary">Vibe</span>
				</h1>
				<p className="max-w-md text-lg text-muted-foreground">
					Let the crowd control the vibe. Vote on songs in real-time at your
					favorite venues.
				</p>
			</div>
			<div className="flex gap-4">
				<Link href="/dashboard">
					<Button size="lg">Venue Dashboard</Button>
				</Link>
			</div>
		</div>
	);
}
