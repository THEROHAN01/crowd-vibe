import { Button } from "@crowd-vibe/ui/components/button";
import {
	ArrowRight,
	BarChart3,
	ChevronDown,
	Globe,
	Music2,
	QrCode,
	Sparkles,
	ThumbsUp,
	Users,
	Zap,
} from "lucide-react";
import Link from "next/link";
import Logo from "@/components/ui/logo";
import { ShaderAnimation } from "@/components/ui/shader-animation";

export default function Home() {
	return (
		<div
			className="dark overflow-x-hidden bg-background text-foreground"
			style={{ colorScheme: "dark" }}
		>
			{/* ══════════════════════════════════════════════
			    HERO — full-viewport shader canvas
			══════════════════════════════════════════════ */}
			<section className="relative h-screen min-h-[640px] overflow-hidden">
				{/* Shader fills the entire hero */}
				<ShaderAnimation className="absolute inset-0 h-full w-full" />

				{/* Gradient overlays — blend shader into design-system background */}
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/55 via-background/5 to-background/95" />
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" />

				{/* ── Floating nav ── */}
				<nav className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-6 py-5 md:px-10">
					<Logo size="default" />

					<div className="hidden items-center gap-8 font-medium text-sm md:flex">
						<a
							href="#how-it-works"
							className="text-foreground/50 transition-colors duration-200 hover:text-foreground"
						>
							How it works
						</a>
						<a
							href="#features"
							className="text-foreground/50 transition-colors duration-200 hover:text-foreground"
						>
							Features
						</a>
					</div>

					<div className="flex items-center gap-3">
						<Link href="/login" className="hidden sm:block">
							<Button
								variant="ghost"
								size="sm"
								className="text-foreground/70 hover:bg-foreground/8 hover:text-foreground"
							>
								Sign in
							</Button>
						</Link>
						<Link href="/login">
							<Button
								size="sm"
								className="px-5 font-semibold shadow-lg shadow-primary/20"
							>
								Get started
							</Button>
						</Link>
					</div>
				</nav>

				{/* ── Hero copy ── */}
				<div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
					{/* Live pill */}
					<div className="lp-fade-in mb-8" style={{ animationDelay: "250ms" }}>
						<div className="inline-flex items-center gap-2.5 rounded-full border border-primary/25 bg-primary/8 px-4 py-2 font-semibold text-primary text-xs uppercase tracking-widest backdrop-blur-sm">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 motion-safe:animate-ping" />
								<span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
							</span>
							Crowd-controlled music · Live now
						</div>
					</div>

					{/* Headline */}
					<h1 className="select-none font-black font-heading text-foreground leading-[0.88] tracking-tighter">
						<span
							className="lp-fade-up block text-[clamp(2.4rem,7vw,5rem)]"
							style={{ animationDelay: "450ms" }}
						>
							The Crowd
						</span>
						<span
							className="lp-fade-up block text-[clamp(2.4rem,7vw,5rem)]"
							style={{ animationDelay: "600ms" }}
						>
							Controls
						</span>
						<span
							className="lp-fade-up block text-[clamp(2.4rem,7vw,5rem)] text-primary"
							style={{ animationDelay: "750ms" }}
						>
							The Music
						</span>
					</h1>

					{/* Subtitle */}
					<p
						className="lp-fade-up mt-8 max-w-md font-light text-lg/relaxed text-muted-foreground"
						style={{ animationDelay: "950ms" }}
					>
						Real-time song voting for venues. Guests scan a QR code and vote on
						what plays next — no app required.
					</p>

					{/* CTA row */}
					<div
						className="lp-fade-up mt-10 flex flex-wrap items-center justify-center gap-4"
						style={{ animationDelay: "1100ms" }}
					>
						<Link href="/login">
							<Button
								size="lg"
								className="h-12 px-8 font-bold text-base shadow-[0_0_40px_color-mix(in_oklch,var(--primary)_30%,transparent)] transition-shadow duration-500 hover:shadow-[0_0_60px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
							>
								Start your venue
								<ArrowRight className="ml-2 h-4 w-4" />
							</Button>
						</Link>
						<a href="#how-it-works" className="cursor-pointer">
							<Button
								size="lg"
								variant="outline"
								className="h-12 border-foreground/15 px-8 font-medium text-base backdrop-blur-sm hover:bg-foreground/5"
							>
								See how it works
							</Button>
						</a>
					</div>

					{/* Mini trust strip */}
					<div
						className="lp-fade-up mt-14 hidden items-center gap-6 font-medium text-muted-foreground/70 text-xs uppercase tracking-widest sm:flex"
						style={{ animationDelay: "1300ms" }}
					>
						<span>50K+ Votes</span>
						<span className="h-3 w-px bg-foreground/15" />
						<span>200+ Venues</span>
						<span className="h-3 w-px bg-foreground/15" />
						<span>Sub-second updates</span>
					</div>
				</div>

				{/* Scroll caret */}
				<div
					className="lp-float lp-fade-in absolute bottom-8 left-1/2 -translate-x-1/2"
					style={{ animationDelay: "2s" }}
				>
					<ChevronDown className="h-5 w-5 text-foreground/25" />
				</div>
			</section>

			{/* ══════════════════════════════════════════════
			    HOW IT WORKS
			══════════════════════════════════════════════ */}
			<section id="how-it-works" className="bg-background px-6 py-20 md:py-32">
				<div className="mx-auto max-w-5xl">
					<div className="mb-12 text-center md:mb-20">
						<p className="mb-4 font-semibold text-muted-foreground/60 text-xs uppercase tracking-[0.2em]">
							Simple by design
						</p>
						<h2 className="font-black font-heading text-[clamp(2.2rem,5.5vw,4.5rem)] text-foreground leading-[0.9] tracking-tight">
							How it works
						</h2>
					</div>

					<div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
						{[
							{
								step: "01",
								icon: QrCode,
								title: "Owner starts a session",
								desc: "Create your venue, open a session, and post the QR code anywhere in your space.",
							},
							{
								step: "02",
								icon: ThumbsUp,
								title: "Crowd scans & votes",
								desc: "Guests scan to join instantly — no signup, no downloads. Vote up or down on the queue.",
							},
							{
								step: "03",
								icon: Music2,
								title: "Best song plays next",
								desc: "The algorithm surfaces what the crowd wants. Real-time. Democratic. Unstoppable.",
							},
						].map((item) => (
							<div
								key={item.step}
								className="group flex flex-col gap-6 bg-background p-6 transition-colors duration-500 hover:bg-card md:p-10"
							>
								<div className="flex items-start justify-between">
									<span className="select-none font-black font-heading text-7xl text-foreground/6 leading-none">
										{item.step}
									</span>
									<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted transition-all duration-300 group-hover:border-primary/30 group-hover:bg-primary/8">
										<item.icon className="h-5 w-5 text-muted-foreground transition-colors duration-300 group-hover:text-primary" />
									</div>
								</div>
								<div>
									<h3 className="mb-3 font-bold font-heading text-foreground text-xl tracking-tight">
										{item.title}
									</h3>
									<p className="text-muted-foreground text-sm leading-relaxed">
										{item.desc}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ══════════════════════════════════════════════
			    FEATURES
			══════════════════════════════════════════════ */}
			<section id="features" className="bg-card/50 px-6 py-20 md:py-32">
				<div className="mx-auto max-w-5xl">
					<div className="mb-12 text-center md:mb-20">
						<p className="mb-4 font-semibold text-muted-foreground/60 text-xs uppercase tracking-[0.2em]">
							Built for venues
						</p>
						<h2 className="font-black font-heading text-[clamp(2.2rem,5.5vw,4.5rem)] text-foreground leading-[0.9] tracking-tight">
							Everything you need
						</h2>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						{/* Hero feature card — double height on desktop */}
						<div className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-colors duration-500 hover:border-primary/25 md:row-span-2 md:p-10">
							<div>
								<div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted transition-all duration-300 group-hover:border-primary/30 group-hover:bg-primary/8">
									<Zap className="h-5 w-5 text-primary" />
								</div>
								<h3 className="mb-4 font-bold font-heading text-2xl text-foreground tracking-tight">
									Real-time voting
								</h3>
								<p className="text-muted-foreground leading-relaxed">
									Every vote updates the queue instantly. No refresh needed.
									Watch your song climb the ranks as the crowd rallies behind
									it.
								</p>
							</div>
							{/* Mini bar chart decoration */}
							<div
								className="mt-10 flex h-16 items-end gap-1.5"
								aria-hidden="true"
							>
								{[40, 65, 45, 82, 55, 94, 70, 58, 88, 72].map((h) => (
									<div
										key={h}
										className="flex-1 rounded-sm bg-gradient-to-t from-primary/25 to-primary/60 transition-all duration-700"
										style={{ height: `${h}%` }}
									/>
								))}
							</div>
						</div>

						{[
							{
								icon: Users,
								iconClass: "text-accent",
								hoverBorder: "hover:border-accent/25",
								hoverBg: "group-hover:bg-accent/8 group-hover:border-accent/30",
								title: "No app required",
								desc: "Guests join by scanning a QR code. Nothing to install. Works on any smartphone.",
							},
							{
								icon: Globe,
								iconClass: "text-sky-400",
								hoverBorder: "hover:border-sky-400/25",
								hoverBg:
									"group-hover:bg-sky-400/8 group-hover:border-sky-400/30",
								title: "Any venue, anywhere",
								desc: "Bars, restaurants, clubs, events. If you play music, CrowdVibe amplifies it.",
							},
							{
								icon: BarChart3,
								iconClass: "text-amber-400",
								hoverBorder: "hover:border-amber-400/25",
								hoverBg:
									"group-hover:bg-amber-400/8 group-hover:border-amber-400/30",
								title: "Session analytics",
								desc: "See what your crowd loves. Song stats, peak engagement, and live listener counts.",
							},
						].map((item) => (
							<div
								key={item.title}
								className={`group rounded-2xl border border-border bg-card p-8 ${item.hoverBorder} transition-all duration-500 hover:bg-card/80`}
							>
								<div
									className={`mb-6 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted ${item.hoverBg} transition-all duration-300`}
								>
									<item.icon className={`h-4 w-4 ${item.iconClass}`} />
								</div>
								<h3 className="mb-2 font-bold font-heading text-foreground text-lg tracking-tight">
									{item.title}
								</h3>
								<p className="text-muted-foreground text-sm leading-relaxed">
									{item.desc}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ══════════════════════════════════════════════
			    STATS
			══════════════════════════════════════════════ */}
			<section className="border-border border-y bg-background px-6 py-16 md:py-24">
				<div className="mx-auto grid max-w-5xl grid-cols-1 sm:grid-cols-3">
					{[
						{ value: "50K+", label: "Votes cast" },
						{ value: "200+", label: "Active venues" },
						{ value: "<1s", label: "Update latency" },
					].map((stat, idx) => (
						<div
							key={stat.value}
							className={`py-8 text-center ${idx < 2 ? "border-border border-b sm:border-r sm:border-b-0" : ""}`}
						>
							<div className="font-black font-heading text-[clamp(2rem,5.5vw,4.5rem)] text-primary leading-none tracking-tight">
								{stat.value}
							</div>
							<div className="mt-2 font-medium text-muted-foreground text-xs uppercase tracking-widest">
								{stat.label}
							</div>
						</div>
					))}
				</div>
			</section>

			{/* ══════════════════════════════════════════════
			    FINAL CTA
			══════════════════════════════════════════════ */}
			<section className="relative overflow-hidden bg-background px-6 py-24 md:py-40">
				{/* Ambient glow from design system primary */}
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background:
							"radial-gradient(ellipse 80% 60% at 50% 100%, color-mix(in oklch, var(--primary) 12%, transparent), transparent)",
					}}
				/>

				<div className="relative mx-auto max-w-3xl text-center">
					<div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-2 font-semibold text-primary text-xs uppercase tracking-widest">
						<Sparkles className="h-3 w-3" />
						Free to start
					</div>

					<h2 className="mb-8 font-black font-heading text-[clamp(2.5rem,8vw,7rem)] text-foreground leading-[0.88] tracking-tighter">
						Give your <span className="text-primary">crowd</span>
						<br />a voice
					</h2>

					<p className="mx-auto mb-12 max-w-md text-lg text-muted-foreground leading-relaxed">
						Transform any venue into an interactive music experience. Your crowd
						is ready to vote.
					</p>

					<Link href="/login">
						<Button
							size="lg"
							className="h-14 px-10 font-bold text-base shadow-[0_0_60px_color-mix(in_oklch,var(--primary)_35%,transparent)] transition-shadow duration-500 hover:shadow-[0_0_80px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
						>
							Start free — no credit card
							<ArrowRight className="ml-2 h-4 w-4" />
						</Button>
					</Link>
				</div>
			</section>

			{/* ══════════════════════════════════════════════
			    FOOTER
			══════════════════════════════════════════════ */}
			<footer className="border-border border-t bg-background px-6 py-8">
				<div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 md:flex-row">
					<Logo size="sm" />
					<p className="text-muted-foreground text-xs">
						© 2025 CrowdVibe. Made with <span className="text-primary">♥</span>{" "}
						by Rohan Salunkhe
					</p>
					<div className="flex gap-6 text-muted-foreground/60 text-xs">
						<Link
							href="/login"
							className="transition-colors hover:text-foreground"
						>
							Sign in
						</Link>
						<Link
							href="/login"
							className="transition-colors hover:text-foreground"
						>
							Get started
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}
