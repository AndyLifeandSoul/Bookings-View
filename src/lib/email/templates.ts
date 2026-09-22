/**
 * Branded HTML (plus plain-text) email templates for customer-facing venue
 * emails - Andy's "per venue branded identity and logo on emails". One
 * shared shell (renderVenueEmail) that every email type fills with content,
 * so confirmation / reminder / follow-up / payment-reminder emails all look
 * like they came from the same venue.
 *
 * Deliberately email-client-safe: a single centred table, all styles
 * inline, no external CSS, web fonts or JavaScript (none of which survive
 * Outlook/Gmail reliably). The only external resource is the venue's own
 * logo image, and only when Venue.logoUrl is set - otherwise the header
 * falls back to the venue name as styled text, never a broken image.
 * Nothing here invents a logo or brand asset: branding comes entirely from
 * the venue's own stored fields.
 */

/** Neutral accent used when a venue hasn't set brandColorHex - see Venue.brandColorHex. */
export const EMAIL_DEFAULT_ACCENT = "#4f46e5";

export interface VenueBrand {
  name: string;
  logoUrl: string | null;
  brandColorHex: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailContent {
  /** The coloured heading under the venue header, e.g. "Your booking is confirmed". */
  heading: string;
  /** One or more intro paragraphs, plain strings (escaped for you). */
  intro: string[];
  /** Optional label/value rows shown as a tidy details block (booking date, party size, etc). */
  details?: { label: string; value: string }[];
  /** Optional call-to-action button. */
  button?: EmailButton;
  /** Optional closing paragraphs after the details/button. */
  outro?: string[];
}

const AMP = /&/g;
const LT = /</g;
const GT = />/g;
const QUOT = /"/g;

/** Minimal HTML escaping for any value that originates from user/customer data. */
function esc(value: string): string {
  return value.replace(AMP, "&amp;").replace(LT, "&lt;").replace(GT, "&gt;").replace(QUOT, "&quot;");
}

/** Only allow http(s) URLs through into href/src, so a stored value can never smuggle javascript: etc. */
function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function accentOf(brand: VenueBrand): string {
  const hex = brand.brandColorHex?.trim();
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : EMAIL_DEFAULT_ACCENT;
}

function headerHtml(brand: VenueBrand): string {
  const logo = brand.logoUrl ? safeUrl(brand.logoUrl) : null;
  if (logo) {
    return `<img src="${esc(logo)}" alt="${esc(brand.name)}" style="max-height:56px;max-width:260px;display:block;margin:0 auto;" />`;
  }
  return `<div style="font-size:22px;font-weight:700;color:#18181b;text-align:center;">${esc(brand.name)}</div>`;
}

function footerHtml(brand: VenueBrand): string {
  const parts = [brand.address, brand.phone, brand.email].filter((p): p is string => !!p).map((p) => esc(p));
  const contact = parts.length > 0 ? `<div style="margin-bottom:6px;">${parts.join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</div>` : "";
  return `${contact}<div>${esc(brand.name)}</div>`;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export function renderVenueEmail(brand: VenueBrand, content: EmailContent): RenderedEmail {
  const accent = accentOf(brand);

  const detailsHtml =
    content.details && content.details.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border-collapse:collapse;">${content.details
          .map(
            (d) =>
              `<tr><td style="padding:6px 0;color:#71717a;font-size:14px;">${esc(d.label)}</td><td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;text-align:right;">${esc(d.value)}</td></tr>`,
          )
          .join("")}</table>`
      : "";

  const buttonHref = content.button ? safeUrl(content.button.url) : null;
  const buttonHtml =
    content.button && buttonHref
      ? `<div style="margin:24px 0;text-align:center;"><a href="${esc(buttonHref)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;">${esc(content.button.label)}</a></div>`
      : "";

  const paragraph = (t: string) => `<p style="margin:0 0 14px;color:#3f3f46;font-size:15px;line-height:1.55;">${esc(t)}</p>`;
  const introHtml = content.intro.map(paragraph).join("");
  const outroHtml = (content.outro ?? []).map(paragraph).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f4f4f5;">
    <tr><td style="padding:28px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr><td style="padding:28px 32px 8px;">${headerHtml(brand)}</td></tr>
        <tr><td style="padding:8px 32px 4px;"><h1 style="margin:0;color:${accent};font-size:20px;font-weight:700;">${esc(content.heading)}</h1></td></tr>
        <tr><td style="padding:12px 32px 24px;">
          ${introHtml}
          ${detailsHtml}
          ${buttonHtml}
          ${outroHtml}
        </td></tr>
        <tr><td style="padding:18px 32px;background:#fafafa;border-top:1px solid #e4e4e7;color:#a1a1aa;font-size:12px;line-height:1.5;">${footerHtml(brand)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Plain-text alternative: same content, no markup.
  const textParts: string[] = [brand.name, "", content.heading, ""];
  textParts.push(...content.intro);
  if (content.details && content.details.length > 0) {
    textParts.push("");
    for (const d of content.details) textParts.push(`${d.label}: ${d.value}`);
  }
  if (content.button && buttonHref) {
    textParts.push("", `${content.button.label}: ${buttonHref}`);
  }
  if (content.outro && content.outro.length > 0) {
    textParts.push("", ...content.outro);
  }
  const footerText = [brand.address, brand.phone, brand.email].filter(Boolean).join("  ·  ");
  textParts.push("", footerText || brand.name);

  return { html, text: textParts.join("\n") };
}
