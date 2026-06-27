# End-to-end tests: Billing & Credits

Covers the full Free → Pro/Team customer journey at the server boundary:

| File | Scope |
| --- | --- |
| `webhook.test.ts` | Stripe webhook signature verification, subscription activation (pro role + welcome credits), plan switch pro → team, cancellation, idempotent credit-pack purchase |
| `credits.test.ts` | Server-side credit metering: success path, 402 rejection with upgrade URL, fail-open on infra errors, cost-table contract |
| `entitlement.test.ts` | Pro/Team role filter that gates premium features |

Run:

```bash
bunx vitest run
```

The tests mock `@supabase/supabase-js` with an in-memory store and stub
`createStripeClient` to avoid hitting the real gateway, but keep the
real HMAC `verifyWebhook` so signature checks are genuinely exercised.
