import { MapPin, Music2, ThumbsUp, Users } from "lucide-react";

const EVENTS = [
	{
		venue: "The Rusty Anchor",
		city: "London",
		event: "Blinding Lights climbing to #1",
		icon: "chart",
		count: "89 votes",
	},
	{
		venue: "Neon Lounge",
		city: "Berlin",
		event: "STAY added to queue",
		icon: "users",
		count: "23 online",
	},
	{
		venue: "Club Azul",
		city: "Madrid",
		event: "Bohemian Rhapsody won the vote",
		icon: "thumbs",
		count: "156 upvotes",
	},
	{
		venue: "The Grand Bar",
		city: "New York",
		event: "Bad Guy just joined the queue",
		icon: "music",
		count: "8 guests",
	},
	{
		venue: "Electric Tiger",
		city: "Mumbai",
		event: "Levitating reached +47 score",
		icon: "chart",
		count: "+47 pts",
	},
	{
		venue: "Sunset Club",
		city: "Sydney",
		event: "Shape of You now playing",
		icon: "music",
		count: "203 cast",
	},
	{
		venue: "The Fox & Hound",
		city: "Dublin",
		event: "Cruel Summer moved up 3 spots",
		icon: "chart",
		count: "51 votes",
	},
	{
		venue: "Skyline Rooftop",
		city: "Toronto",
		event: "As It Was crowned #1 again",
		icon: "thumbs",
		count: "118 upvotes",
	},
] as const;

function EventIcon({ type }: { type: string }) {
	if (type === "chart") return <Music2 className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />;
	if (type === "users") return <Users className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" />;
	if (type === "thumbs") return <ThumbsUp className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" />;
	return <Music2 className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />;
}

function TickerItem({ event }: { event: (typeof EVENTS)[number] }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-2 px-6">
			{/* Live dot */}
			<span className="relative flex h-1.5 w-1.5 shrink-0">
				<span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
				<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
			</span>

			{/* Venue + city */}
			<span className="flex items-center gap-1 text-foreground/70">
				<MapPin className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
				<span className="font-semibold text-foreground/90">{event.venue}</span>
				<span className="text-muted-foreground/40">{event.city}</span>
			</span>

			<span className="text-border/70">·</span>

			{/* Event */}
			<span className="flex items-center gap-1.5">
				<EventIcon type={event.icon} />
				<span className="text-muted-foreground/80">{event.event}</span>
			</span>

			<span className="text-border/70">·</span>

			{/* Count */}
			<span className="font-semibold tabular-nums text-primary/80">{event.count}</span>
		</span>
	);
}

export function ActivityTicker() {
	const doubled = [...EVENTS, ...EVENTS];

	return (
		<div
			aria-label="Live venue activity"
			className="relative overflow-hidden border-border/40 border-y bg-background py-2.5"
		>
			{/* Edge fades */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent"
			/>

			{/* Scrolling track */}
			<div className="animate-marquee flex w-max font-medium text-xs tracking-wide">
				{doubled.map((event, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: intentional duplicate for marquee
					<TickerItem key={i} event={event} />
				))}
			</div>
		</div>
	);
}
