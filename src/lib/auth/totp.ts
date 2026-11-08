import crypto from "node:crypto";

/**
 * Two-step sign-in with an authenticator app (Google Authenticator,
 * Microsoft Authenticator, 1Password and so on): RFC 6238 TOTP, SHA-1,
 * 6 digits, 30-second steps, which is what every one of those apps expects.
 *
 * The shared secret is encrypted before it goes in the database
 * (AES-256-GCM with a key derived from AUTH_SECRET), so a copy of the
 * database alone can't be used to generate codes. Rotating AUTH_SECRET
 * therefore also turns everyone's two-step sign-in off in practice: their
 * stored secrets can no longer be read, and an owner has to switch it off
 * for them so they can set it up again.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
/** Accept the code either side of now as well, for phones whose clock is a little out. */
const WINDOW = 1;
const ISSUER = "BookMeIn";
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = s.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random 160-bit secret, base32 as authenticator apps expect. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/**
 * Checks a 6-digit code. Returns the step it matched so the caller can save
 * it and refuse that same code a second time, or null when it doesn't match
 * (or was already used: anything at or before lastStep is refused).
 */
export function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const step = currentStep(now);
  for (let i = -WINDOW; i <= WINDOW; i++) {
    const s = step + i;
    if (lastStep != null && s <= lastStep) continue;
    const expected = codeAt(secret, s);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return s;
  }
  return null;
}

/** The otpauth:// link an authenticator app reads from the QR code. */
export function otpauthUri(email: string, secret: string): string {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** A 32-byte key for one purpose, derived from AUTH_SECRET so no new secret is needed. */
export function derivedKey(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET is missing or too short.");
  return Buffer.from(crypto.hkdfSync("sha256", secret, "bookmein-staff-app", purpose, 32));
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey("totp-secret-encryption"), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

/** Null if the value can't be read (wrong format, or AUTH_SECRET has changed). */
export function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, tag, enc] = stored.split(".");
    if (v !== "v1" || !iv || !tag || !enc) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey("totp-secret-encryption"), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
