import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  value: number;
  label: string;
}

export default function StatCard({ icon: Icon, value, label }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div>
        <p className="text-xl font-heading font-bold tabular-nums">{value}</p>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
