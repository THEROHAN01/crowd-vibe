# UI-BREAKING-001: Owner Dashboard Search Has No Loading or Error State

**Severity:** P1 — HIGH  
**Status:** ✅ RESOLVED — commit `e478de3`  
**Area:** UI / Owner Dashboard  
**File:** `apps/web/src/components/venue/session-dashboard.tsx` (lines 49–53, 211–242)

---

## Problem

The `searchResults` query in the owner dashboard (lines 49–53) can be in four states: disabled, loading, error, or success. The rendering section (lines 211–242) only conditionally renders when `searchResults.data?.tracks` exists — there is no loading spinner, no error message, and no empty state message when the query is disabled.

When a venue owner types a search query, the results section is completely blank while the request is in-flight. If the API call fails (network error, YouTube quota exceeded), the section remains blank with no indication of what went wrong.

This contrasts with `song-search.tsx` (the guest version) which correctly shows a "Searching..." state.

## Impact

- Owner searches and sees nothing while loading — assumes the feature is broken
- API errors are silently swallowed — owner cannot retry or understand the failure
- Inconsistency with the guest search experience (which handles these states correctly)

## Fix

Add loading and error states to the search results section in `session-dashboard.tsx`, mirroring the pattern in `song-search.tsx`:

```tsx
{searchResults.isLoading && (
  <p className="text-center text-sm text-muted-foreground py-4">Searching...</p>
)}
{searchResults.isError && (
  <p className="text-center text-sm text-destructive py-4">Search failed. Try again.</p>
)}
```
