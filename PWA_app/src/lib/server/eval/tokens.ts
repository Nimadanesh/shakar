import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Opaque invitation codes. The code itself is never persisted — only its
 * sha256. Verification is constant-time. Codes are bearer secrets delivered
 * out-of-band (never logged, never embedded in exports).
 */
export function mintInvitationCode(): string {
  return `ev_${randomBytes(24).toString("hex")}`;
}

export function hashInvitationCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function verifyInvitationCode(code: string, hash: string): boolean {
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(hashInvitationCode(code), "hex");
    b = Buffer.from(hash, "hex");
  } catch {
    return false;
  }
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Anonymous participant id (random UUID, no personal data). */
export function mintParticipantId(): string {
  return randomBytes(16).toString("hex");
}

export function invitationExpiry(days = 30): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
