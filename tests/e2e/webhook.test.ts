/**
 * End-to-end tests for the Stripe webhook handler.
 *
 * Covers the full Free → Pro/Team journey:
 *   1. Signature verification (rejects invalid/stale signatures).
 *   2. customer.subscription.created → upserts subscription row, grants
 *      the `pro` role, awards welcome bonus credits, logs an
 *      activation notification.
 *   3. customer.subscription.updated with team_monthly → swaps `pro`
 *      role for `team` and records a plan-change notification.
 *   4. customer.subscription.deleted → marks the row canceled and
 *      removes plan roles.
 *   5. checkout.session.completed (credit pack) → credits bonus
 *      balance, and is idempotent on retry.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "./helpers/mock-supabase";
import {
  buildSignedRequest,
  checkoutCompletedEvent,
  subscriptionEvent,
} from "./helpers/stripe-fixtures";

let mock: MockSupabase;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mock,
}));

vi.mock("@/lib/stripe.server", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/stripe.server")>();
  return {
    ...real,
    createStripeClient: () => ({
      checkout: {
        sessions: {
          listLineItems: async (_id: string) => ({
            data: [{ price: { lookup_key: "credits_small_onetime" } }],
          }),
        },
      },
    }),
  };
});

async function loadWebhookHandler() {
  // Import after mocks are registered.
  const mod = await import("@/routes/api/public/payments/webhook");
  return mod.Route.options.server!.handlers!.POST as (ctx: { request: Request }) => Promise<Response>;
}

const USER_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  mock = createMockSupabase({
    profiles: [{ id: USER_ID, email: "user@test.dev", display_name: "Test", bonus_credits: 0 }],
    user_roles: [],
    subscriptions: [],
    admin_notifications: [],
  });
  vi.resetModules();
});

describe("Stripe webhook — signature verification", () => {
  it("rejects requests with an invalid signature", async () => {
    const POST = await loadWebhookHandler();
    const req = new Request("https://app.test/api/public/payments/webhook?env=sandbox", {
      method: "POST",
      headers: { "stripe-signature": "t=0,v1=deadbeef", "content-type": "application/json" },
      body: JSON.stringify({ type: "noop" }),
    });
    const res = await POST({ request: req });
    expect(res.status).toBe(400);
  });

  it("ignores missing/invalid env query param without throwing", async () => {
    const POST = await loadWebhookHandler();
    const req = new Request("https://app.test/api/public/payments/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await POST({ request: req });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ignored: "invalid env" });
  });
});

describe("Free → Pro upgrade flow", () => {
  it("creates subscription row, grants pro role, awards welcome credits", async () => {
    const POST = await loadWebhookHandler();
    const res = await POST({
      request: buildSignedRequest({
        env: "sandbox",
        event: subscriptionEvent({ userId: USER_ID, priceLookupKey: "pro_monthly" }),
      }),
    });
    expect(res.status).toBe(200);

    const sub = mock.store.subscriptions[0];
    expect(sub).toMatchObject({
      user_id: USER_ID,
      status: "active",
      price_id: "pro_monthly",
      environment: "sandbox",
    });

    const roles = mock.store.user_roles.map((r) => r.role).sort();
    expect(roles).toEqual(["pro"]);

    expect(mock.store.profiles[0].bonus_credits).toBe(50);

    const activation = mock.store.admin_notifications.find(
      (n) => n.kind === "subscription_activated",
    );
    expect(activation?.payload).toMatchObject({ plan: "pro", bonus_credits_granted: 50 });
  });
});

describe("Plan switch Pro → Team", () => {
  it("swaps the pro role for team and logs a plan-change notification", async () => {
    const POST = await loadWebhookHandler();

    // First activate Pro.
    await POST({
      request: buildSignedRequest({
        env: "sandbox",
        event: subscriptionEvent({ userId: USER_ID, priceLookupKey: "pro_monthly" }),
      }),
    });
    expect(mock.store.user_roles.map((r) => r.role)).toEqual(["pro"]);

    // Now upgrade the same subscription to team_monthly.
    await POST({
      request: buildSignedRequest({
        env: "sandbox",
        event: subscriptionEvent({
          type: "customer.subscription.updated",
          userId: USER_ID,
          priceLookupKey: "team_monthly",
        }),
      }),
    });

    const roles = mock.store.user_roles.map((r) => r.role);
    expect(roles).toEqual(["team"]);

    const planChange = mock.store.admin_notifications.find(
      (n) => n.kind === "subscription_plan_changed",
    );
    expect(planChange?.payload).toMatchObject({ from: "pro_monthly", to: "team_monthly" });
  });
});

describe("Cancellation", () => {
  it("removes plan roles and marks the subscription canceled", async () => {
    const POST = await loadWebhookHandler();

    // Activate first so there's something to cancel.
    await POST({
      request: buildSignedRequest({
        env: "sandbox",
        event: subscriptionEvent({ userId: USER_ID }),
      }),
    });
    expect(mock.store.user_roles.length).toBe(1);

    await POST({
      request: buildSignedRequest({
        env: "sandbox",
        event: subscriptionEvent({
          type: "customer.subscription.deleted",
          userId: USER_ID,
          status: "canceled",
        }),
      }),
    });

    expect(mock.store.user_roles.length).toBe(0);
    expect(mock.store.subscriptions[0].status).toBe("canceled");
    const cancelNote = mock.store.admin_notifications.find(
      (n) => n.kind === "subscription_canceled",
    );
    expect(cancelNote).toBeTruthy();
  });
});

describe("Credit pack purchase (checkout.session.completed)", () => {
  it("grants pack credits and is idempotent on retry", async () => {
    const POST = await loadWebhookHandler();
    const event = checkoutCompletedEvent({ userId: USER_ID, sessionId: "cs_pack_1" });

    await POST({ request: buildSignedRequest({ env: "sandbox", event }) });
    expect(mock.store.profiles[0].bonus_credits).toBe(100);

    // Replay: should NOT double-credit.
    await POST({ request: buildSignedRequest({ env: "sandbox", event }) });
    expect(mock.store.profiles[0].bonus_credits).toBe(100);

    const credited = mock.store.admin_notifications.filter(
      (n) => n.kind === "credit_pack_purchased",
    );
    expect(credited.length).toBe(1);
  });
});
