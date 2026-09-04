/**
 * The customer-facing pre-order portal (/pre-order/[token]) lives in the
 * separate lifeandsoul-bookings app, not here - see PreOrderInvite's doc
 * comment in schema.prisma. Defaults to the real production domain rather
 * than being hard-required, same reasoning as sendMailAs being a no-op
 * without Graph config: a missing env var here shouldn't 500 the booking
 * details page, just point at the one domain that's ever actually hosted
 * this in practice.
 */
function getCustomerAppUrl(): string {
  return process.env.CUSTOMER_APP_URL || "https://ls-bookings.up.railway.app";
}

/** The link staff copy/paste to send a customer to their pre-order portal (manual delivery for now, see PreOrderInvite's doc comment - no automated email). */
export function buildPreOrderLink(token: string): string {
  return `${getCustomerAppUrl()}/pre-order/${token}`;
}
