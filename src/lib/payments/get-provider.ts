// MIRRORED FILE, NOT CANONICAL. See types.ts in this same directory for the
// full mirroring note - change this in `lifeandsoul-bookings` first, then
// copy the result here.

import { DojoPaymentProvider } from "./dojo-provider";
import { MockPaymentProvider } from "./mock-provider";
import type { PaymentAccountCode, PaymentProvider } from "./types";

const providerCache = new Map<string, PaymentProvider>();

/**
 * Resolves the right payment provider for a given PaymentAccount.code
 * ("DV8" or "LIFE_AND_SOUL"). This is the one place that knows the naming
 * convention for env vars - DOJO_API_KEY_<code> / DOJO_WEBHOOK_SECRET_<code>
 * - so plugging in real Dojo keys once the accounts are activated is purely
 * an env var change, no code change.
 *
 * In non-production environments, a missing key falls back to
 * MockPaymentProvider with a loud console warning, so bookings-view's
 * staff-raised payment requests can be built and demoed before Dojo online
 * checkout is live. In production, a missing key is a hard error - we never
 * want to silently fake a real venue's payment.
 */
export function getPaymentProviderForAccount(code: PaymentAccountCode): PaymentProvider {
  const cached = providerCache.get(code);
  if (cached) return cached;

  const apiKey = process.env[`DOJO_API_KEY_${code}`];
  const webhookSecret = process.env[`DOJO_WEBHOOK_SECRET_${code}`];
  const expectedEnv: "sandbox" | "live" = process.env.DOJO_ENV === "live" ? "live" : "sandbox";

  let provider: PaymentProvider;

  if (!apiKey || !webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Missing Dojo credentials for payment account "${code}". Set DOJO_API_KEY_${code} and ` +
          `DOJO_WEBHOOK_SECRET_${code} before this account can take real payments.`,
      );
    }
    console.warn(
      `[payments] No Dojo credentials set for account "${code}" (DOJO_API_KEY_${code}). ` +
        `Using MockPaymentProvider - payment requests for this account will look like they've been ` +
        `paid, but no real payment is happening. This is expected until Dojo online checkout is activated.`,
    );
    provider = new MockPaymentProvider();
  } else {
    provider = new DojoPaymentProvider({ apiKey, webhookSecret, expectedEnv });
  }

  providerCache.set(code, provider);
  return provider;
}
