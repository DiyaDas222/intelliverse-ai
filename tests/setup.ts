// Provide env vars the server modules require at import time.
process.env.SUPABASE_URL ||= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
process.env.SUPABASE_PUBLISHABLE_KEY ||= "test-publishable-key";
process.env.LOVABLE_API_KEY ||= "test-lovable-key";
process.env.STRIPE_SANDBOX_API_KEY ||= "sk_test_sandbox";
process.env.STRIPE_LIVE_API_KEY ||= "sk_live_live";
process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET ||= "whsec_sandbox_test";
process.env.PAYMENTS_LIVE_WEBHOOK_SECRET ||= "whsec_live_test";
