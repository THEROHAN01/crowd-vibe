"use client";
import Link from "next/link";
import Logo from "@/components/ui/logo";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const links = [{ to: "/dashboard", label: "Dashboard" }] as const;

	return (
		<div className="flex flex-row items-center justify-between border-border border-b px-4 py-3">
			<Link href="/">
				<Logo size="sm" />
			</Link>
			<nav className="flex gap-4">
				{links.map(({ to, label }) => (
					<Link
						key={to}
						href={to}
						className="font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
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
