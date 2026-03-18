# FIX-004: Start session form missing Spotify "Coming Soon" provider selector

**Severity:** P1
**Spec:** MVP Spec Section 8 "Venue Management & Dashboard"

---

## Problem

The spec describes the start session UI as:

> "Start Session → optional name → select provider (YouTube; Spotify greyed 'Coming Soon')"

The current implementation has only a session name input and hardcodes the provider:

**File:** `apps/web/src/components/venue/start-session-form.tsx:32-35`
```tsx
startSession.mutate({
  venueId,
  name: name || undefined,
  musicProvider: "youtube",
});
```

There is no provider selector UI at all. This matters because:

1. **User expectation setting** — venue owners should see that Spotify support is planned. This is a product signal that communicates the roadmap.
2. **Schema readiness** — the `musicProvider` field on `VenueSession` already supports `"youtube" | "spotify"`. The tRPC input schema (`z.enum(["youtube", "spotify"]).default("youtube")`) accepts both. The UI is the only missing piece.
3. **Forward compatibility** — when Spotify is implemented, the UI already has the selector in place.

## Fix

Add a simple radio group or button group below the session name input:

```tsx
<div className="grid gap-2">
  <Label>Music Provider</Label>
  <div className="flex gap-2">
    <Button
      type="button"
      variant={provider === "youtube" ? "default" : "outline"}
      onClick={() => setProvider("youtube")}
      className="flex-1"
    >
      YouTube
    </Button>
    <Button
      type="button"
      variant="outline"
      disabled
      className="flex-1 opacity-50"
    >
      Spotify — Coming Soon
    </Button>
  </div>
</div>
```

Add `const [provider, setProvider] = useState<"youtube" | "spotify">("youtube")` and pass `musicProvider: provider` to the mutation.
