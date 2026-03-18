import { describe, it, expect } from "vitest";
import { parseVenueSettings } from "./settings";

describe("parseVenueSettings", () => {
  it("returns defaults for empty input", () => {
    const result = parseVenueSettings({});
    expect(result).toEqual({
      maxSuggestionsPerGuest: 5,
      suggestionCooldownSec: 30,
      downvoteSkipThreshold: -3,
      allowExplicitContent: true,
    });
  });

  it("returns defaults for null input", () => {
    const result = parseVenueSettings(null);
    expect(result).toEqual({
      maxSuggestionsPerGuest: 5,
      suggestionCooldownSec: 30,
      downvoteSkipThreshold: -3,
      allowExplicitContent: true,
    });
  });

  it("applies partial overrides", () => {
    const result = parseVenueSettings({ maxSuggestionsPerGuest: 10 });
    expect(result.maxSuggestionsPerGuest).toBe(10);
    expect(result.suggestionCooldownSec).toBe(30);
  });

  it("falls back to defaults for invalid input", () => {
    const result = parseVenueSettings("not an object");
    expect(result).toEqual({
      maxSuggestionsPerGuest: 5,
      suggestionCooldownSec: 30,
      downvoteSkipThreshold: -3,
      allowExplicitContent: true,
    });
  });
});
