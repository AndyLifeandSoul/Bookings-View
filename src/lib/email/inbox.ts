import {
  isEmailConfigured as isGraphConfigured,
  listRecentInbox as listRecentInboxViaGraph,
  type InboundMessage,
} from "./graph-client";
import { isMailboxCredentialsConfigured } from "./credentials";
import { listRecentInboxViaImap } from "./imap-client";

/**
 * The one entry point poll-inbox uses to read a venue's mailbox, picking
 * the transport by what's configured:
 *  - Microsoft Graph (graph-client.ts) when the GRAPH_* app vars are set.
 *    Preferred whenever available, because Microsoft disables IMAP basic
 *    auth on these mailboxes ("Login is disabled"), so Graph over modern
 *    OAuth is the reader that actually works. Sending still goes over SMTP
 *    (see send.ts), which keeps the branded HTML templates.
 *  - IMAP (imap-client.ts) as the fallback when only SMTP_CREDENTIALS_JSON
 *    is set and no Graph app is configured.
 * Returns [] when nothing's configured, so the poll no-ops safely.
 */

export type { InboundMessage };

export function isInboxConfigured(): boolean {
  return isMailboxCredentialsConfigured() || isGraphConfigured();
}

export async function listRecentInbox(mailbox: string, sinceIso: string | null): Promise<InboundMessage[]> {
  // Prefer Graph for reading whenever it's configured, even if
  // SMTP_CREDENTIALS_JSON is also set for sending: IMAP basic auth is
  // "Login is disabled" on these Microsoft 365 mailboxes, so Graph is the
  // reader that works. IMAP stays only as a fallback for a Graph-less setup.
  if (isGraphConfigured()) {
    return listRecentInboxViaGraph(mailbox, sinceIso);
  }
  if (isMailboxCredentialsConfigured()) {
    return listRecentInboxViaImap(mailbox, sinceIso);
  }
  return [];
}
