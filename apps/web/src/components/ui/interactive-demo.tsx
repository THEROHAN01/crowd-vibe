"use client";
import { useState, useCallback } from "react";
import { ChevronUp, ChevronDown, Wifi, Users } from "lucide-react";
import { cn } from "@crowd-vibe/ui/lib/utils";
import { Reveal } from "@/components/ui/reveal";

type Vote = "up" | "down" | null;

interface Song {
	id: number;
	title: string;
	artist: string;
	duration: string;
	from: string;
	to: string;
	score: number;
	userVote: Vote;
}

const INITIAL_SONGS: Song[] = [
	{
		id: 1,
		title: "Blinding Lights",
		artist: "The Weeknd",
		duration: "3:22",
		from: "from-violet-500",
		to: "to-purple-700",
		score: 5,
		userVote: null,
	},
	{
		id: 2,
		title: "Bohemian Rhapsody",
		artist: "Queen",
		duration: "5:55",
		from: "from-rose-500",
		to: "to-pink-700",
		score: 3,
		userVote: null,
	},
	{
		id: 3,
		title: "Bad Guy",
		artist: "Billie Eilish",
		duration: "3:14",
		from: "from-emerald-500",
		to: "to-teal-700",
		score: 1,
		userVote: null,
	},
];

const NOW_PLAYING = {
	title: "Shape of You",
	artist: "Ed Sheeran",
	from: "from-amber-500",
	to: "to-orange-600",
	progress: 62,
};

/* ─── Equalizer bars (animated) ─── */
function EqBars() {
	return (
		<div className="flex items-end gap-[2px]" aria-hidden="true">
			{[
				{ h: "h-2", delay: "0ms" },
				{ h: "h-3.5", delay: "160ms" },
				{ h: "h-2.5", delay: "80ms" },
				{ h: "h-4", delay: "240ms" },
			].map(({ h, delay }, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: stable decorative list
					key={i}
					className={cn(
						"w-[3px] rounded-full bg-accent animate-equalize",
						h,
					)}
					style={{ animationDelay: delay }}
				/>
			))}
		</div>
	);
}

/* ─── Song row ─── */
function SongCard({
	song,
	rank,
	onVote,
}: {
	song: Song;
	rank: number;
	onVote: (id: number, type: "up" | "down") => void;
}) {
	const isTop = rank === 0;
	const scoreColor =
		song.score > 0
			? "text-accent"
			: song.score < 0
				? "text-destructive"
				: "text-muted-foreground/30";

	return (
		<div
			className={cn(
				"group relative flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-300",
				isTop
					? "border-accent/30 bg-accent/[0.07] shadow-[0_0_20px_color-mix(in_oklch,var(--accent)_8%,transparent)]"
					: "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.06]",
			)}
		>
			{/* Rank badge */}
			<span
				className={cn(
					"absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black",
					isTop
						? "bg-accent text-accent-foreground shadow-[0_0_10px_color-mix(in_oklch,var(--accent)_60%,transparent)]"
						: "bg-white/10 text-muted-foreground/60",
				)}
				aria-hidden="true"
			>
				{rank + 1}
			</span>

			{/* Thumbnail */}
			<div
				className={cn(
					"h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br shadow-lg",
					song.from,
					song.to,
				)}
				aria-hidden="true"
			/>

			{/* Track info */}
			<div className="min-w-0 flex-1">
				<p
					className={cn(
						"truncate font-semibold text-sm leading-tight",
						isTop ? "text-foreground" : "text-foreground/80",
					)}
				>
					{song.title}
				</p>
				<p className="truncate text-muted-foreground/50 text-xs">
					{song.artist} · {song.duration}
				</p>
			</div>

			{/* Score */}
			<span
				className={cn(
					"w-9 text-center font-black tabular-nums text-lg leading-none transition-all duration-200",
					scoreColor,
				)}
			>
				{song.score > 0 ? `+${song.score}` : song.score}
			</span>

			{/* Vote buttons */}
			<div className="flex shrink-0 flex-col gap-1">
				<button
					type="button"
					onClick={() => onVote(song.id, "up")}
					aria-label={`Upvote ${song.title}`}
					className={cn(
						"flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 active:scale-[0.88]",
						song.userVote === "up"
							? "bg-accent text-accent-foreground shadow-[0_0_14px_color-mix(in_oklch,var(--accent)_55%,transparent)]"
							: "bg-white/[0.06] text-muted-foreground/40 hover:bg-accent/15 hover:text-accent hover:shadow-[0_0_10px_color-mix(in_oklch,var(--accent)_25%,transparent)]",
					)}
				>
					<ChevronUp className="h-4 w-4" />
				</button>
				<button
					type="button"
					onClick={() => onVote(song.id, "down")}
					aria-label={`Downvote ${song.title}`}
					className={cn(
						"flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 active:scale-[0.88]",
						song.userVote === "down"
							? "bg-destructive text-destructive-foreground shadow-[0_0_14px_color-mix(in_oklch,var(--destructive)_55%,transparent)]"
							: "bg-white/[0.06] text-muted-foreground/40 hover:bg-destructive/15 hover:text-destructive hover:shadow-[0_0_10px_color-mix(in_oklch,var(--destructive)_25%,transparent)]",
					)}
				>
					<ChevronDown className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}

/* ─── Phone shell ─── */
function PhoneShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative mx-auto w-[272px]">
			{/* Pulsing ambient glow */}
			<div
				aria-hidden="true"
				className="animate-phone-glow pointer-events-none absolute -inset-6 rounded-[4rem]"
				style={{
					background:
						"radial-gradient(ellipse at 50% 60%, color-mix(in oklch, var(--primary) 28%, transparent) 0%, transparent 70%)",
				}}
			/>

			{/* Secondary emerald glow */}
			<div
				aria-hidden="true"
				className="animate-blob-b pointer-events-none absolute -bottom-4 -right-4 h-40 w-40 rounded-full opacity-20"
				style={{
					background:
						"radial-gradient(circle, color-mix(in oklch, var(--accent) 60%, transparent), transparent)",
					filter: "blur(24px)",
				}}
			/>

			{/* Frame */}
			<div className="relative overflow-hidden rounded-[2.6rem] border border-white/[0.09] bg-[oklch(0.09_0.025_280)] shadow-[0_48px_96px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.4)]">
				{/* Subtle inner highlight at top */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
				/>

				{/* Status bar */}
				<div className="flex items-center justify-between px-6 pt-4 pb-1">
					<span className="font-bold text-foreground/80 text-xs tabular-nums">
						9:41
					</span>
					<div className="flex items-center gap-1.5" aria-hidden="true">
						<Wifi className="h-2.5 w-2.5 text-foreground/50" />
						<div className="flex items-end gap-[2px]">
							{[3, 5, 7, 9].map((h) => (
								<div
									key={h}
									className="w-[2.5px] rounded-sm bg-foreground/50"
									style={{ height: h }}
								/>
							))}
						</div>
					</div>
				</div>

				{/* Screen */}
				{children}

				{/* Home indicator */}
				<div className="flex justify-center pb-2.5 pt-3">
					<div className="h-1 w-24 rounded-full bg-white/15" />
				</div>
			</div>
		</div>
	);
}

/* ─── Floating glassmorphism badge ─── */
function FloatBadge({
	className,
	children,
	anim = "animate-float-a",
}: {
	className?: string;
	children: React.ReactNode;
	anim?: string;
}) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute z-20 select-none rounded-2xl border border-white/10 bg-background/75 px-3.5 py-2.5 shadow-xl backdrop-blur-xl",
				anim,
				className,
			)}
		>
			{children}
		</div>
	);
}

/* ─── Main export ─── */
export function InteractiveDemo() {
	const [songs, setSongs] = useState<Song[]>(INITIAL_SONGS);

	const handleVote = useCallback((id: number, type: "up" | "down") => {
		setSongs((prev) =>
			prev.map((song) => {
				if (song.id !== id) return song;
				const cur = song.userVote;
				if (type === "up") {
					if (cur === "up")
						return { ...song, score: song.score - 1, userVote: null };
					if (cur === "down")
						return { ...song, score: song.score + 2, userVote: "up" as const };
					return { ...song, score: song.score + 1, userVote: "up" as const };
				}
				if (cur === "down")
					return { ...song, score: song.score + 1, userVote: null };
				if (cur === "up")
					return { ...song, score: song.score - 2, userVote: "down" as const };
				return { ...song, score: song.score - 1, userVote: "down" as const };
			}),
		);
	}, []);

	const sorted = [...songs].sort((a, b) => b.score - a.score);
	const totalVotes = songs.reduce(
		(acc, s) =>
			acc + Math.abs(s.score - INITIAL_SONGS.find((i) => i.id === s.id)!.score),
		0,
	);
	const listeners = 47 + totalVotes * 3;

	return (
		<section id="demo" className="relative overflow-hidden bg-[oklch(0.06_0.025_280)] px-6 py-24 md:py-36">
			{/* Ambient blobs */}
			<div
				aria-hidden="true"
				className="animate-blob-a pointer-events-none absolute top-[-10%] left-[10%] h-[500px] w-[500px] rounded-full opacity-[0.07]"
				style={{
					background:
						"radial-gradient(circle, color-mix(in oklch, var(--primary) 80%, transparent), transparent)",
					filter: "blur(80px)",
				}}
			/>
			<div
				aria-hidden="true"
				className="animate-blob-b pointer-events-none absolute bottom-[-5%] right-[5%] h-[400px] w-[400px] rounded-full opacity-[0.06]"
				style={{
					background:
						"radial-gradient(circle, color-mix(in oklch, var(--accent) 80%, transparent), transparent)",
					filter: "blur(70px)",
				}}
			/>

			<div className="relative mx-auto max-w-5xl">
				{/* Header */}
				<Reveal className="mb-16 text-center">
					<div className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 font-semibold text-accent text-xs uppercase tracking-widest backdrop-blur-sm">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 motion-safe:animate-ping" />
							<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
						</span>
						Interactive demo
					</div>
					<h2 className="font-black font-heading text-[clamp(2.2rem,6vw,4.5rem)] text-foreground leading-[0.88] tracking-tighter">
						Your crowd.{" "}
						<span className="text-primary">Your queue.</span>
					</h2>
					<p className="mx-auto mt-5 max-w-md text-muted-foreground leading-relaxed">
						Tap the arrows and watch scores shift. The top-ranked song plays
						next — decided by everyone in the room.
					</p>
				</Reveal>

				{/* Phone + floating badges */}
				<Reveal direction="scale" delay={150}>
					<div className="relative mx-auto max-w-xs">
						{/* Floating badge: listeners */}
						<FloatBadge
							className="-top-5 -right-4 md:-right-16"
							anim="animate-float-b"
						>
							<div className="flex items-center gap-2">
								<Users className="h-3.5 w-3.5 text-primary" />
								<span className="font-bold text-foreground/90 text-xs tabular-nums">
									{listeners}
								</span>
								<span className="text-muted-foreground/50 text-xs">
									listening
								</span>
							</div>
						</FloatBadge>

						{/* Floating badge: votes */}
						<FloatBadge
							className="-bottom-5 -left-4 md:-left-20"
							anim="animate-float-c"
						>
							<div className="flex items-center gap-1.5">
								<span className="font-black text-accent text-sm tabular-nums">
									+{247 + totalVotes * 2}
								</span>
								<span className="text-muted-foreground/50 text-xs">
									votes cast today
								</span>
							</div>
						</FloatBadge>

						<PhoneShell>
							<div className="px-4 pb-2">
								{/* Now playing */}
								<div className="mb-3 overflow-hidden rounded-2xl border border-accent/25 bg-accent/[0.08] p-3">
									<div className="mb-2 flex items-center justify-between">
										<div className="flex items-center gap-1.5">
											<span className="relative flex h-1.5 w-1.5">
												<span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
												<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
											</span>
											<span className="font-semibold text-accent text-[10px] uppercase tracking-widest">
												Now playing
											</span>
										</div>
										<EqBars />
									</div>
									<div className="flex items-center gap-2.5">
										<div
											className={cn(
												"h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br shadow",
												NOW_PLAYING.from,
												NOW_PLAYING.to,
											)}
											aria-hidden="true"
										/>
										<div className="min-w-0 flex-1">
											<p className="truncate font-semibold text-foreground text-xs leading-tight">
												{NOW_PLAYING.title}
											</p>
											<p className="truncate text-muted-foreground/55 text-[10px]">
												{NOW_PLAYING.artist}
											</p>
										</div>
									</div>
									<div className="mt-2.5 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
										<div
											className="h-full rounded-full bg-accent/70"
											style={{ width: `${NOW_PLAYING.progress}%` }}
										/>
									</div>
								</div>

								{/* Queue header */}
								<div className="mb-2.5 flex items-center justify-between">
									<span className="font-semibold text-muted-foreground/50 text-[10px] uppercase tracking-widest">
										Up next
									</span>
									<span className="text-muted-foreground/35 text-[10px]">
										{songs.length} songs
									</span>
								</div>

								{/* Queue */}
								<div className="flex flex-col gap-2">
									{sorted.map((song, rank) => (
										<SongCard
											key={song.id}
											song={song}
											rank={rank}
											onVote={handleVote}
										/>
									))}
								</div>

								<p className="mt-3 text-center text-muted-foreground/30 text-[10px]">
									tap the arrows · highest score plays next
								</p>
							</div>
						</PhoneShell>
					</div>
				</Reveal>
			</div>
		</section>
	);
}
