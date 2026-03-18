import { cn } from "@crowd-vibe/ui/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
