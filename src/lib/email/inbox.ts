import {
  isEmailConfigured as isGraphConfigured,
  listRecentInbox as listRecentInboxViaGraph,
  type InboundMessage,
} from "./graph-client";
import { isMailboxCredentialsConfigured } from "./credentials";
import { listRecentInboxViaImap } from "./imap-client";

/**
 * The one entry point poll-inbox uses to read a venue's mailbox, picking
 * the transport by what's configured, mirroring how lifeandsoul-bookings'
 * send.ts picks SMTP vs Graph for sending:
 *  - IMAP (imap-client.ts) when SMTP_CREDENTIALS_JSON is set. Andy's real
 *    setup, the receiving counterpart to SMTP sending.
 *  - Microsoft Graph (graph-client.ts) when only the GRAPH_* app vars are
 *    set (the originally-scaffolded path).
 * Returns [] from both when nothing's configured, so the poll no-ops safely.
 */

export type { InboundMessage };

export function isInboxConfigured(): boolean {
  return isMailboxCredentialsConfigured() || isGraphConfigured();
}

export async function listRecentInbox(mailbox: string, sinceIso: string | null): Promise<InboundMessage[]> {
  if (isMailboxCredentialsConfigured()) {
    return listRecentInboxViaImap(mailbox, sinceIso);
  }
  if (isGraphConfigured()) {
    return listRecentInboxViaGraph(mailbox, sinceIso);
  }
  return [];
}
