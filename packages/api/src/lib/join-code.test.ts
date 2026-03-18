import { describe, expect, it } from "vitest";
import { generateJoinCode } from "./join-code";

const VALID_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const AMBIGUOUS = ["O", "0", "I", "1", "L"];

describe("generateJoinCode", () => {
	it("returns a string of length 6", () => {
		expect(generateJoinCode()).toHaveLength(6);
	});

	it("uses only valid charset characters", () => {
		for (let i = 0; i < 100; i++) {
			const code = generateJoinCode();
			for (const char of code) {
				expect(VALID_CHARS).toContain(char);
			}
		}
	});

	it("does not contain ambiguous characters", () => {
		for (let i = 0; i < 100; i++) {
			const code = generateJoinCode();
			for (const char of AMBIGUOUS) {
				expect(code).not.toContain(char);
			}
		}
	});

	it("generates different codes on successive calls", () => {
		const codes = new Set<string>();
		for (let i = 0; i < 50; i++) {
			codes.add(generateJoinCode());
		}
		expect(codes.size).toBe(50);
	});
});
