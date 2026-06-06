"use client";
import { cn } from "@crowd-vibe/ui/lib/utils";
import type React from "react";
import { useInView } from "@/hooks/use-in-view";

type Direction = "up" | "left" | "right" | "scale";

interface RevealProps {
	children: React.ReactNode;
	className?: string;
	delay?: number;
	direction?: Direction;
	threshold?: number;
}

const dirClass: Record<Direction, string> = {
	up: "reveal-up",
	left: "reveal-left",
	right: "reveal-right",
	scale: "reveal-scale",
};

export function Reveal({
	children,
	className,
	delay = 0,
	direction = "up",
	threshold,
}: RevealProps) {
	const [ref, inView] = useInView(threshold ? { threshold } : undefined);

	return (
		<div
			ref={ref as React.RefObject<HTMLDivElement>}
			className={cn(dirClass[direction], inView && "in-view", className)}
			style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
		>
			{children}
		</div>
	);
}
