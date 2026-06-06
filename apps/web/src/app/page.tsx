import { Button } from "@crowd-vibe/ui/components/button";
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { ActivityTicker } from "@/components/ui/activity-ticker";
import { FeaturesBento } from "@/components/ui/features-bento";
import { InteractiveDemo } from "@/components/ui/interactive-demo";
import { LandingFooter } from "@/components/ui/landing-footer";
import Logo from "@/components/ui/logo";
import { PhoneMockupSection } from "@/components/ui/phone-mockup-section";
import { Reveal } from "@/components/ui/reveal";
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
							href="#features"
							className="text-foreground/50 transition-colors duration-200 hover:text-foreground"
						>
							Features
						</a>
						<a
							href="#demo"
							className="text-foreground/50 transition-colors duration-200 hover:text-foreground"
						>
							Try demo
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
							className="lp-fade-up block text-[clamp(2.8rem,8.5vw,7rem)]"
							style={{ animationDelay: "450ms" }}
						>
							The Crowd Controls
						</span>
						<span
							className="lp-fade-up relative block text-[clamp(2.8rem,8.5vw,7rem)]"
							style={{ animationDelay: "620ms" }}
						>
							the{" "}
							<span className="relative inline-block text-primary">
								Music
								<svg
									viewBox="0 0 400 18"
									preserveAspectRatio="none"
									className="absolute -bottom-2 left-0 w-full overflow-visible"
									aria-hidden="true"
									style={{ height: 16 }}
								>
									<path
										d="M0 9 C66 1, 133 17, 200 9 C266 1, 333 17, 400 9"
										fill="none"
										stroke="currentColor"
										strokeWidth="4"
										strokeLinecap="round"
										className="animate-wave-draw"
										style={{ animationDelay: "1100ms" }}
									/>
								</svg>
							</span>
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
						<a href="#demo" className="cursor-pointer">
							<Button
								size="lg"
								variant="outline"
								className="h-12 border-foreground/15 px-8 font-medium text-base backdrop-blur-sm hover:bg-foreground/5"
							>
								Try the demo
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
			    LIVE ACTIVITY TICKER
			══════════════════════════════════════════════ */}
			<ActivityTicker />

			{/* ══════════════════════════════════════════════
			    INTERACTIVE DEMO
			══════════════════════════════════════════════ */}
			<InteractiveDemo />

			{/* ══════════════════════════════════════════════
			    FEATURES BENTO
			══════════════════════════════════════════════ */}
			<FeaturesBento />

			{/* ══════════════════════════════════════════════
			    PHONE MOCKUP
			══════════════════════════════════════════════ */}
			<PhoneMockupSection />

			{/* ══════════════════════════════════════════════
			    STATS
			══════════════════════════════════════════════ */}
			<section className="border-border border-y bg-background px-6 py-16 md:py-24">
				<div className="mx-auto grid max-w-5xl grid-cols-1 sm:grid-cols-3">
					{[
						{ value: "50K+", label: "Votes cast", delay: 0 },
						{ value: "200+", label: "Active venues", delay: 120 },
						{ value: "<1s", label: "Update latency", delay: 240 },
					].map((stat, idx) => (
						<Reveal key={stat.value} direction="scale" delay={stat.delay}>
							<div
								className={`py-8 text-center ${idx < 2 ? "border-border border-b sm:border-r sm:border-b-0" : ""}`}
							>
								<div className="font-black font-heading text-[clamp(2rem,5.5vw,4.5rem)] text-primary leading-none tracking-tight">
									{stat.value}
								</div>
								<div className="mt-2 font-medium text-muted-foreground text-xs uppercase tracking-widest">
									{stat.label}
								</div>
							</div>
						</Reveal>
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

				<Reveal className="relative mx-auto max-w-3xl text-center">
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
				</Reveal>
			</section>

			{/* ══════════════════════════════════════════════
			    FOOTER
			══════════════════════════════════════════════ */}
			<LandingFooter />
		</div>
	);
}
