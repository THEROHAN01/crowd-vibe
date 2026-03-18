# AUDIT-003: Landing page imports Logo component but doesn't use it

**Severity:** P1
**Source:** UI/UX Spec, Section 5 "Page Layouts — Landing Page"; Section 9 "Custom Components"
**File:** `apps/web/src/app/page.tsx`

---

## Problem

The landing page imports the `Logo` component but never renders it. Instead, it duplicates the Logo's markup inline inside an `<h1>`:

```tsx
import Logo from "@/components/ui/logo";  // imported but unused

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 gap-8" ...>
      <div className="text-center">
        <h1 className="font-heading text-5xl font-bold mb-2">
          <span className="text-foreground">Crowd</span>
          <span className="text-primary">Vibe</span>
        </h1>
        ...
```

This creates two problems:

1. **Two sources of truth** — The `Logo` component in `apps/web/src/components/ui/logo.tsx` is the canonical brand mark. If the logo ever changes (e.g., adding the logomark from AUDIT-002, changing colors, updating the font), the landing page won't reflect those changes because it has its own hardcoded copy.

2. **Dead import** — `Logo` is imported on line 5 but never used in the JSX. This is a lint warning (`unused-imports`) and dead code.

3. **Inconsistent sizing** — The inline version uses `text-5xl` while the Logo component's `default` size uses `text-2xl`. The landing page intentionally uses a larger size for the hero, but this should be handled by adding a `lg` size variant to the Logo component rather than bypassing it entirely.

The header (`apps/web/src/components/header.tsx`), join page, and session view all correctly use `<Logo />` — the landing page is the only consumer that duplicates the markup.

## Fix

Option A — Add a `lg` size to the Logo component and use it:

```tsx
// In logo.tsx
const sizes = { sm: "text-lg", default: "text-2xl", lg: "text-5xl" };

// In page.tsx
<h1><Logo size="lg" /></h1>
```

Option B — If the h1 wrapper is needed for semantic HTML, render Logo inside it:

```tsx
<h1>
  <Logo size="lg" />
</h1>
```

Either way, remove the dead `import Logo` if not using it, or replace the inline markup with the component.
