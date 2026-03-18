# AUDIT-002: Logo component missing logomark (3 vertical bars)

**Severity:** P2
**Source:** UI/UX Spec, Section 1 "Brand Identity — Logo Concept"
**File:** `apps/web/src/components/ui/logo.tsx`

---

## Problem

The UI/UX spec defines the CrowdVibe logo as two parts:

1. **Logomark** — "3 vertical bars of different heights" representing an audio equalizer / crowd participation visualization
2. **Wordmark** — "Crowd" in `--foreground` + "Vibe" in `--primary`, using Space Grotesk (font-heading)

The current `Logo` component only renders the wordmark:

```tsx
export default function Logo({ size = "default" }: LogoProps) {
  const textSize = size === "sm" ? "text-lg" : "text-2xl";
  return (
    <span className={`font-heading font-bold ${textSize} tracking-tight`}>
      <span className="text-foreground">Crowd</span>
      <span className="text-primary">Vibe</span>
    </span>
  );
}
```

The logomark (3 bars) is completely absent. The codebase already has an `EqualizerBars` component (`apps/web/src/components/ui/equalizer-bars.tsx`) that renders animated bars using `--accent` color — this is semantically very close to the spec's logomark concept, but it is only used inside the `NowPlaying` card, not in the Logo.

The spec treats the logomark + wordmark as a unified brand mark that appears together in the header, landing page, join page, and session view top bar. Without the logomark, the logo is text-only and lacks the visual identity the spec designed.

## Fix

Import `EqualizerBars` into the Logo component and render it alongside the wordmark. For the `sm` size variant (used in headers and top bars), the bars could be smaller or hidden if space is tight:

```tsx
import EqualizerBars from "@/components/ui/equalizer-bars";

export default function Logo({ size = "default" }: LogoProps) {
  const textSize = size === "sm" ? "text-lg" : "text-2xl";
  return (
    <span className={`font-heading font-bold ${textSize} tracking-tight inline-flex items-center gap-2`}>
      {size === "default" && <EqualizerBars />}
      <span className="text-foreground">Crowd</span>
      <span className="text-primary">Vibe</span>
    </span>
  );
}
```

Alternatively, create a dedicated static (non-animated) logomark SVG if the animated equalizer bars are too distracting for a logo context.
