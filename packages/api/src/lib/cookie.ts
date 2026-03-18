import { createHmac } from "node:crypto";

export function signCookie(value: string, secret: string): string {
	const hmac = createHmac("sha256", secret).update(value).digest("hex");
	return `${value}.${hmac}`;
}

export function verifySignedCookie(
	signed: string,
	secret: string,
): string | null {
	const dotIndex = signed.lastIndexOf(".");
	if (dotIndex === -1) return null;
	const value = signed.substring(0, dotIndex);
	const signature = signed.substring(dotIndex + 1);
	const expected = createHmac("sha256", secret).update(value).digest("hex");
	if (signature.length !== expected.length) return null;
	// Constant-time comparison
	let mismatch = 0;
	for (let i = 0; i < signature.length; i++) {
		mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
	}
	return mismatch === 0 ? value : null;
}
