/**
 * End-to-end tests for server-side credit consumption.
 *
 * Verifies that consumeCreditsOrReject:
 *   - returns null when the RPC reports success
 *   - returns a 402 Response when the RPC reports insufficient credits
 *   - includes the upgrade URL + remaining balance in the rejection body
 *   - fails open on infra errors (so paying users aren't blocked)
 *   - is a no-op when amount <= 0
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "./helpers/mock-supabase";

let mock: MockSupabase;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mock,
}));

const USER = "22222222-2222-2222-2222-222222222222";

async function loadHelper() {
  vi.resetModules();
  return import("@/lib/credits.server");
}

beforeEach(() => {
  mock = createMockSupabase();
});

describe("consumeCreditsOrReject", () => {
  it("returns null when consume_credits succeeds", async () => {
    mock.__rpcHandlers.consume_credits = ({ _amount }) => ({
      ok: true,
      remaining: 100 - _amount,
      allowance: 100,
      used: _amount,
      bonus: 0,
    });
    const { consumeCreditsOrReject, COST } = await loadHelper();
    const res = await consumeCreditsOrReject(USER, COST.chat);
    expect(res).toBeNull();
  });

  it("returns a 402 Response with upgradeUrl when out of credits", async () => {
    mock.__rpcHandlers.consume_credits = () => ({
      ok: false,
      remaining: 0,
      allowance: 25,
      used: 25,
      bonus: 0,
    });
    const { consumeCreditsOrReject } = await loadHelper();
    const res = await consumeCreditsOrReject(USER, 5);
    expect(res).toBeInstanceOf(Response);
    expect(res!.status).toBe(402);
    const body = await res!.json();
    expect(body).toMatchObject({ error: "Out of credits", upgradeUrl: "/upgrade", remaining: 0 });
  });

  it("is a no-op for non-positive amounts", async () => {
    const { consumeCreditsOrReject } = await loadHelper();
    expect(await consumeCreditsOrReject(USER, 0)).toBeNull();
    expect(await consumeCreditsOrReject(USER, -3)).toBeNull();
  });

  it("fails open if the RPC returns an error (does not block paying user)", async () => {
    // No rpc handler registered → mock returns { data: null, error: ... }
    const { consumeCreditsOrReject } = await loadHelper();
    const res = await consumeCreditsOrReject(USER, 5);
    expect(res).toBeNull();
  });

  it("exposes a predictable cost table for every paid feature", async () => {
    const { COST } = await loadHelper();
    expect(COST).toMatchObject({
      chat: 1,
      image: 3,
      doc: 2,
      code: 2,
      vibe: 2,
      music: 5,
      video: 5,
      tts: 5,
      transcribe: 5,
    });
    for (const v of Object.values(COST)) expect(v).toBeGreaterThan(0);
  });
});
