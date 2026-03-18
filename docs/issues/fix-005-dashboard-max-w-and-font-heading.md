# FIX-005: Dashboard no-venue/no-session states use wrong max-width and missing font-heading

**Severity:** P2
**Spec:** UI/UX Spec Section 5 "Page Layouts — Dashboard"

---

## Problem

Two styling issues in the dashboard's empty states:

### Issue A: `max-w-lg` instead of `max-w-md`

The spec says:

> "No venue: centered card (max-w-md) with create venue form"

**File:** `apps/web/src/app/(venue)/dashboard/dashboard.tsx:29,41`
```tsx
<div className="container mx-auto max-w-lg px-4 py-8">  // line 29 (no venue)
<div className="container mx-auto max-w-lg px-4 py-8">  // line 41 (no session)
```

`max-w-lg` = 512px. `max-w-md` = 448px. The forms are 64px wider than intended. On mobile this makes no difference, but on tablets the extra width makes the forms feel stretched.

### Issue B: `<h1>` elements missing `font-heading`

The spec requires `font-heading` (Space Grotesk) on all headings. The active session dashboard correctly uses it, but the empty states don't:

**File:** `apps/web/src/app/(venue)/dashboard/dashboard.tsx:31,43`
```tsx
<h1 className="mb-6 font-bold text-2xl">Create Your Venue</h1>     // line 31
<h1 className="mb-2 font-bold text-2xl">{venue.name}</h1>           // line 43
```

Both use the default `font-sans` (DM Sans) instead of `font-heading` (Space Grotesk). This creates a jarring font switch when the user creates a venue and transitions to the active session dashboard where headings use Space Grotesk.

## Fix

```tsx
// Line 29 and 41: max-w-lg → max-w-md
<div className="container mx-auto max-w-md px-4 py-8">

// Line 31 and 43: add font-heading
<h1 className="mb-6 font-heading font-bold text-2xl">Create Your Venue</h1>
<h1 className="mb-2 font-heading font-bold text-2xl">{venue.name}</h1>
```
