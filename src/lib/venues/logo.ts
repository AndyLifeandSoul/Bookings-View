import { getCustomerAppUrl } from "@/lib/pre-order/links";

/**
 * The absolute URL of a venue's logo for use in emails: the uploaded image
 * served by the customer app when one exists (logoImageType is set),
 * otherwise the legacy logoUrl. Emails need an absolute, publicly reachable
 * URL, which is the customer app's public domain.
 */
export function resolveVenueLogoUrl(venue: {
  slug: string;
  logoImageType?: string | null;
  logoUrl?: string | null;
}): string | null {
  if (venue.logoImageType) {
    return `${getCustomerAppUrl()}/api/venue-logo/${encodeURIComponent(venue.slug)}`;
  }
  return venue.logoUrl ?? null;
}
