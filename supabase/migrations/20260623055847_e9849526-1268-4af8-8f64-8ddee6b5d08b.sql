
CREATE TABLE public.generated_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image','audio','presentation','assignment','project','document','website','app','video')),
  title text NOT NULL,
  prompt text,
  storage_path text,
  public_url text,
  mime_type text,
  size_bytes bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_assets TO authenticated;
GRANT ALL ON public.generated_assets TO service_role;
ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_all_own ON public.generated_assets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_generated_assets_user_kind ON public.generated_assets(user_id, kind, created_at DESC);

CREATE TABLE public.provider_configs (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  env_vars text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.provider_configs TO authenticated;
GRANT ALL ON public.provider_configs TO service_role;
ALTER TABLE public.provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY provider_configs_select_all ON public.provider_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY provider_configs_admin_write ON public.provider_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.provider_configs (id, name, category, env_vars, enabled, notes) VALUES
  ('lovable-ai', 'Lovable AI Gateway', 'native', ARRAY['LOVABLE_API_KEY'], true, 'Native — chat, image, TTS, embeddings. No setup required.'),
  ('openai', 'OpenAI', 'chat', ARRAY['OPENAI_API_KEY'], true, 'GPT-4o/5 family. Add key to enable.'),
  ('anthropic', 'Anthropic Claude', 'chat', ARRAY['ANTHROPIC_API_KEY'], true, 'Claude models.'),
  ('google', 'Google Gemini Direct', 'chat', ARRAY['GOOGLE_API_KEY'], true, 'Direct Gemini API (Lovable AI already covers Gemini).'),
  ('groq', 'Groq', 'chat', ARRAY['GROQ_API_KEY'], true, 'Ultra-fast inference.'),
  ('deepseek', 'DeepSeek', 'chat', ARRAY['DEEPSEEK_API_KEY'], true, 'Cost-efficient reasoning.'),
  ('mistral', 'Mistral', 'chat', ARRAY['MISTRAL_API_KEY'], true, 'Mistral / Mixtral models.'),
  ('stability', 'Stability AI', 'image', ARRAY['STABILITY_API_KEY'], true, 'SDXL image generation.'),
  ('replicate', 'Replicate', 'multi', ARRAY['REPLICATE_API_TOKEN'], true, 'Hosted models for image/video/audio.'),
  ('runway', 'Runway', 'video', ARRAY['RUNWAY_API_KEY'], true, 'Text-to-video.'),
  ('luma', 'Luma AI', 'video', ARRAY['LUMA_API_KEY'], true, 'Dream Machine video.'),
  ('pika', 'Pika', 'video', ARRAY['PIKA_API_KEY'], true, 'Pika video generation.'),
  ('suno', 'Suno', 'audio', ARRAY['SUNO_API_KEY'], true, 'Music generation.'),
  ('elevenlabs', 'ElevenLabs', 'audio', ARRAY['ELEVENLABS_API_KEY'], true, 'High-fidelity voice.');
