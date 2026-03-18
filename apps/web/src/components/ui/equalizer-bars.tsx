export default function EqualizerBars() {
	return (
		<div className="flex h-4 items-end gap-0.5" aria-hidden="true">
			<span
				className="w-[3px] animate-equalize rounded-full bg-accent"
				style={{ animationDelay: "0s" }}
			/>
			<span
				className="w-[3px] animate-equalize rounded-full bg-accent"
				style={{ animationDelay: "0.2s" }}
			/>
			<span
				className="w-[3px] animate-equalize rounded-full bg-accent"
				style={{ animationDelay: "0.4s" }}
			/>
		</div>
	);
}
