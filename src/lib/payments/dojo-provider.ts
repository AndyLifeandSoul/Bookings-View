// MIRRORED FILE, NOT CANONICAL. See types.ts in this same directory for the
// full mirroring note - change this in `lifeandsoul-bookings` first, then
// copy the result here.

import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { DojoClient, type DojoPaymentIntent } from "./dojo-client";
import type {
  CreatePaymentIntentParams,
  PaymentIntentResult,
  PaymentProvider,
  ProviderPaymentStatus,
  RefundParams,
} from "./types";

const STATUS_MAP: Record<DojoPaymentIntent["status"], ProviderPaymentStatus> = {
  Created: "CREATED",
  Authorized: "AUTHORIZED",
  Captured: "CAPTURED",
  Reversed: "REVERSED",
  Refunded: "REFUNDED",
  Canceled: "CANCELLED",
};

function toResult(intent: DojoPaymentIntent): PaymentIntentResult {
  return {
    providerPaymentIntentId: intent.id,
    status: STATUS_MAP[intent.status] ?? "FAILED",
    checkoutUrl: intent.checkoutUrl,
  };
}

export class DojoPaymentProvider implements PaymentProvider {
  private readonly client: DojoClient;
  private readonly webhookSecret: string;

  constructor(config: { apiKey: string; webhookSecret: string; expectedEnv: "sandbox" | "live" }) {
    this.client = new DojoClient({ apiKey: config.apiKey, expectedEnv: config.expectedEnv });
    this.webhookSecret = config.webhookSecret;
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const intent = await this.client.createPaymentIntent({
      amount: params.amountInPence,
      currency: params.currency,
      captureMode: params.captureMode === "MANUAL" ? "Manual" : "Auto",
      reference: params.reference,
      description: params.description,
      customerEmail: params.customerEmail,
      returnUrl: params.returnUrl,
      cancelUrl: params.cancelUrl,
    });
    return toResult(intent);
  }

  async getPaymentIntent(providerPaymentIntentId: string): Promise<PaymentIntentResult> {
    const intent = await this.client.getPaymentIntent(providerPaymentIntentId);
    return toResult(intent);
  }

  async captureIntent(providerPaymentIntentId: string, amountInPence?: number): Promise<PaymentIntentResult> {
    const intent = await this.client.captureIntent(providerPaymentIntentId, amountInPence, randomUUID());
    return toResult(intent);
  }

  async cancelIntent(providerPaymentIntentId: string): Promise<PaymentIntentResult> {
    const intent = await this.client.cancelIntent(providerPaymentIntentId);
    return toResult(intent);
  }

  async refund(providerPaymentIntentId: string, params?: RefundParams): Promise<PaymentIntentResult> {
    await this.client.refund(
      providerPaymentIntentId,
      { amount: params?.amountInPence, refundReason: params?.reason },
      randomUUID(),
    );
    // Dojo's refund response shape wasn't confirmed to mirror the full
    // payment intent, so re-fetch the intent to get a trustworthy status
    // back rather than guessing at the refund response fields.
    const intent = await this.client.getPaymentIntent(providerPaymentIntentId);
    return toResult(intent);
  }

  /**
   * [likely, format not fully confirmed] Dojo's docs describe the
   * `Dojo-Signature` header as an HMAC-SHA256 digest of the raw body,
   * prefixed "sha256=". Implemented against that. Verify against a real
   * webhook delivery in the Dojo sandbox before relying on this in
   * production - if verification always fails once real webhooks arrive,
   * this is the first place to check.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): void {
    if (!signatureHeader) {
      throw new Error("Missing Dojo-Signature header on webhook request");
    }
    const expected = `sha256=${createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex")}`;

    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Dojo webhook signature verification failed");
    }
  }
}
