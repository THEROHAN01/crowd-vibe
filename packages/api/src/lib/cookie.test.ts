import { describe, it, expect } from "vitest";
import { signCookie, verifySignedCookie } from "./cookie";

describe("signCookie / verifySignedCookie", () => {
  const secret = "test-secret-32-chars-long-minimum";

  it("round-trips: sign then verify returns original value", () => {
    const signed = signCookie("guest-123", secret);
    expect(verifySignedCookie(signed, secret)).toBe("guest-123");
  });

  it("rejects tampered signature", () => {
    const signed = signCookie("guest-123", secret);
    const tampered = `${signed}x`;
    expect(verifySignedCookie(tampered, secret)).toBeNull();
  });

  it("rejects tampered value", () => {
    const signed = signCookie("guest-123", secret);
    const tampered = `guest-456${signed.slice(signed.lastIndexOf("."))}`;
    expect(verifySignedCookie(tampered, secret)).toBeNull();
  });

  it("returns null for input without a dot separator", () => {
    expect(verifySignedCookie("no-dot-here", secret)).toBeNull();
  });

  it("returns null for wrong secret", () => {
    const signed = signCookie("guest-123", secret);
    expect(verifySignedCookie(signed, "different-secret")).toBeNull();
  });

  it("handles values that contain dots", () => {
    const signed = signCookie("a.b.c", secret);
    expect(verifySignedCookie(signed, secret)).toBe("a.b.c");
  });
});
