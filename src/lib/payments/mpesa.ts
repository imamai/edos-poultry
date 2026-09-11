// EDOS Poultry360: M-Pesa (Safaricom Daraja) STK-push integration (spec
// §44). This is the "clean interface, documented remaining integration
// point" the spec explicitly allows for a feature that needs credentials
// this environment doesn't have (PRODUCT_SPEC.md §106): every function
// here implements the real Daraja request/response shape, but
// isMpesaConfigured() gates all of it behind env vars that are unset until
// a real Safaricom account is wired up. Nothing here fakes a successful
// payment.
//
// Required env vars (see .env.example) — none are set in this environment:
//   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY,
//   MPESA_SHORTCODE, MPESA_CALLBACK_URL, MPESA_ENV ("sandbox" | "production")

interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
  baseUrl: string;
}

function readConfig(): MpesaConfig | null {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const passkey = process.env.MPESA_PASSKEY;
  const shortcode = process.env.MPESA_SHORTCODE;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  if (!consumerKey || !consumerSecret || !passkey || !shortcode || !callbackUrl) return null;

  const env = process.env.MPESA_ENV === "production" ? "production" : "sandbox";
  const baseUrl = env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

  return { consumerKey, consumerSecret, passkey, shortcode, callbackUrl, baseUrl };
}

export function isMpesaConfigured(): boolean {
  return readConfig() !== null;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function getAccessToken(config: MpesaConfig): Promise<string> {
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const res = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error(`mpesa_auth_failed:${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export type StkPushResult =
  | { ok: true; checkoutRequestId: string; merchantRequestId: string }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "request_failed"; message: string };

export async function initiateStkPush(params: {
  phone: string; // 2547XXXXXXXX
  amountCents: number;
  accountReference: string;
  description: string;
}): Promise<StkPushResult> {
  const config = readConfig();
  if (!config) return { ok: false, reason: "not_configured" };

  try {
    const accessToken = await getAccessToken(config);
    const ts = timestamp();
    const password = Buffer.from(`${config.shortcode}${config.passkey}${ts}`).toString("base64");

    const res = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.max(1, Math.round(params.amountCents / 100)),
        PartyA: params.phone,
        PartyB: config.shortcode,
        PhoneNumber: params.phone,
        CallBackURL: config.callbackUrl,
        AccountReference: params.accountReference,
        TransactionDesc: params.description,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: "request_failed", message: text || `HTTP ${res.status}` };
    }

    const data = (await res.json()) as { CheckoutRequestID: string; MerchantRequestID: string };
    return { ok: true, checkoutRequestId: data.CheckoutRequestID, merchantRequestId: data.MerchantRequestID };
  } catch (err) {
    return { ok: false, reason: "request_failed", message: err instanceof Error ? err.message : "unknown_error" };
  }
}

/** Shape of the payload Safaricom POSTs to MPESA_CALLBACK_URL. Only the
 * fields this app actually reads are typed; Daraja sends more. */
export interface MpesaCallbackPayload {
  Body: {
    stkCallback: {
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: { Name: string; Value: string | number }[];
      };
    };
  };
}

export function parseCallback(payload: MpesaCallbackPayload) {
  const cb = payload.Body.stkCallback;
  const items = cb.CallbackMetadata?.Item ?? [];
  const find = (name: string) => items.find((i) => i.Name === name)?.Value;

  return {
    checkoutRequestId: cb.CheckoutRequestID,
    success: cb.ResultCode === 0,
    resultDesc: cb.ResultDesc,
    mpesaReceiptNumber: cb.ResultCode === 0 ? String(find("MpesaReceiptNumber") ?? "") : null,
  };
}
