/**
 * Microsoft Graph client for the venue-mailbox email flow Andy described:
 * each venue's confirmation emails send from (and replies land in) that
 * venue's real Microsoft 365 mailbox — see Venue.email in schema.prisma.
 *
 * App-only (client-credentials) auth against ONE Azure AD app registration
 * shared by every venue, using application permissions (Mail.Send,
 * Mail.Read, admin-consented) rather than a per-venue OAuth flow — Graph
 * lets an app-permission call act "as" any mailbox in the tenant by
 * addressing /users/{mailbox}, so one client id/secret covers all 8 venues.
 * This is deliberately NOT IMAP/SMTP: Microsoft has been disabling basic
 * auth for Exchange Online, so Graph with modern (OAuth2) auth is the
 * approach that keeps working.
 *
 * Everything here no-ops safely (returns a clear "not configured" result,
 * never throws) when GRAPH_TENANT_ID/GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET
 * aren't set — same pattern as this codebase's Dojo payment provider
 * abstraction before real credentials existed. Setup steps for Andy: see
 * docs/email-setup.md.
 */

interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

function getConfig(): GraphConfig | null {
  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret };
}

export function isEmailConfigured(): boolean {
  return getConfig() !== null;
}

// Module-scope cache — fine for a single Node process; a fresh deploy just
// re-fetches once. Tokens are ~1hr, refreshed a minute early.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: GraphConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Graph token request failed: ${res.status} ${await res.text()}`);

  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.token;
}

export interface SendMailResult {
  ok: boolean;
  error?: string;
}

/** Sends as `mailbox` (a venue's real M365 address, e.g. "bookings@dv8venue.co.uk") via Graph's application-permission sendMail. Never throws — booking creation/replying must not fail just because email is unreachable. */
export async function sendMailAs(mailbox: string, to: string, subject: string, bodyText: string): Promise<SendMailResult> {
  const config = getConfig();
  if (!config) return { ok: false, error: "Email isn't configured yet." };

  try {
    const token = await getAccessToken(config);
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "Text", content: bodyText },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    });
    if (!res.ok) return { ok: false, error: `Graph sendMail failed: ${res.status} ${await res.text()}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending email." };
  }
}

export interface InboundMessage {
  graphId: string;
  from: string;
  subject: string;
  bodyText: string;
  receivedDateTime: string;
}

/** Messages received after `sinceIso` (exclusive) in `mailbox`'s inbox, oldest first — used by the poll-inbox route. Returns [] rather than throwing when email isn't configured. */
export async function listRecentInbox(mailbox: string, sinceIso: string | null): Promise<InboundMessage[]> {
  const config = getConfig();
  if (!config) return [];

  const token = await getAccessToken(config);
  const filter = sinceIso ? `&$filter=${encodeURIComponent(`receivedDateTime gt ${sinceIso}`)}` : "";
  const url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages` +
    `?$top=50&$orderby=receivedDateTime asc&$select=id,from,subject,body,receivedDateTime${filter}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph list inbox failed for ${mailbox}: ${res.status} ${await res.text()}`);

  const body = (await res.json()) as {
    value: { id: string; from?: { emailAddress?: { address?: string } }; subject?: string; body?: { content?: string }; receivedDateTime: string }[];
  };

  return body.value.map((m) => ({
    graphId: m.id,
    from: m.from?.emailAddress?.address ?? "",
    subject: m.subject ?? "",
    bodyText: stripHtml(m.body?.content ?? ""),
    receivedDateTime: m.receivedDateTime,
  }));
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
