"use client";
import type React from "react";
import {
	Headphones,
	Mic2,
	Music,
	Music2,
	QrCode,
	Radio,
	ThumbsUp,
} from "lucide-react";
import { cn } from "@crowd-vibe/ui/lib/utils";
import { useInView } from "@/hooks/use-in-view";

const STEPS = [
	{
		step: "01",
		Icon: QrCode,
		title: "Owner starts a session",
		desc: "Create your venue, open a session, and post the QR code anywhere in your space.",
	},
	{
		step: "02",
		Icon: ThumbsUp,
		title: "Crowd scans & votes",
		desc: "Guests scan to join instantly — no signup, no downloads. Vote up or down on the queue.",
	},
	{
		step: "03",
		Icon: Music2,
		title: "Best song plays next",
		desc: "The algorithm surfaces what the crowd wants. Real-time. Democratic. Unstoppable.",
	},
] as const;

interface Floater {
	Icon: React.ElementType;
	className: string;
	style?: React.CSSProperties;
}

const FLOATERS: Floater[] = [
	{ Icon: Music, className: "absolute top-10 left-[7%] h-9 w-9 text-white/[0.08] animate-float-a" },
	{ Icon: Music2, className: "absolute top-20 right-[9%] h-7 w-7 text-white/[0.10] animate-float-b" },
	{ Icon: Radio, className: "absolute bottom-[38%] left-[3%] h-11 w-11 text-white/[0.07] animate-float-c" },
	{ Icon: Headphones, className: "absolute top-[42%] right-[4%] h-14 w-14 text-white/[0.06] animate-float-a", style: { animationDelay: "800ms" } },
	{ Icon: Mic2, className: "absolute bottom-[22%] right-[11%] h-8 w-8 text-white/[0.09] animate-float-b", style: { animationDelay: "300ms" } },
	{ Icon: Music, className: "absolute bottom-[14%] left-[16%] h-5 w-5 text-white/[0.07] animate-float-c", style: { animationDelay: "1100ms" } },
	{ Icon: Radio, className: "absolute top-[28%] left-[12%] h-6 w-6 text-white/[0.06] animate-float-b", style: { animationDelay: "600ms" } },
];

function WavyUnderline({ inView }: { inView: boolean }) {
	return (
		<svg
			viewBox="0 0 400 18"
			preserveAspectRatio="none"
			className="absolute -bottom-2 left-0 w-full overflow-visible"
			aria-hidden="true"
			style={{ height: 18 }}
		>
			<path
				d="M0 9 C66 1, 133 17, 200 9 C266 1, 333 17, 400 9"
				fill="none"
				stroke="white"
				strokeWidth="4"
				strokeLinecap="round"
				style={{
					strokeDasharray: 520,
					strokeDashoffset: inView ? 0 : 520,
					opacity: inView ? 0.65 : 0,
					transition:
						"stroke-dashoffset 1.3s cubic-bezier(0.2,0,0,1) 580ms, opacity 0.5s ease 580ms",
				}}
			/>
		</svg>
	);
}

export function HowItWorks() {
	const [sectionRef, inView] = useInView({ threshold: 0.12 });

	const animate = (delay: number) =>
		({
			transition: `opacity 0.75s cubic-bezier(0.2,0,0,1) ${delay}ms, transform 0.75s cubic-bezier(0.2,0,0,1) ${delay}ms`,
		}) as React.CSSProperties;

	return (
		<section
			id="how-it-works"
			ref={sectionRef as React.RefObject<HTMLElement>}
			className="relative overflow-hidden px-6 py-24 md:py-36"
			style={{ background: "oklch(0.20 0.14 280)" }}
		>
			{/* Depth gradient — lighter glow at top */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						"radial-gradient(ellipse 80% 45% at 50% -5%, oklch(0.35 0.18 280 / 0.55), transparent)",
				}}
			/>

			{/* Bottom fade into next section */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
				style={{
					background:
						"linear-gradient(to bottom, transparent, oklch(0.20 0.14 280))",
				}}
			/>

			{/* Floating music icons */}
			{FLOATERS.map(({ Icon, className, style }, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: stable decorative list
				<Icon key={i} className={cn("pointer-events-none select-none", className)} aria-hidden="true" style={style} />
			))}

			<div className="relative mx-auto max-w-5xl">
				{/* ── Title block ── */}
				<div className="mb-20 text-center">
					<p
						className={cn(
							"mb-6 font-semibold text-white/45 text-xs uppercase tracking-[0.22em]",
							inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
						)}
						style={animate(0)}
					>
						Simple by design
					</p>

					<h2
						className="font-black font-heading leading-[0.88] tracking-tighter text-white"
						style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)" }}
					>
						{/* Line 1 */}
						<span
							className={cn(
								"block",
								inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
							)}
							style={animate(120)}
						>
							The Crowd Controls
						</span>

						{/* Line 2 — "the Music" with wavy underline on "Music" */}
						<span
							className={cn(
								"block",
								inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
							)}
							style={animate(260)}
						>
							the{" "}
							<span className="relative inline-block">
								Music
								<WavyUnderline inView={inView} />
							</span>
						</span>
					</h2>

					<p
						className={cn(
							"mx-auto mt-8 max-w-sm text-white/55 text-lg leading-relaxed",
							inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
						)}
						style={animate(420)}
					>
						Three steps. Zero friction. Infinite vibes.
					</p>
				</div>

				{/* ── Step cards ── */}
				<div className="grid gap-4 md:grid-cols-3">
					{STEPS.map(({ step, Icon, title, desc }, i) => (
						<div
							key={step}
							className={cn(
								"group rounded-2xl bg-white p-8 shadow-[0_4px_40px_rgba(0,0,0,0.25)] transition-shadow duration-500 hover:shadow-[0_8px_60px_rgba(0,0,0,0.35)]",
								inView
									? "opacity-100 translate-y-0"
									: "opacity-0 translate-y-12",
							)}
							style={animate(600 + i * 110)}
						>
							{/* Step number + icon */}
							<div className="mb-6 flex items-center justify-between">
								<span
									className="select-none font-black font-heading text-6xl leading-none"
									style={{ color: "oklch(0.55 0.2 280 / 0.15)" }}
								>
									{step}
								</span>
								<div
									className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
									style={{ background: "oklch(0.20 0.14 280)" }}
								>
									<Icon className="h-5 w-5 text-white" aria-hidden="true" />
								</div>
							</div>

							{/* Text */}
							<h3 className="mb-3 font-bold font-heading text-gray-900 text-xl tracking-tight">
								{title}
							</h3>
							<p className="text-gray-500 text-sm leading-relaxed">{desc}</p>

							{/* Bottom accent line on hover */}
							<div
								className="mt-6 h-0.5 w-0 rounded-full transition-all duration-500 group-hover:w-full"
								style={{ background: "oklch(0.55 0.2 280)" }}
								aria-hidden="true"
							/>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
