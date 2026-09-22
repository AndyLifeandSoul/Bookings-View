// MIRRORED FILE, NOT CANONICAL. The `lifeandsoul-bookings` repo owns the
// payments integration - this copy exists so bookings-view can create its
// own Dojo payment intents directly (staff-raised payment requests, see
// the booking details page) without round-tripping through the other
// app. When this changes, change it in `lifeandsoul-bookings` first
// (src/lib/payments/), then copy the result here.

/**
 * Domain-level payment types. Nothing in here knows about Dojo specifically -
 * that's deliberate, so the rest of the app (booking creation, admin
 * refunds) talks to `PaymentProvider` and never to a Dojo SDK directly. If
 * we ever needed to swap providers for one venue, only dojo-provider.ts and
 * get-provider.ts would need to change.
 */

export type PaymentCaptureMode = "AUTO" | "MANUAL";

export type ProviderPaymentStatus =
  | "CREATED"
  | "AUTHORIZED"
  | "CAPTURED"
  | "REVERSED"
  | "REFUNDED"
  | "CANCELLED"
  | "FAILED";

export interface CreatePaymentIntentParams {
  /** Integer pence/cents. Never a float. */
  amountInPence: number;
  currency: string;
  captureMode: PaymentCaptureMode;
  /**
   * Our own Booking id (or Payment row id) - round-tripped as the
   * provider's own "reference"/metadata field so a webhook can be matched
   * back to a row without an extra lookup table.
   */
  reference: string;
  description?: string;
  customerEmail?: string;
  /** Where Dojo's hosted checkout page should redirect on success/cancel. */
  returnUrl: string;
  cancelUrl: string;
}

export interface PaymentIntentResult {
  providerPaymentIntentId: string;
  status: ProviderPaymentStatus;
  /** Present for the hosted-checkout flow: redirect the customer here. */
  checkoutUrl?: string;
}

export interface RefundParams {
  /** Omit for a full refund. */
  amountInPence?: number;
  reason?: string;
}

/**
 * Everything a booking flow or admin action needs from a payment gateway.
 * Implement this once per provider (currently only Dojo), never call the
 * provider's HTTP client directly from application code.
 */
export interface PaymentProvider {
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;
  getPaymentIntent(providerPaymentIntentId: string): Promise<PaymentIntentResult>;
  /** Only meaningful for MANUAL capture mode intents. */
  captureIntent(providerPaymentIntentId: string, amountInPence?: number): Promise<PaymentIntentResult>;
  cancelIntent(providerPaymentIntentId: string): Promise<PaymentIntentResult>;
  refund(providerPaymentIntentId: string, params?: RefundParams): Promise<PaymentIntentResult>;
  /**
   * Verify an inbound webhook actually came from the provider before
   * trusting its body. Throws on failure.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): void;
}

/**
 * The Dojo payment account codes, one per venue. Each venue has its own Dojo
 * MID, so its own API key and webhook, and a PaymentAccount.code that matches
 * the DOJO_API_KEY_<code> / DOJO_WEBHOOK_SECRET_<code> env vars. See
 * get-provider.ts.
 */
export type PaymentAccountCode =
  | "DV8"
  | "BLACK_BEAR_LODGE"
  | "RUMBA_CONGLETON"
  | "RUMBA_NANTWICH"
  | "RUMBA_MACCLESFIELD"
  | "CRAZY_MOOSE_CONGLETON"
  | "CRAZY_MOOSE_NANTWICH"
  | "ARRIBA";

export const PAYMENT_ACCOUNT_CODES: PaymentAccountCode[] = [
  "DV8",
  "BLACK_BEAR_LODGE",
  "RUMBA_CONGLETON",
  "RUMBA_NANTWICH",
  "RUMBA_MACCLESFIELD",
  "CRAZY_MOOSE_CONGLETON",
  "CRAZY_MOOSE_NANTWICH",
  "ARRIBA",
];
