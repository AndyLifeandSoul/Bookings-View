import { sendMailViaSmtp } from "./smtp-client";
import { sendMailAs as sendMailViaGraph } from "./graph-client";
import { isMailboxCredentialsConfigured } from "./credentials";

/**
 * The one entry point for sending a venue email from this app (staff
 * replies), picking the transport by what's configured, mirroring
 * lifeandsoul-bookings' send.ts:
 *  - SMTP (smtp-client.ts) when SMTP_CREDENTIALS_JSON is set. Andy's real
 *    transport.
 *  - Microsoft Graph (graph-client.ts) as a fallback when only the GRAPH_*
 *    vars are set.
 *  - A safe no-op otherwise (ok:false), so a reply is still logged.
 */
export interface SendVenueMailParams {
  mailbox: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendVenueMailResult {
  ok: boolean;
  error?: string;
}

export async function sendVenueMail(params: SendVenueMailParams): Promise<SendVenueMailResult> {
  // Prefer Graph whenever the app registration is configured. Microsoft is
  // disabling basic auth on these mailboxes (IMAP already, SMTP AUTH
  // following), so Graph over modern OAuth is the transport that keeps
  // working, and it now carries the branded HTML too (see graph-client.ts).
  // SMTP stays only as a fallback for a Graph-less setup.
  if (process.env.GRAPH_TENANT_ID && process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET) {
    return sendMailViaGraph(params.mailbox, params.to, params.subject, params.text, params.html);
  }
  if (isMailboxCredentialsConfigured()) {
    return sendMailViaSmtp(params);
  }
  return { ok: false, error: "Email isn't configured yet." };
}
