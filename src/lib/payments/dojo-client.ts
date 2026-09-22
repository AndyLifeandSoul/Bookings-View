// MIRRORED FILE, NOT CANONICAL. See types.ts in this same directory for the
// full mirroring note - change this in `lifeandsoul-bookings` first, then
// copy the result here.

/**
 * Thin HTTP wrapper around Dojo's Payment Intent API.
 *
 * [likely, not yet verified against a real Dojo sandbox account] Built from
 * Dojo's public docs (docs.dojo.tech) and their dojo-samples GitHub repo,
 * cross-checked across a couple of pages that didn't fully agree with each
 * other. Two things in here are best-effort and MUST be confirmed against
 * Dojo's actual API reference / Postman collection (or just a real sandbox
 * call) before this ever touches a live booking:
 *
 *   1. The manual-capture endpoint. One doc page said
 *      `POST /payment-intents/{id}/captures`, another said
 *      `POST /payment-intents/{id}/charge`. Going with `/captures` because
 *      it appeared as a direct quote rather than a summarised table, but
 *      treat this as a guess until proven against sandbox.
 *   2. The Authorization header. Multiple pages independently show
 *      `Authorization: Basic <raw secret key>` with no base64 user:pass
 *      encoding, which is unusual for "Basic" auth. Implemented literally
 *      as documented, flagged here so it isn't "fixed" back to a more
 *      standard-looking format without checking first.
 *
 * Everything else (base URL, version header, refund endpoint + body shape,
 * webhook signature header/algorithm) came from a page or sample script
 * that quoted an exact value, so confidence there is higher.
 */

const DOJO_API_BASE_URL = "https://api.dojo.tech";

// Dojo pins requests to a dated API version. Overridable via env without a
// code change if Dojo deprecates this version.
const DOJO_API_VERSION = process.env.DOJO_API_VERSION ?? "2024-02-05";

export interface DojoClientConfig {
  apiKey: string;
  /** Used only to sanity-check the key prefix matches the intended environment. */
  expectedEnv: "sandbox" | "live";
}

export class DojoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "DojoApiError";
  }
}

export interface DojoPaymentIntent {
  id: string;
  status: "Created" | "Authorized" | "Captured" | "Reversed" | "Refunded" | "Canceled";
  captureMode: "Auto" | "Manual";
  // Dojo returns amount as an { value, currencyCode } object, not a flat
  // number. Dojo does NOT return a hosted-checkout URL; the provider builds
  // it from the intent id (see dojo-provider.ts).
  amount: { value: number; currencyCode: string };
}

export class DojoClient {
  private readonly apiKey: string;

  constructor(config: DojoClientConfig) {
    const expectedPrefix = config.expectedEnv === "sandbox" ? "sk_sandbox_" : "sk_prod_";
    if (!config.apiKey.startsWith(expectedPrefix)) {
      throw new Error(
        `Dojo API key does not start with "${expectedPrefix}" but DOJO_ENV/expectedEnv is "${config.expectedEnv}". ` +
          `This is almost always a sandbox/live key mix-up - refusing to make requests rather than risk it.`,
      );
    }
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      // See file-level note above: this literal "Basic <key>" format (no
      // base64 encoding) is what Dojo's own docs and sample scripts show.
      Authorization: `Basic ${this.apiKey}`,
      version: DOJO_API_VERSION,
    };
    if (idempotencyKey) {
      headers["IdempotencyKey"] = idempotencyKey;
    }

    const res = await fetch(`${DOJO_API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      throw new DojoApiError(
        `Dojo API request failed: ${method} ${path} -> ${res.status}`,
        res.status,
        json,
      );
    }

    return json as T;
  }

  createPaymentIntent(params: {
    amount: number;
    currency: string;
    captureMode: "Auto" | "Manual";
    reference: string;
    description?: string;
    customerEmail?: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<DojoPaymentIntent> {
    // Dojo's create body: amount is an { value, currencyCode } object, and
    // the hosted-checkout redirect/cancel URLs live under `config`, not at
    // the top level. Only fields confirmed against docs.dojo.tech are sent;
    // description/customerEmail are held back until confirmed against a real
    // sandbox call, so an unknown field can't 400 the request.
    return this.request<DojoPaymentIntent>("POST", "/payment-intents", {
      amount: { value: params.amount, currencyCode: params.currency },
      captureMode: params.captureMode,
      reference: params.reference,
      config: {
        redirectUrl: params.returnUrl,
        cancelUrl: params.cancelUrl,
      },
    });
  }

  getPaymentIntent(id: string): Promise<DojoPaymentIntent> {
    return this.request<DojoPaymentIntent>("GET", `/payment-intents/${id}`);
  }

  /** Manual-capture only. See file-level note: endpoint path is unverified. */
  captureIntent(id: string, amount?: number, idempotencyKey?: string): Promise<DojoPaymentIntent> {
    return this.request<DojoPaymentIntent>(
      "POST",
      `/payment-intents/${id}/captures`,
      amount !== undefined ? { amount } : {},
      idempotencyKey,
    );
  }

  cancelIntent(id: string): Promise<DojoPaymentIntent> {
    return this.request<DojoPaymentIntent>("DELETE", `/payment-intents/${id}`);
  }

  refund(
    id: string,
    params: { amount?: number; refundReason?: string; notes?: string },
    idempotencyKey: string,
  ): Promise<{ id: string; status: string }> {
    return this.request(
      "POST",
      `/payment-intents/${id}/refunds`,
      params,
      idempotencyKey,
    );
  }
}
