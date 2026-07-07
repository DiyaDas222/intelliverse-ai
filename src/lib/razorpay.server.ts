import { createHmac, timingSafeEqual } from "node:crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not configured`);
  return v;
}

export function getRazorpayKeyId(): string {
  return getEnv("RAZORPAY_KEY_ID");
}

function authHeader(): string {
  const id = getEnv("RAZORPAY_KEY_ID");
  const secret = getEnv("RAZORPAY_KEY_SECRET");
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
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.description ?? "Razorpay order creation failed");
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
