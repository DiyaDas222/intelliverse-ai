## Goal
Close every gap I found in the audit so a real user can sign up → pick a plan → pay → use AI within their limits → cancel from the customer portal → keep access until period end.

## Changes

### 1. Make sure Stripe products + prices exist
Idempotently create the seven price points the app already references so checkout never 500s with "Price not found":
- `pro_monthly` $5 / month, `pro_yearly` $50 / year
- `team_monthly` $15 / month, `team_yearly` $150 / year
- `credits_small_onetime` $5 (100 credits), `credits_medium_onetime` $20 (500), `credits_large_onetime` $50 (1500)

All tagged with the SaaS tax code so Stripe Tax classifies them correctly.

### 2. Recognise Team users as Pro
Update `getProStatus` (and the GitHub publish flow that uses it) to treat any active paid role (`pro` OR `team`) as "Pro" for branding/feature gates. Team currently pays more and silently gets free-tier output.

### 3. Customer Portal
Wire the existing `createPortalSession` server function to a "Manage subscription" button on the Upgrade page and a new "Billing" card in Settings. Opens Stripe's hosted portal in a new tab where users can update card, download invoices, cancel, or resume.

### 4. Subscription panel in Settings
Show the current plan, next renewal date, and "Cancels on <date>" warning when `cancel_at_period_end` is true (data already in the `subscriptions` row).

### 5. Metered AI usage (free-tier monthly credit budget)
This is the largest fix.

- Migration on `profiles`: add `monthly_credits_used INT DEFAULT 0` and `credits_period_start TIMESTAMPTZ DEFAULT now()`.
- New `private.consume_credits(_user, _amount)` SECURITY DEFINER function — rolls the period over after 30 days, deducts from monthly allowance first, then `bonus_credits`, returns `false` if not enough.
- Plan allowances: Free = 25/mo, Pro = 1000/mo, Team = 5000/mo. Each cost: chat=1, image=3, doc/code-assist/vibe-generate=2, music/video/tts/transcribe=5.
- New `src/lib/credits.server.ts` helper used at the top of every authed AI endpoint (8 files). On insufficient credits → return `402` with `{ error: "Out of credits", upgradeUrl: "/upgrade" }`.
- Client (`authedFetch` callers) shows a toast that links to /upgrade when a 402 comes back.

### 6. UX polish
- Upgrade page: if the user already has any active sub, the primary CTA becomes "Manage subscription" (portal) instead of letting them buy a second one.
- `upgrade.return.tsx`: read the current plan and show the right tier name ("Welcome to Team", "100 credits added", etc.) instead of always "Welcome to Pro".

### 7. Live mode (separate, manual)
Out of scope for this turn — needs Stripe go-live which only you can complete. The code paths already branch on `getStripeEnvironment()`, so they'll work the moment go-live finishes and Lovable provisions `STRIPE_LIVE_API_KEY` + `PAYMENTS_LIVE_WEBHOOK_SECRET`.

## Technical notes
- Migration is a single transaction; the credit function lives in `private` schema (matches existing pattern from earlier security fix).
- All 8 endpoints touched: `/api/chat`, `/api/generate-image`, `/api/generate-video`, `/api/generate-music`, `/api/tts`, `/api/transcribe`, `/api/code-assist`, `/api/vibe-generate`, `/api/generate-doc` (9 actually — including doc).
- No changes to webhook signature handling, role grants, or schema-level RLS that the security scanner already cleared.

## How to test in the preview
A test-mode banner is already shown at the top of `/upgrade`.

1. **Sign up** a fresh account at `/auth` (email/password is fastest).
2. Go to `/upgrade`, pick **Pro Monthly**, click "Continue to checkout".
3. In the embedded Stripe form, pay with test card **`4242 4242 4242 4242`**, any future expiry (e.g. `12/34`), any CVC (e.g. `123`), any ZIP.
4. You'll land on `/upgrade/return`. Within a few seconds the webhook fires and you're upgraded — you'll see "Pro Verified" on the page and 50 welcome credits appear in Settings → Billing.
5. Open Settings → Billing → **Manage subscription** → it opens Stripe's hosted portal in a new tab. Click "Cancel plan" — you'll see "Cancels on <date>" back in Settings. Click Resume to undo.
6. To test a switch: from `/upgrade`, pick **Team Monthly** → "Switch to Team Monthly". Stripe charges the prorated difference instantly.
7. To test credits: buy a 100-pack with the same `4242` card. Settings → Billing now shows +100 bonus credits.
8. To test the free-tier block: sign up another account, don't pay, and spam `/chat` until you hit the 25-message ceiling — you'll get a toast "Out of credits — upgrade to continue" linking to `/upgrade`.
9. Other useful test cards: `4000 0000 0000 0002` (decline), `4000 0025 0000 3155` (requires 3-D Secure).

Going live: complete Stripe go-live from the More → Payments panel; production checkout works automatically after that with no further code changes.