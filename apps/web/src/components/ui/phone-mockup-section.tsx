import {
	ChevronUp,
	ChevronDown,
	QrCode,
	Zap,
	Smartphone,
	Wifi,
} from "lucide-react";
import { cn } from "@crowd-vibe/ui/lib/utils";
import { Reveal } from "@/components/ui/reveal";

const QUEUE_SONGS = [
	{
		id: 1,
		title: "Blinding Lights",
		artist: "The Weeknd",
		score: 12,
		from: "from-violet-500",
		to: "to-purple-700",
		nextUp: true,
	},
	{
		id: 2,
		title: "Bohemian Rhapsody",
		artist: "Queen",
		score: 7,
		from: "from-rose-500",
		to: "to-pink-700",
		nextUp: false,
	},
	{
		id: 3,
		title: "Bad Guy",
		artist: "Billie Eilish",
		score: 3,
		from: "from-emerald-500",
		to: "to-teal-700",
		nextUp: false,
	},
];

const FEATURES = [
	{
		icon: QrCode,
		label: "Scan to join",
		desc: "Opens directly in the browser. No app download, ever.",
	},
	{
		icon: Zap,
		label: "Sub-second updates",
		desc: "Every vote reflects across all devices instantly via SSE.",
	},
	{
		icon: Smartphone,
		label: "Any smartphone",
		desc: "iOS, Android, anything with a camera. It just works.",
	},
];

function StaticPhone() {
	return (
		<div className="relative mx-auto w-[280px]">
			{/* Multi-layer glow */}
			<div
				aria-hidden="true"
				className="animate-phone-glow pointer-events-none absolute -inset-8 rounded-[4rem]"
				style={{
					background:
						"radial-gradient(ellipse at 40% 55%, color-mix(in oklch, var(--primary) 22%, transparent) 0%, transparent 65%)",
				}}
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute -bottom-4 -right-4 h-48 w-48 rounded-full opacity-15"
				style={{
					background:
						"radial-gradient(circle, color-mix(in oklch, var(--accent) 70%, transparent), transparent)",
					filter: "blur(28px)",
				}}
			/>

			{/* Outer frame */}
			<div className="relative overflow-hidden rounded-[2.8rem] border border-white/[0.08] bg-[oklch(0.08_0.025_280)] shadow-[0_56px_112px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.07)]">
				{/* Top highlight line */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
				/>

				{/* Decorative side buttons */}
				<div
					aria-hidden="true"
					className="absolute top-24 -right-[3px] h-16 w-[3px] rounded-r-full bg-white/[0.08]"
				/>
				<div
					aria-hidden="true"
					className="absolute top-20 -left-[3px] h-10 w-[3px] rounded-l-full bg-white/[0.08]"
				/>
				<div
					aria-hidden="true"
					className="absolute top-34 -left-[3px] h-10 w-[3px] rounded-l-full bg-white/[0.08]"
				/>

				{/* Status bar */}
				<div className="flex items-center justify-between px-6 pt-4 pb-1">
					<span className="font-bold text-foreground/80 text-xs tabular-nums">
						9:41
					</span>
					<div className="flex items-center gap-1.5" aria-hidden="true">
						<Wifi className="h-2.5 w-2.5 text-foreground/55" />
						<div className="flex items-end gap-[2px]">
							{[3, 5, 7, 9].map((h) => (
								<div
									key={h}
									className="w-[2.5px] rounded-sm bg-foreground/55"
									style={{ height: h }}
								/>
							))}
						</div>
					</div>
				</div>

				{/* Content */}
				<div className="px-4 pb-3">
					{/* Session header */}
					<div className="mb-3 text-center">
						<p className="font-bold font-heading text-foreground text-sm tracking-tight">
							The Rusty Anchor
						</p>
						<p className="text-muted-foreground/45 text-[10px]">
							47 guests · voting now
						</p>
					</div>

					{/* Now playing */}
					<div className="mb-3 overflow-hidden rounded-2xl border border-accent/25 bg-accent/[0.08] px-3 py-2.5">
						<div className="mb-1.5 flex items-center gap-1.5">
							<span className="relative flex h-1.5 w-1.5 shrink-0">
								<span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
								<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
							</span>
							<span className="font-semibold text-accent text-[9px] uppercase tracking-widest">
								Now playing
							</span>
						</div>
						<div className="flex items-center gap-2.5">
							<div
								className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow"
								aria-hidden="true"
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate font-semibold text-foreground text-xs leading-tight">
									Shape of You
								</p>
								<p className="truncate text-muted-foreground/55 text-[10px]">
									Ed Sheeran
								</p>
							</div>
						</div>
						<div className="mt-2.5 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
							<div className="h-full w-[62%] rounded-full bg-accent/65" />
						</div>
					</div>

					{/* Queue label */}
					<div className="mb-2 flex items-center justify-between">
						<span className="font-semibold text-muted-foreground/45 text-[9px] uppercase tracking-widest">
							Queue
						</span>
						<span className="text-muted-foreground/30 text-[9px]">
							{QUEUE_SONGS.length} songs
						</span>
					</div>

					{/* Songs */}
					<div className="flex flex-col gap-1.5">
						{QUEUE_SONGS.map((song) => (
							<div
								key={song.id}
								className={cn(
									"flex items-center gap-2.5 rounded-2xl border px-3 py-2.5",
									song.nextUp
										? "border-accent/25 bg-accent/[0.07]"
										: "border-white/[0.05] bg-white/[0.03]",
								)}
							>
								<div
									className={cn(
										"h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br shadow",
										song.from,
										song.to,
									)}
									aria-hidden="true"
								/>
								<div className="min-w-0 flex-1">
									<p className="truncate font-semibold text-foreground/90 text-[11px] leading-tight">
										{song.title}
									</p>
									<p className="truncate text-muted-foreground/45 text-[9px]">
										{song.artist}
									</p>
								</div>
								<span
									className={cn(
										"w-7 text-center font-black tabular-nums text-[11px]",
										song.score > 0
											? "text-accent"
											: "text-muted-foreground/35",
									)}
								>
									+{song.score}
								</span>
								<div
									className="flex shrink-0 flex-col gap-[3px]"
									aria-hidden="true"
								>
									<div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/12 text-accent">
										<ChevronUp className="h-3 w-3" />
									</div>
									<div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-muted-foreground/35">
										<ChevronDown className="h-3 w-3" />
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Home indicator */}
				<div className="flex justify-center pb-3 pt-2">
					<div className="h-1 w-24 rounded-full bg-white/15" />
				</div>
			</div>
		</div>
	);
}

export function PhoneMockupSection() {
	return (
		<section className="relative overflow-hidden bg-background px-6 py-20 md:py-32">
			{/* Subtle blob top-right */}
			<div
				aria-hidden="true"
				className="animate-blob-a pointer-events-none absolute top-0 right-0 h-[400px] w-[400px] rounded-full opacity-[0.05]"
				style={{
					background:
						"radial-gradient(circle, color-mix(in oklch, var(--primary) 90%, transparent), transparent)",
					filter: "blur(80px)",
				}}
			/>

			<div className="relative mx-auto max-w-5xl">
				<div className="grid items-center gap-16 md:grid-cols-2 md:gap-10">
					{/* Left: copy */}
					<div>
						<Reveal>
							<p className="mb-4 font-semibold text-muted-foreground/60 text-xs uppercase tracking-[0.2em]">
								Guest experience
							</p>
						</Reveal>
						<Reveal delay={80}>
							<h2 className="mb-6 font-black font-heading text-[clamp(2rem,5vw,3.8rem)] text-foreground leading-[0.9] tracking-tight">
								What your{" "}
								<span className="text-primary">guests</span> see
							</h2>
						</Reveal>
						<Reveal delay={160}>
							<p className="mb-10 max-w-sm text-muted-foreground leading-relaxed">
								The moment they scan your QR code, they're in. No account, no
								download — just the queue and a vote that matters.
							</p>
						</Reveal>

						<ul className="flex flex-col gap-6">
							{FEATURES.map((f, i) => (
								<Reveal key={f.label} delay={240 + i * 80}>
									<li className="flex items-start gap-4">
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted transition-all duration-300 hover:border-primary/30 hover:bg-primary/8">
											<f.icon
												className="h-4 w-4 text-primary"
												aria-hidden="true"
											/>
										</div>
										<div>
											<p className="mb-0.5 font-semibold text-foreground text-sm">
												{f.label}
											</p>
											<p className="text-muted-foreground text-sm leading-relaxed">
												{f.desc}
											</p>
										</div>
									</li>
								</Reveal>
							))}
						</ul>
					</div>

					{/* Right: phone */}
					<Reveal direction="right" delay={100}>
						<div className="flex justify-center md:justify-end">
							<StaticPhone />
						</div>
					</Reveal>
				</div>
			</div>
		</section>
	);
}
