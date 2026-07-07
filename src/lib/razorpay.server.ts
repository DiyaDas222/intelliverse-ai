import { createHmac, timingSafeEqual } from "node:crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not configured`);
  return v;
}

export function getRazorpayKeyId(): string {
  const id = getEnv("RAZORPAY_KEY_ID").trim();
  if (!/^rzp_(live|test)_[A-Za-z0-9]+$/.test(id)) {
    throw new Error(
      `RAZORPAY_KEY_ID looks invalid (should start with rzp_live_ or rzp_test_). Got: ${id.slice(0, 8)}…`,
    );
  }
  return id;
}

function authHeader(): string {
  const id = getRazorpayKeyId();
  const secret = getEnv("RAZORPAY_KEY_SECRET").trim();
  if (secret.startsWith("rzp_")) {
    throw new Error(
      "RAZORPAY_KEY_SECRET looks like a Key ID (starts with rzp_). Paste the Key Secret shown next to the Key ID in Razorpay → Settings → API Keys.",
    );
  }
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export async function razorpayCreateOrder(input: {
  amount: number; // in smallest currency unit (paise for INR, cents for USD)
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string; status: string }> {
  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
      payment_capture: 1,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const desc = body?.error?.description ?? body?.error?.reason ?? `HTTP ${res.status}`;
    const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
    console.error("[razorpay] order creation failed", {
      status: res.status,
      error: body?.error,
      key_prefix: keyId.slice(0, 12),
    });
    if (res.status === 401) {
      throw new Error(
        `Razorpay authentication failed. Your RAZORPAY_KEY_ID (${keyId.slice(0, 12)}…) and RAZORPAY_KEY_SECRET don't match, or the account isn't activated for live payments yet. Double-check both values in Razorpay → Settings → API Keys.`,
      );
    }
    throw new Error(`Razorpay: ${desc}`);
  }
  return body;
}


export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = getEnv("RAZORPAY_KEY_SECRET");
  const expected = createHmac("sha256", secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(input.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = getEnv("RAZORPAY_WEBHOOK_SECRET");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
