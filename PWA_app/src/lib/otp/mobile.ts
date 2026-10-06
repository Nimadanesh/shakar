/**
 * Mobile + code normalization. Single source of truth — lib/auth.ts
 * re-exports these so the client and the API routes validate identically.
 */

/** Iranian mobile: 09xxxxxxxxx. Accepts Persian digits, spaces and dashes. */
export function normalizeMobile(input: string): string | null {
  const en = input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s-]/g, "");
  return /^09\d{9}$/.test(en) ? en : null;
}

/** OTP codes are 5 digits (Persian digits accepted). */
export function normalizeCode(input: string): string | null {
  const en = input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s/g, "");
  return /^\d{5}$/.test(en) ? en : null;
}

/** Crypto-random 5-digit code ("01234" style leading zeros allowed). */
export function randomCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(10000 + (buf[0] % 90000));
}
