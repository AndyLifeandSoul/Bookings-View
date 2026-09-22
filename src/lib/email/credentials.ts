/**
 * Shared access to the per-venue mailbox passwords, the same
 * SMTP_CREDENTIALS_JSON env var lifeandsoul-bookings' smtp-client.ts uses
 * for sending. Reading a mailbox over IMAP (see imap-client.ts) needs the
 * same password sending does, so both sides read it from here rather than
 * duplicating the parse. Passwords live only in this env var, never in the
 * repo or database.
 *
 * SMTP_CREDENTIALS_JSON is a JSON object mapping each mailbox address to its
 * password, e.g. {"info@dv8bar.co.uk":"...","congleton@rumbabar.co.uk":"..."}.
 */

export function isMailboxCredentialsConfigured(): boolean {
  return !!process.env.SMTP_CREDENTIALS_JSON;
}

/** The password for a mailbox, case-insensitively, or null if unconfigured / no entry / malformed JSON. */
export function mailboxPassword(mailbox: string): string | null {
  const raw = process.env.SMTP_CREDENTIALS_JSON;
  if (!raw) return null;
  let credentials: Record<string, string>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    credentials = parsed as Record<string, string>;
  } catch {
    return null;
  }
  if (credentials[mailbox]) return credentials[mailbox];
  const lower = mailbox.toLowerCase();
  for (const [key, value] of Object.entries(credentials)) {
    if (key.toLowerCase() === lower) return value;
  }
  return null;
}
