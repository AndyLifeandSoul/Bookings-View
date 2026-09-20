// MIRRORED FILE, NOT CANONICAL. See types.ts in this same directory for the
// full mirroring note - change this in `lifeandsoul-bookings` first, then
// copy the result here.

import { randomUUID } from "node:crypto";
import type {
  CreatePaymentIntentParams,
  PaymentIntentResult,
  PaymentProvider,
  ProviderPaymentStatus,
} from "./types";

/**
 * In-memory stand-in for a real payment provider. Used automatically in
 * non-production environments when a real Dojo API key hasn't been set yet
 * (see get-provider.ts), so staff-raised payment requests can be built and
 * tested before Dojo online checkout is activated.
 *
 * Never used when NODE_ENV=production - get-provider.ts throws instead.
 */
export class MockPaymentProvider implements PaymentProvider {
  private readonly intents = new Map<string, ProviderPaymentStatus>();

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const id = `pi_mock_${randomUUID()}`;
    this.intents.set(id, "CREATED");
    return {
      providerPaymentIntentId: id,
      status: "CREATED",
      checkoutUrl: `${params.returnUrl}?mock_checkout=1&payment_intent=${id}`,
    };
  }

  async getPaymentIntent(providerPaymentIntentId: string): Promise<PaymentIntentResult> {
    return {
      providerPaymentIntentId,
      status: this.intents.get(providerPaymentIntentId) ?? "CREATED",
    };
  }

  async captureIntent(providerPaymentIntentId: string): Promise<PaymentIntentResult> {
    this.intents.set(providerPaymentIntentId, "CAPTURED");
    return { providerPaymentIntentId, status: "CAPTURED" };
  }

  async cancelIntent(providerPaymentIntentId: string): Promise<PaymentIntentResult> {
    this.intents.set(providerPaymentIntentId, "CANCELLED");
    return { providerPaymentIntentId, status: "CANCELLED" };
  }

  async refund(providerPaymentIntentId: string): Promise<PaymentIntentResult> {
    this.intents.set(providerPaymentIntentId, "REFUNDED");
    return { providerPaymentIntentId, status: "REFUNDED" };
  }

  verifyWebhookSignature(): void {
    // No-op: the mock provider never receives real webhooks.
  }
}
