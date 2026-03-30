interface LogoProps {
	size?: "sm" | "default" | "lg";
	showMark?: boolean;
}

function LogoMark({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 40 40"
			fill="none"
			className={className}
			aria-hidden="true"
		>
			<rect x="4" y="20" width="8" height="16" rx="4" fill="currentColor" />
			<rect x="16" y="8" width="8" height="28" rx="4" fill="currentColor" />
			<rect x="28" y="14" width="8" height="22" rx="4" fill="currentColor" />
		</svg>
	);
}

const sizeMap = {
	sm: { text: "text-lg", mark: "h-6 w-6" },
	default: { text: "text-2xl", mark: "h-6 w-6" },
	lg: { text: "text-5xl", mark: "h-10 w-10" },
};

export default function Logo({ size = "default", showMark = true }: LogoProps) {
	const s = sizeMap[size];
	return (
		<span
			className={`inline-flex items-center gap-2 font-bold font-heading ${s.text} tracking-tight`}
		>
			{showMark && <LogoMark className={`${s.mark} text-primary`} />}
			<span>
				<span className="text-foreground">Crowd</span>
				<span className="text-primary">Vibe</span>
			</span>
		</span>
	);
}

export { LogoMark };
