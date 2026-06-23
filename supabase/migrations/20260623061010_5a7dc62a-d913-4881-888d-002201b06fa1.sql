CREATE TABLE public.asset_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  asset_id UUID NOT NULL REFERENCES public.generated_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_views INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  allow_download BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX asset_shares_token_idx ON public.asset_shares(token);
CREATE INDEX asset_shares_user_idx ON public.asset_shares(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_shares TO authenticated;
GRANT SELECT ON public.asset_shares TO anon;
GRANT ALL ON public.asset_shares TO service_role;

ALTER TABLE public.asset_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their share links"
ON public.asset_shares FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read non-expired share links by token"
ON public.asset_shares FOR SELECT
TO anon, authenticated
USING (expires_at > now());