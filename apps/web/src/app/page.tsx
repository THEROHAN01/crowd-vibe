"use client";

import Link from "next/link";
import { Button } from "@crowd-vibe/ui/components/button";
import Logo from "@/components/ui/logo";

export default function Home() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full px-4 gap-8"
      style={{ background: "radial-gradient(ellipse at center, color-mix(in oklch, var(--primary) 5%, transparent), transparent)" }}
    >
      <div className="text-center">
        <h1 className="font-heading text-5xl font-bold mb-2">
          <span className="text-foreground">Crowd</span>
          <span className="text-primary">Vibe</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
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
