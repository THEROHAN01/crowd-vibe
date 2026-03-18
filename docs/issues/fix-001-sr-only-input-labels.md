# FIX-001: Three input labels are visually hidden (`sr-only`) — violates accessibility spec

**Severity:** P0
**Spec:** UI/UX Spec Section 7 "Accessibility" + Section 12 "Anti-Patterns"

---

## Problem

The spec explicitly states two rules:

> "Input labels: Visible, not placeholder-only — Label element above every input"

> Anti-pattern: "No placeholder-only labels — always use visible label elements"

Three inputs across the app use `sr-only` on their labels, making them invisible to sighted users. Screen readers can still access them, but sighted users lose the persistent label context — especially problematic when the placeholder disappears after typing.

### Instance 1: Join page — guest name input

**File:** `apps/web/src/app/join/[joinCode]/page.tsx:68`
```tsx
<label htmlFor="displayName" className="sr-only">Your name</label>
```
The guest name input relies entirely on `placeholder="Your name (optional)"` for sighted users.

### Instance 2: Song search sheet — search input

**File:** `apps/web/src/components/session/song-search.tsx:69`
```tsx
<label htmlFor="songSearch" className="sr-only">Search songs</label>
```
The search input relies on `placeholder="Search songs..."`.

### Instance 3: Dashboard — owner song search input

**File:** `apps/web/src/components/venue/session-dashboard.tsx:183`
```tsx
<label htmlFor="ownerSearch" className="sr-only">Search for songs</label>
```
Same pattern — placeholder-only for sighted users.

## Why it matters

- Users with cognitive disabilities rely on persistent labels to understand form fields
- Once a user starts typing, the placeholder vanishes — the field becomes unlabeled
- WCAG 2.1 SC 3.3.2 (Level A) requires labels or instructions for user input
- The spec's own pre-delivery checklist mandates visible labels

## Fix

Remove `sr-only` from all three labels and position them visibly above their inputs:

```tsx
<Label htmlFor="displayName">Your name (optional)</Label>
<Input id="displayName" placeholder="e.g. DJ Fan" ... />
```

Use the `Label` component from `@crowd-vibe/ui/components/label` (already styled with `text-sm font-medium`). Change placeholders to example text rather than duplicating the label.
