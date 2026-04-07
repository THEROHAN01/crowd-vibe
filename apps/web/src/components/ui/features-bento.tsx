"use client";
import { BarChart3, Globe, Smartphone, Zap } from "lucide-react";
import { cn } from "@crowd-vibe/ui/lib/utils";
import { useInView } from "@/hooks/use-in-view";

/* ─────────────────────────────────────────────────
   Decorations
───────────────────────────────────────────────── */

const BAR_HEIGHTS = [38, 62, 44, 80, 52, 96, 68, 56, 84, 72];

function BarChartDecor({ inView }: { inView: boolean }) {
	return (
		<div className="mt-auto flex h-20 items-end gap-1.5" aria-hidden="true">
			{BAR_HEIGHTS.map((h, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: stable decorative list
					key={i}
					className="flex-1 origin-bottom rounded-t-sm"
					style={{
						height: `${h}%`,
						background:
							"linear-gradient(to top, color-mix(in oklch, var(--primary) 25%, transparent), color-mix(in oklch, var(--primary) 70%, transparent))",
						transform: inView ? "scaleY(1)" : "scaleY(0)",
						transition: `transform 0.65s cubic-bezier(0.34,1.4,0.64,1) ${180 + i * 55}ms`,
					}}
				/>
			))}
		</div>
	);
}

const CHART_POINTS = "0,54 32,40 64,22 96,34 128,12 160,20 192,4";
const CHART_LEN = 280;

function LineChartDecor({ inView }: { inView: boolean }) {
	return (
		<div className="mt-auto" aria-hidden="true">
			{/* Up-trending stat */}
			<div className="mb-3 flex items-baseline gap-2">
				<span
					className="font-black font-heading text-3xl text-accent tabular-nums leading-none"
					style={{
						opacity: inView ? 1 : 0,
						transform: inView ? "translateY(0)" : "translateY(10px)",
						transition: "opacity 0.5s ease 800ms, transform 0.5s ease 800ms",
					}}
				>
					+89%
				</span>
				<span className="text-muted-foreground/60 text-xs">engagement</span>
			</div>

			{/* SVG line */}
			<svg
				viewBox="0 0 192 60"
				className="h-12 w-full overflow-visible"
				preserveAspectRatio="none"
			>
				{/* Gradient fill under line */}
				<defs>
					<linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="0%"
							stopColor="var(--color-accent)"
							stopOpacity="0.18"
						/>
						<stop
							offset="100%"
							stopColor="var(--color-accent)"
							stopOpacity="0"
						/>
					</linearGradient>
				</defs>
				<polygon
					points={`${CHART_POINTS} 192,60 0,60`}
					fill="url(#chartFill)"
					style={{
						opacity: inView ? 1 : 0,
						transition: "opacity 0.6s ease 400ms",
					}}
				/>
				<polyline
					points={CHART_POINTS}
					fill="none"
					stroke="var(--color-accent)"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					style={{
						strokeDasharray: CHART_LEN,
						strokeDashoffset: inView ? 0 : CHART_LEN,
						transition: `stroke-dashoffset 1.4s cubic-bezier(0.2,0,0,1) 300ms`,
					}}
				/>
				{/* End dot */}
				<circle
					cx="192"
					cy="4"
					r="3.5"
					fill="var(--color-accent)"
					style={{
						opacity: inView ? 1 : 0,
						transform: inView ? "scale(1)" : "scale(0)",
						transformOrigin: "192px 4px",
						transition: "opacity 0.3s ease 1.5s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1) 1.5s",
					}}
				/>
			</svg>
		</div>
	);
}

function PulseRingsDecor({ inView }: { inView: boolean }) {
	return (
		<div className="mt-auto flex justify-center pt-2 pb-1" aria-hidden="true">
			<div className="relative flex h-16 w-16 items-center justify-center">
				{[0, 1, 2].map((i) => (
					<span
						key={i}
						className={cn(
							"absolute rounded-full border border-accent/35",
							inView && "animate-ping-slow",
						)}
						style={{
							width: 28 + i * 18,
							height: 28 + i * 18,
							animationDelay: `${i * 650}ms`,
						}}
					/>
				))}
				<div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
					<Smartphone className="h-4.5 w-4.5 text-accent" />
				</div>
			</div>
		</div>
	);
}

const VENUE_TAGS = [
	"Bar",
	"Club",
	"Restaurant",
	"Festival",
	"Pop-up",
	"Hotel",
	"Arena",
	"Rooftop",
	"Cafe",
	"Event space",
];

function VenueTagsDecor() {
	const doubled = [...VENUE_TAGS, ...VENUE_TAGS];
	return (
		<div className="mt-auto overflow-hidden" aria-hidden="true">
			<div className="animate-marquee flex w-max gap-2 py-1">
				{doubled.map((tag, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: stable decorative duplicate
					<span
						key={i}
						className="shrink-0 rounded-full border border-border bg-muted px-3 py-1 font-medium text-muted-foreground/70 text-xs whitespace-nowrap"
					>
						{tag}
					</span>
				))}
			</div>
		</div>
	);
}

/* ─────────────────────────────────────────────────
   Card shell
───────────────────────────────────────────────── */

function BentoCard({
	children,
	className,
	glowColor,
	inView,
	delay,
	from,
}: {
	children: React.ReactNode;
	className?: string;
	glowColor: string;
	inView: boolean;
	delay: number;
	from: "left" | "right";
}) {
	return (
		<div
			className={cn(
				"group flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8",
				"transition-[border-color,box-shadow] duration-500",
				`hover:border-[${glowColor}]/25`,
				className,
			)}
			style={{
				opacity: inView ? 1 : 0,
				transform: inView
					? "translateX(0)"
					: `translateX(${from === "left" ? "-40px" : "40px"})`,
				transition: `opacity 0.7s cubic-bezier(0.2,0,0,1) ${delay}ms, transform 0.7s cubic-bezier(0.2,0,0,1) ${delay}ms`,
				// hover glow via CSS variable trick
			}}
		>
			{children}
		</div>
	);
}

/* ─────────────────────────────────────────────────
   Main export
───────────────────────────────────────────────── */

export function FeaturesBento() {
	const [ref, inView] = useInView({ threshold: 0.08 });

	return (
		<section
			id="features"
			ref={ref as React.RefObject<HTMLElement>}
			className="bg-card/30 px-6 py-20 md:py-32"
		>
			<div className="mx-auto max-w-5xl">
				{/* Header */}
				<div
					className="mb-12 text-center md:mb-16"
					style={{
						opacity: inView ? 1 : 0,
						transform: inView ? "translateY(0)" : "translateY(32px)",
						transition: "opacity 0.7s cubic-bezier(0.2,0,0,1), transform 0.7s cubic-bezier(0.2,0,0,1)",
					}}
				>
					<p className="mb-4 font-semibold text-muted-foreground/60 text-xs uppercase tracking-[0.2em]">
						Built for venues
					</p>
					<h2 className="font-black font-heading text-[clamp(2.2rem,5.5vw,4.5rem)] text-foreground leading-[0.9] tracking-tight">
						Everything you need
					</h2>
				</div>

				{/* Bento grid — 3 cols, Z-pattern */}
				<div className="grid auto-rows-auto gap-4 md:grid-cols-3">
					{/* ── Card 1: Real-time voting — col-span-2 (wide left, row 1) ── */}
					<BentoCard
						className="md:col-span-2 min-h-[280px]"
						glowColor="var(--color-primary)"
						inView={inView}
						delay={100}
						from="left"
					>
						<div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted transition-all duration-300 group-hover:border-primary/40 group-hover:bg-primary/10">
							<Zap className="h-5 w-5 text-primary" />
						</div>

						<div className="mb-1 flex items-center gap-2">
							<h3 className="font-bold font-heading text-foreground text-xl tracking-tight">
								Real-time voting
							</h3>
							<span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 font-semibold text-accent text-[10px] uppercase tracking-wider">
								<span className="h-1 w-1 rounded-full bg-accent motion-safe:animate-ping" />
								Live
							</span>
						</div>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Every vote updates the queue instantly. Watch songs climb the ranks
							as your crowd rallies — sub-second, no refresh.
						</p>

						<BarChartDecor inView={inView} />
					</BentoCard>

					{/* ── Card 2: No app — col-span-1 (narrow right, row 1) ── */}
					<BentoCard
						className="min-h-[280px]"
						glowColor="var(--color-accent)"
						inView={inView}
						delay={220}
						from="right"
					>
						<div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted transition-all duration-300 group-hover:border-accent/40 group-hover:bg-accent/10">
							<Smartphone className="h-5 w-5 text-accent" />
						</div>

						<h3 className="mb-1 font-bold font-heading text-foreground text-xl tracking-tight">
							No app required
						</h3>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Guests join by scanning a QR code. Nothing to install. Works on
							any smartphone.
						</p>

						<PulseRingsDecor inView={inView} />
					</BentoCard>

					{/* ── Card 3: Any venue — col-span-1 (narrow left, row 2) ── */}
					<BentoCard
						className="min-h-[240px]"
						glowColor="color-mix(in oklch, #38bdf8 80%, transparent)"
						inView={inView}
						delay={320}
						from="left"
					>
						<div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted transition-all duration-300 group-hover:border-sky-400/40 group-hover:bg-sky-400/10">
							<Globe className="h-5 w-5 text-sky-400" />
						</div>

						<h3 className="mb-1 font-bold font-heading text-foreground text-xl tracking-tight">
							Any venue
						</h3>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Bars, clubs, restaurants, festivals. If you play music, CrowdVibe
							amplifies it.
						</p>

						<VenueTagsDecor />
					</BentoCard>

					{/* ── Card 4: Session analytics — col-span-2 (wide right, row 2) ── */}
					<BentoCard
						className="md:col-span-2 min-h-[240px]"
						glowColor="color-mix(in oklch, #fbbf24 80%, transparent)"
						inView={inView}
						delay={200}
						from="right"
					>
						<div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted transition-all duration-300 group-hover:border-amber-400/40 group-hover:bg-amber-400/10">
							<BarChart3 className="h-5 w-5 text-amber-400" />
						</div>

						<h3 className="mb-1 font-bold font-heading text-foreground text-xl tracking-tight">
							Session analytics
						</h3>
						<p className="text-muted-foreground text-sm leading-relaxed">
							See what your crowd loves. Live song stats, peak engagement windows,
							and listener count — all in your dashboard.
						</p>

						<LineChartDecor inView={inView} />
					</BentoCard>
				</div>
			</div>
		</section>
	);
}
