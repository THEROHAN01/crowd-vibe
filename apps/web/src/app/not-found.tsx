import Link from "next/link";
import { Button } from "@crowd-vibe/ui/components/button";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
      <h1 className="font-heading font-bold text-4xl">404</h1>
      <p className="text-muted-foreground">This page doesn't exist.</p>
      <Link href="/">
        <Button variant="outline">Back to Home</Button>
      </Link>
    </div>
  );
}
