import { getCustomerAppUrl } from "@/lib/pre-order/links";

export type MoneyAction = "refund" | "charge_no_show" | "release_hold" | "refresh";

/**
 * Asks the customer app (the only service with the Dojo keys) to refund,
 * charge a no-show fee or release a saved card for a booking. Same shared
 * INTERNAL_API_SECRET as createPaymentIntentViaCustomerApp. Returns the
 * customer app's JSON, or an error message staff can read.
 */
export async function bookingMoneyAction(
  bookingId: string,
  body: { action: MoneyAction; actor: string; amountPence?: number; reason?: string },
): Promise<{ ok: true; refundedPence?: number; chargedPence?: number } | { error: string }> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return { error: "INTERNAL_API_SECRET isn't set, so this app can't reach the payment service." };
  try {
    const res = await fetch(`${getCustomerAppUrl()}/api/internal/bookings/${bookingId}/money`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; refundedPence?: number; chargedPence?: number };
    if (!res.ok || !json.ok) return { error: json.error ?? `Payment service returned ${res.status}.` };
    return { ok: true, refundedPence: json.refundedPence, chargedPence: json.chargedPence };
  } catch (err) {
    return { error: `Couldn't reach the payment service: ${err instanceof Error ? err.message : String(err)}` };
  }
}
