import nodemailer, { type Transporter } from "nodemailer";
import { mailboxPassword } from "./credentials";

/**
 * SMTP sender for venue emails, mirroring lifeandsoul-bookings'
 * smtp-client.ts, so this app's staff replies send from the venue mailbox
 * over SMTP the same way that app's customer emails do (Andy's mailboxes
 * are Microsoft 365 with SMTP AUTH). Reads the per-mailbox password from
 * the shared credentials helper (SMTP_CREDENTIALS_JSON); host/port from
 * SMTP_HOST/SMTP_PORT, defaulting to smtp.office365.com:587 (STARTTLS).
 *
 * No-ops safely (returns ok:false, never throws) when unconfigured or a
 * mailbox has no password, so a reply is always logged even if it can't be
 * sent.
 */

export interface SmtpSendParams {
  mailbox: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SmtpSendResult {
  ok: boolean;
  error?: string;
}

const transporters = new Map<string, Transporter>();

function transporterFor(mailbox: string, password: string): Transporter {
  const cached = transporters.get(mailbox);
  if (cached) return cached;
  const host = process.env.SMTP_HOST || "smtp.office365.com";
  const port = Number(process.env.SMTP_PORT || "587");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: mailbox, pass: password },
  });
  transporters.set(mailbox, transporter);
  return transporter;
}

export async function sendMailViaSmtp(params: SmtpSendParams): Promise<SmtpSendResult> {
  const password = mailboxPassword(params.mailbox);
  if (!password) return { ok: false, error: `No SMTP password configured for mailbox "${params.mailbox}".` };

  try {
    const transporter = transporterFor(params.mailbox, password);
    await transporter.sendMail({
      from: params.mailbox,
      to: params.to,
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending email over SMTP." };
  }
}
