CREATE TABLE public.document_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('summary','keypoints','search')),
  query text,
  result text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_analyses TO authenticated;
GRANT ALL ON public.document_analyses TO service_role;
ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY analyses_all_own ON public.document_analyses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_doc_analyses_doc ON public.document_analyses(document_id, created_at DESC);