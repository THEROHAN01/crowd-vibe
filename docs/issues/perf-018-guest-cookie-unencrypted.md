# PERF-018: Guest Cookie Is HMAC-Signed but Not Encrypted — Guest ID Readable

| Field        | Value                                                           |
|--------------|-----------------------------------------------------------------|
| **Severity** | P2 MEDIUM                                                       |
| **Category** | Security / Cookie Design                                        |
| **File**     | `packages/api/src/lib/cookie.ts`                                |
| **Status**   | Open                                                            |
| **Date**     | 2026-03-18                                                      |

---

## Problem Statement

Guest identity cookies use the format `<guestId>.<hmacSignature>`. The guest ID (a CUID) is stored in plaintext. While the HMAC-SHA256 signature prevents tampering (a guest cannot change their ID without invalidating the signature), anyone can **read** the guest ID by inspecting their own cookie.

### Current Cookie Implementation

**File: `packages/api/src/lib/cookie.ts`** (lines 1-24)

```typescript
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
```

### What a Guest Cookie Looks Like

```
cv_guest=cm5k8x2qr0001p4w3kf7h9g2m.a1b2c3d4e5f6...64-char-hex-signature
```

The part before the dot (`cm5k8x2qr0001p4w3kf7h9g2m`) is the plaintext CUID guest ID. Anyone can see it in browser DevTools (Application > Cookies) or by reading `document.cookie` from client-side JavaScript.

### Where the Cookie Is Used

**File: `apps/web/src/app/api/sse/[sessionId]/route.ts`** (lines 37-46)

```typescript
const guestCookie = req.cookies.get("cv_guest")?.value;
if (guestCookie) {
    const guestId = verifySignedCookie(guestCookie, env.BETTER_AUTH_SECRET);
    if (guestId) {
        const guest = await prisma.guestUser.findUnique({
            where: { id: guestId },
            select: { sessionId: true },
        });
        if (guest?.sessionId === sessionId) authorized = true;
    }
}
```

The guest ID extracted from the cookie is used directly as a database lookup key.

---

## Security Analysis

### What the HMAC Protects Against

| Attack                         | Protected? | Notes                                              |
|--------------------------------|------------|-----------------------------------------------------|
| Guest ID forgery               | Yes        | Cannot create a valid signature without the secret   |
| Cookie tampering               | Yes        | Changing any character invalidates the HMAC          |
| Replay attack                  | No         | Cookie is valid until session ends (no expiry)       |
| Guest ID enumeration           | No         | ID is visible in the cookie                          |

### What Is Exposed

1. **Internal database IDs** -- The CUID (`cm5k8x2qr0001p4w3kf7h9g2m`) is the primary key in the `guestUser` table. While CUIDs are not sequential, exposing internal database identifiers is generally considered poor security hygiene.

2. **Cross-reference potential** -- If a guest is active in multiple sessions (not currently supported, but a potential future feature), the same guest ID could be used to correlate activity across sessions.

3. **CUID timestamp leakage** -- CUIDs encode a timestamp component. The guest ID reveals approximately when the guest record was created, which could be used for behavioral analysis.

### Shared Secret Concern

**File: `packages/auth/src/index.ts`** (line 44)

```typescript
secret: env.BETTER_AUTH_SECRET,
```

**File: `apps/web/src/app/api/sse/[sessionId]/route.ts`** (line 39)

```typescript
const guestId = verifySignedCookie(guestCookie, env.BETTER_AUTH_SECRET);
```

The `BETTER_AUTH_SECRET` is used for both:
1. Better Auth session management (owner authentication)
2. Guest cookie HMAC signing

This creates a **single point of failure**: if the secret is compromised, both the owner authentication system and the guest identity system are compromised simultaneously. Additionally, a vulnerability in one system (e.g., a timing attack on the guest cookie verification) could potentially leak information useful for attacking the other system.

Note: The constant-time comparison in `verifySignedCookie` (lines 19-22) mitigates timing attacks specifically, which is good practice.

---

## Root Cause

The cookie was designed for integrity (tamper-proofing) but not confidentiality (secrecy of the value). This is a common pattern in web applications (e.g., Express `cookie-signature`) and is not necessarily wrong, but it exposes internal identifiers unnecessarily.

---

## Impact Assessment

| Dimension                | Impact   | Notes                                                     |
|--------------------------|----------|-----------------------------------------------------------|
| **ID exposure**          | Low      | CUIDs are random; knowing one does not help guess others  |
| **Session fixation**     | Low      | CUIDs are not predictable; cannot forge valid IDs         |
| **Shared secret risk**   | Medium   | One compromised secret breaks both auth systems           |
| **Compliance**           | Medium   | Some security audits flag plaintext internal IDs in cookies |
| **Future risk**          | Medium   | As features expand, the guest ID becomes more sensitive   |

**Overall: Low-to-medium risk.** The HMAC prevents the most dangerous attacks (forgery, tampering). The plaintext ID exposure is a hygiene issue rather than an active vulnerability, given that CUIDs are random.

---

## Fix Instructions

### Option A: Encrypt the Cookie Payload with AES-256-GCM (Recommended for Security-Sensitive Deployments)

Replace HMAC signing with authenticated encryption, which provides both integrity AND confidentiality.

**File: `packages/api/src/lib/cookie.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;  // GCM recommended IV length
const TAG_LENGTH = 16; // GCM auth tag length

/**
 * Derive a 256-bit encryption key from the secret.
 * Uses SHA-256 so the secret can be any length.
 */
function deriveKey(secret: string): Buffer {
    return createHash("sha256").update(secret).digest();
}

export function encryptCookie(value: string, secret: string): string {
    const key = deriveKey(secret);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Format: base64(iv + encrypted + tag)
    const combined = Buffer.concat([iv, encrypted, tag]);
    return combined.toString("base64url");
}

export function decryptCookie(
    encrypted: string,
    secret: string,
): string | null {
    try {
        const key = deriveKey(secret);
        const combined = Buffer.from(encrypted, "base64url");

        if (combined.length < IV_LENGTH + TAG_LENGTH + 1) {
            return null; // Too short to be valid
        }

        const iv = combined.subarray(0, IV_LENGTH);
        const tag = combined.subarray(combined.length - TAG_LENGTH);
        const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);

        return decrypted.toString("utf8");
    } catch {
        return null; // Decryption failed (tampered, wrong key, etc.)
    }
}

// Keep the old functions for backward compatibility during migration
export function signCookie(value: string, secret: string): string {
    const { createHmac } = require("node:crypto");
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
    const { createHmac } = require("node:crypto");
    const expected = createHmac("sha256", secret).update(value).digest("hex");
    if (signature.length !== expected.length) return null;
    let mismatch = 0;
    for (let i = 0; i < signature.length; i++) {
        mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return mismatch === 0 ? value : null;
}
```

#### Migration Strategy

During migration, the cookie verification code should try decryption first, then fall back to HMAC verification:

```typescript
// In SSE route and tRPC context:
const guestCookie = req.cookies.get("cv_guest")?.value;
if (guestCookie) {
    // Try new encrypted format first
    let guestId = decryptCookie(guestCookie, env.GUEST_COOKIE_SECRET);
    // Fall back to old HMAC format for existing sessions
    if (!guestId) {
        guestId = verifySignedCookie(guestCookie, env.BETTER_AUTH_SECRET);
    }
    // ... rest of auth logic
}
```

### Option B: Use a Separate Secret for Guest Cookies (Minimum Fix)

Even without encryption, using a separate secret reduces the blast radius of a compromised key.

Add to `.env`:

```
GUEST_COOKIE_SECRET=<generate-a-new-random-secret>
```

Update all `verifySignedCookie` and `signCookie` calls to use `env.GUEST_COOKIE_SECRET` instead of `env.BETTER_AUTH_SECRET`.

### Option C: Accept the Risk and Document the Decision

If the team decides the risk is acceptable (CUIDs are random, HMAC prevents forgery), document the decision formally:

```
DECISION: Guest cookies use HMAC signing without encryption.
RATIONALE: CUIDs are random and non-sequential. The HMAC prevents forgery.
         Encryption adds complexity and CPU cost for each cookie verification.
RISK ACCEPTED: Internal guest IDs are visible to the guest themselves.
MITIGATIONS:
  - CUIDs are cryptographically random (not sequential)
  - HMAC uses constant-time comparison to prevent timing attacks
  - Guest IDs have no inherent value (no PII, no financial data)
REVIEW DATE: When adding features that make guest IDs more sensitive
             (e.g., cross-session identity, guest profiles)
```

---

## Verification

### For Option A (Encrypted Cookies)

1. Clear existing `cv_guest` cookies in the browser
2. Join a session as a guest
3. Inspect the `cv_guest` cookie value in DevTools
4. **Before fix:** `cm5k8x2qr0001p4w3kf7h9g2m.a1b2c3d4...` (readable CUID)
5. **After fix:** `dGhpcyBpcyBlbmNyeXB0ZWQ...` (opaque base64url string)
6. Verify all guest functionality works (voting, searching, SSE events)

### For Option B (Separate Secret)

1. Set `GUEST_COOKIE_SECRET` in `.env`
2. Restart the server
3. Existing guest cookies should be invalidated (guests will need to rejoin)
4. New cookies should work correctly with the new secret

---

## Related Issues

- [PERF-015: Vote casting has no rate limit](./perf-015-no-vote-rate-limit.md) -- a compromised guest ID combined with no rate limit could amplify abuse
