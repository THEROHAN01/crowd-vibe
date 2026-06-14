# Venue Settings Admin UI — Design Spec

> Date: 2026-06-14  
> Status: Approved  
> Phase: 2 (Venue Owner Experience)

---

## Goal

Give venue owners a UI to edit their four configurable settings:  
`maxSuggestionsPerGuest`, `suggestionCooldownSec`, `downvoteSkipThreshold`, `allowExplicitContent`.

The schema (`Venue.settings Json`) and parser (`parseVenueSettings`) already exist. This spec covers the API mutation and UI only.

---

## Architecture

Four files change, one file is created:

| File | Change |
|---|---|
| `packages/api/src/routers/venue.ts` | Add `venue.updateSettings` mutation |
| `apps/web/src/components/venue/venue-settings-form.tsx` | **Create** — settings form component |
| `apps/web/src/components/venue/session-dashboard.tsx` | Add gear icon + Sheet trigger in header |
| `apps/web/src/app/(app)/(venue)/dashboard/dashboard.tsx` | Add gear icon + Sheet trigger in "no session" view |

No DB schema changes. No new packages. `parseVenueSettings` and `VenueSettingsSchema` are imported from `@crowd-vibe/api/lib/settings` (isomorphic, Zod only).

---

## API Layer

### `venue.updateSettings`

```typescript
updateSettings: protectedProcedure
  .input(z.object({
    id: z.string(),
    settings: VenueSettingsSchema,
  }))
  .mutation(async ({ ctx, input }) => {
    const venue = await prisma.venue.findUnique({ where: { id: input.id } });
    if (!venue || venue.ownerId !== ctx.user.id)
      throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
    return prisma.venue.update({
      where: { id: input.id },
      data: { settings: input.settings },
    });
  }),
```

- `protectedProcedure` — owner auth required
- Validates ownership before writing
- `VenueSettingsSchema` Zod validation rejects out-of-range or malformed input at the tRPC layer
- Settings take effect immediately — `song.suggest` and `vote` routers read from DB per-request, no session restart needed

### `listMine` — no change

Already returns all `Venue` fields including `settings Json`. Client parses with `parseVenueSettings(venue.settings)`.

---

## Component — `VenueSettingsForm`

**File:** `apps/web/src/components/venue/venue-settings-form.tsx`

**Props:**
```typescript
interface VenueSettingsFormProps {
  venueId: string;
  initialSettings: VenueSettings;
  onSaved: () => void;
}
```

**Visual design (Blueprint aesthetic, project colors):**
- Container: `rounded-none border border-border shadow-[3px_3px_0_hsl(var(--foreground)/0.12)]` — hard offset shadow, sharp corners
- Field labels: `font-mono text-xs tracking-widest uppercase text-muted-foreground`
- Fields separated by `border-t border-border` dividers
- Primary color (`--primary` violet) used for the Switch checked state and Save button

**Four settings:**

| Setting | Control | Range | Default |
|---|---|---|---|
| `maxSuggestionsPerGuest` | `<Input type="number">` | 1–20 | 5 |
| `suggestionCooldownSec` | `<Input type="number">` + "sec" suffix | 0–300 | 30 |
| `downvoteSkipThreshold` | `<Input type="number">` | −20 to −1 | −3 |
| `allowExplicitContent` | shadcn `<Switch>` | boolean | true |

**State:** Controlled local state mirroring `initialSettings`. No React Hook Form (4 fields, too light to justify).

**Mutation:**
```typescript
const save = useMutation(trpc.venue.updateSettings.mutationOptions({
  onSuccess: () => {
    toast.success("Settings saved");
    queryClient.invalidateQueries(trpc.venue.listMine.queryOptions());
    onSaved();
  },
  onError: (err) => toast.error(err.message),
}));
```

**Validation:** Client-side range clamp before submit (number inputs enforce min/max). Zod validates server-side as backup.

---

## Integration — Sheet Trigger

### In `session-dashboard.tsx`

Add to the existing header row (alongside the "End Session" button):

```tsx
<button onClick={() => setSettingsOpen(true)} aria-label="Venue settings">
  <Settings2 className="h-4 w-4" />
</button>

<Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
  <SheetContent side="right" className="w-80">
    <SheetHeader>
      <SheetTitle className="font-mono tracking-widest uppercase text-sm">
        Venue Settings
      </SheetTitle>
    </SheetHeader>
    <VenueSettingsForm
      venueId={venueId}
      initialSettings={parsedSettings}
      onSaved={() => setSettingsOpen(false)}
    />
  </SheetContent>
</Sheet>
```

`parsedSettings` comes from `parseVenueSettings(venue?.settings)` — the venue data is already available to the SessionDashboard via props or a query.

### In `dashboard.tsx` "no session" view

Same pattern — gear icon button in the venue name header triggers the same sheet.

---

## Error Handling

- Invalid number input (out of range): HTML `min`/`max` prevents submission; Zod catches on server
- Ownership violation: `NOT_FOUND` tRPC error → `toast.error`
- Network failure: `onError` → `toast.error(err.message)`
- Save button disabled + spinner while `save.isPending`

---

## Accessibility

- Gear icon button: `aria-label="Venue settings"`
- Sheet: `SheetTitle` provides accessible name
- Number inputs: `aria-describedby` pointing to the description text
- Switch: `aria-label` set to the setting name

---

## Out of Scope

- Venue name / description editing (separate `venue.update` mutation, separate form)
- Per-session settings override
- Settings history / audit log
- Real-time settings propagation to active guests (takes effect on next action)
