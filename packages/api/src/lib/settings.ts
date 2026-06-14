import { z } from "zod";

export const VenueSettingsSchema = z.object({
	maxSuggestionsPerGuest: z.number().int().min(1).max(20).default(5),
	suggestionCooldownSec: z.number().int().min(0).max(300).default(30),
	downvoteSkipThreshold: z.number().int().min(-20).max(-1).default(-3),
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
