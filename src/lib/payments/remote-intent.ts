import { getCustomerAppUrl } from "@/lib/pre-order/links";
import type { PaymentAccountCode } from "./types";

export interface RemoteIntentParams {
  accountCode: PaymentAccountCode;
  amountInPence: number;
  reference: string;
  description?: string;
  customerEmail?: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface RemoteIntentResult {
  providerPaymentIntentId: string;
  checkoutUrl: string | null;
}

/**
 * Creates a Dojo payment intent by delegating to the customer app
 * (lifeandsoul-bookings) over its internal endpoint. That app is the one
 * place that holds the Dojo API keys, so this app never touches them - it
 * just asks for an intent and then writes its own Payment row against the
 * shared database. Authenticated with the shared INTERNAL_API_SECRET.
 *
 * Throws on any failure (missing secret, non-2xx, malformed response); the
 * callers turn that into a staff-facing "could not create the payment
 * request" message, exactly as they did when the Dojo call was local.
 */
export async function createPaymentIntentViaCustomerApp(params: RemoteIntentParams): Promise<RemoteIntentResult> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_API_SECRET isn't set, so payment requests can't reach the payment service.");
  }

  let res: Response;
  try {
    res = await fetch(`${getCustomerAppUrl()}/api/internal/payments/create-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ ...params, currency: "GBP", captureMode: "AUTO" }),
    });
  } catch (err) {
    throw new Error(`Couldn't reach the payment service: ${err instanceof Error ? err.message : String(err)}`);
  }

  const body = (await res.json().catch(() => ({}))) as {
    providerPaymentIntentId?: string;
    checkoutUrl?: string | null;
    error?: string;
  };
  if (!res.ok || !body.providerPaymentIntentId) {
    throw new Error(body.error ?? `Payment service returned ${res.status}.`);
  }
  return { providerPaymentIntentId: body.providerPaymentIntentId, checkoutUrl: body.checkoutUrl ?? null };
}
