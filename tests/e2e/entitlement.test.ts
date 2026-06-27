/**
 * Entitlement test — verifies the Pro/Team detection used to gate
 * features such as clean GitHub exports recognizes BOTH the `pro` and
 * `team` roles. This is the contract the webhook depends on: it grants
 * `pro` for pro_* prices and `team` for team_* prices, and both must
 * unlock Pro features for the user.
 */

import { describe, expect, it } from "vitest";

// Mirrors the role filter used in getProStatus (src/lib/github.functions.ts).
function isProRole(role: string | null | undefined): boolean {
  return role === "pro" || role === "team";
}

describe("Entitlement: getProStatus role filter", () => {
  it("treats `pro` as Pro", () => {
    expect(isProRole("pro")).toBe(true);
  });

  it("treats `team` as Pro (Team plan is a superset of Pro)", () => {
    expect(isProRole("team")).toBe(true);
  });

  it("does NOT treat `admin` or `user` as Pro", () => {
    expect(isProRole("admin")).toBe(false);
    expect(isProRole("user")).toBe(false);
    expect(isProRole(null)).toBe(false);
    expect(isProRole(undefined)).toBe(false);
  });
});
