"use client";
import Link from "next/link";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import Logo from "@/components/ui/logo";

export default function Header() {
  const links = [
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <div className="flex flex-row items-center justify-between px-4 py-3 border-b border-border">
      <Link href="/">
        <Logo size="sm" />
      </Link>
      <nav className="flex gap-4">
        {links.map(({ to, label }) => (
          <Link
            key={to}
            href={to}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <UserMenu />
      </div>
    </div>
  );
}
