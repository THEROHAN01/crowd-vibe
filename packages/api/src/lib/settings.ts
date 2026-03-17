import { z } from "zod";

export const VenueSettingsSchema = z.object({
  maxSuggestionsPerGuest: z.number().default(5),
  suggestionCooldownSec: z.number().default(30),
  downvoteSkipThreshold: z.number().default(-3),
  allowExplicitContent: z.boolean().default(true),
});

export type VenueSettings = z.infer<typeof VenueSettingsSchema>;

export function parseVenueSettings(raw: unknown): VenueSettings {
  try {
    return VenueSettingsSchema.parse(raw ?? {});
  } catch {
    return VenueSettingsSchema.parse({});
  }
}
