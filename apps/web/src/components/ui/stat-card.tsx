import type { LucideIcon } from "lucide-react";

interface StatCardProps {
	icon: LucideIcon;
	value: number;
	label: string;
	/** Enable aria-live announcements for realtime values */
	live?: boolean;
}

export default function StatCard({
	icon: Icon,
	value,
	label,
	live = false,
}: StatCardProps) {
	return (
		<div
			className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
			role={live ? "status" : undefined}
			aria-label={`${value} ${label}`}
		>
			<Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<div>
				<p className="font-bold font-heading text-xl tabular-nums">{value}</p>
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-widest">
					{label}
				</p>
			</div>
		</div>
	);
}
