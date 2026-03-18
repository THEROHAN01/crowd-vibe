"use client";

interface LogoProps {
  size?: "sm" | "default";
}

export default function Logo({ size = "default" }: LogoProps) {
  const textSize = size === "sm" ? "text-lg" : "text-2xl";
  return (
    <span className={`font-heading font-bold ${textSize} tracking-tight`}>
      <span className="text-foreground">Crowd</span>
      <span className="text-primary">Vibe</span>
    </span>
  );
}
