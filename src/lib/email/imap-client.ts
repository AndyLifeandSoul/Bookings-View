import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { InboundMessage } from "./graph-client";
import { mailboxPassword } from "./credentials";

/**
 * Reads a venue's mailbox over IMAP, the receiving counterpart to
 * smtp-client.ts's SMTP sending. Andy's mailboxes are Microsoft 365 with
 * IMAP/SMTP AUTH enabled, so this uses the same per-mailbox passwords
 * (SMTP_CREDENTIALS_JSON) against imap.office365.com, no Azure app
 * registration needed. Returns the same InboundMessage shape as the Graph
 * reader (graph-client.ts) so poll-inbox doesn't care which one ran.
 *
 * Config from env, never the repo:
 *  - SMTP_CREDENTIALS_JSON: the mailbox -> password map (shared with sending).
 *  - IMAP_HOST / IMAP_PORT: default imap.office365.com:993 (implicit TLS).
 *
 * Same Microsoft basic-auth deprecation caveat as SMTP: works where IMAP
 * AUTH is enabled per mailbox, the Graph reader is the fallback otherwise.
 */

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Bound the very first poll (no high-water mark yet) so it can't ingest
// years of inbox history in one go.
const FIRST_RUN_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_MESSAGES_PER_POLL = 100;

/**
 * Messages received after `sinceIso` (exclusive) in `mailbox`'s inbox,
 * oldest first. IMAP's SINCE search is date-granular, so we search from the
 * calendar day of `sinceIso` and refine to strictly-after in JS. Returns []
 * (rather than throwing) when credentials aren't configured for the mailbox.
 */
export async function listRecentInboxViaImap(mailbox: string, sinceIso: string | null): Promise<InboundMessage[]> {
  const password = mailboxPassword(mailbox);
  if (!password) return [];

  const host = process.env.IMAP_HOST || "imap.office365.com";
  const port = Number(process.env.IMAP_PORT || "993");
  const since = sinceIso ? new Date(sinceIso) : new Date(Date.now() - FIRST_RUN_LOOKBACK_MS);

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user: mailbox, pass: password },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = (await client.search({ since }, { uid: true })) || [];
      if (uids.length === 0) return [];

      // Newest UIDs are largest; cap to the most recent MAX_MESSAGES_PER_POLL.
      const capped = uids.slice(-MAX_MESSAGES_PER_POLL);

      const out: InboundMessage[] = [];
      for await (const msg of client.fetch(capped, { source: true, internalDate: true }, { uid: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const received = new Date(msg.internalDate ?? parsed.date ?? Date.now());
        // Refine past IMAP's date-only SINCE to a strict timestamp compare.
        if (received.getTime() <= since.getTime()) continue;

        const fromAddr = Array.isArray(parsed.from?.value) ? parsed.from?.value[0]?.address : undefined;
        const bodyText = (parsed.text && parsed.text.trim()) || stripHtml(typeof parsed.html === "string" ? parsed.html : "");

        out.push({
          graphId: `imap-${msg.uid}`,
          from: fromAddr ?? "",
          subject: parsed.subject ?? "",
          bodyText,
          receivedDateTime: received.toISOString(),
        });
      }

      out.sort((a, b) => a.receivedDateTime.localeCompare(b.receivedDateTime));
      return out;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}
