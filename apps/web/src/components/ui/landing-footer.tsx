"use client";
import { cn } from "@crowd-vibe/ui/lib/utils";
import { Github, Mail, Twitter } from "lucide-react";
import Link from "next/link";
import Logo from "@/components/ui/logo";

interface FooterLink {
	label: string;
	href: string;
}

interface SocialLink {
	icon: React.ReactNode;
	href: string;
	label: string;
}

interface LandingFooterProps {
	socialLinks?: SocialLink[];
	navLinks?: FooterLink[];
	className?: string;
}

export function LandingFooter({
	socialLinks = [
		{
			icon: <Twitter className="h-5 w-5" />,
			href: "https://twitter.com",
			label: "Twitter",
		},
		{
			icon: <Github className="h-5 w-5" />,
			href: "https://github.com",
			label: "GitHub",
		},
		{
			icon: <Mail className="h-5 w-5" />,
			href: "mailto:hello@crowdvibe.app",
			label: "Email",
		},
	],
	navLinks = [
		{ label: "How it works", href: "#how-it-works" },
		{ label: "Features", href: "#features" },
		{ label: "Sign in", href: "/login" },
		{ label: "Get started", href: "/login" },
	],
	className,
}: LandingFooterProps) {
	return (
		<section className={cn("relative w-full overflow-hidden", className)}>
			<footer className="relative border-border border-t bg-background">
				{/* Main content area */}
				<div className="relative mx-auto flex min-h-[32rem] max-w-5xl flex-col justify-between px-6 py-14 sm:min-h-[36rem] md:min-h-[40rem]">
					{/* Top: brand block */}
					<div className="flex flex-col items-center gap-6">
						<Logo size="lg" />

						<p className="max-w-sm text-center font-light text-muted-foreground text-sm leading-relaxed">
							Crowd-controlled music for venues. Let your guests vote on what
							plays next — no app required.
						</p>

						{/* Social links */}
						{socialLinks.length > 0 && (
							<div className="mt-1 flex gap-5">
								{socialLinks.map((link) => (
									<Link
										key={link.label}
										// biome-ignore lint/suspicious/noExplicitAny: external/dynamic href
										href={link.href as any}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={link.label}
										className="text-muted-foreground/50 transition-all duration-300 hover:scale-110 hover:text-primary"
									>
										{link.icon}
									</Link>
								))}
							</div>
						)}

						{/* Nav links */}
						{navLinks.length > 0 && (
							<nav
								aria-label="Footer navigation"
								className="mt-1 flex flex-wrap justify-center gap-6 text-muted-foreground/60 text-sm"
							>
								{navLinks.map((link) => (
									<Link
										key={link.label}
										// biome-ignore lint/suspicious/noExplicitAny: dynamic href
										href={link.href as any}
										className="font-medium transition-colors duration-200 hover:text-foreground"
									>
										{link.label}
									</Link>
								))}
							</nav>
						)}
					</div>

					{/* Bottom: copyright */}
					<div className="mt-16 flex flex-col items-center justify-between gap-2 md:mt-20 md:flex-row">
						<p className="text-center text-muted-foreground text-xs md:text-left">
							© {new Date().getFullYear()} CrowdVibe. All rights reserved.
						</p>
						<p className="text-center text-muted-foreground/50 text-xs md:text-right">
							Made with <span className="text-primary">♥</span> by Rohan
							Salunkhe
						</p>
					</div>
				</div>

				{/* Large ghost wordmark */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute bottom-36 left-1/2 -translate-x-1/2 select-none text-center font-extrabold leading-none tracking-tighter"
					style={{
						fontSize: "clamp(3.5rem, 13vw, 11rem)",
						maxWidth: "95vw",
						background:
							"linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 18%, transparent), transparent)",
						WebkitBackgroundClip: "text",
						WebkitTextFillColor: "transparent",
						backgroundClip: "text",
					}}
				>
					CROWDVIBE
				</div>
			</footer>
		</section>
	);
}
