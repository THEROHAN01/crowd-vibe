export default function LiveBadge() {
	return (
		<span className="inline-flex items-center gap-1.5 font-medium text-accent text-xs">
			<span className="relative flex h-2 w-2">
				<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
				<span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
			</span>
			Live
		</span>
	);
}
