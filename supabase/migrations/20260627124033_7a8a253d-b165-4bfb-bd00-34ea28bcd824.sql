
CREATE OR REPLACE FUNCTION public.consume_credits(_user_id uuid, _amount integer)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.consume_credits(_user_id, _amount);
$$;

REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer) TO service_role;
