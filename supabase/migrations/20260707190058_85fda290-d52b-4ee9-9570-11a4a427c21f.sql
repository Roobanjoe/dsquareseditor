
CREATE TABLE public.member_overrides (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  overrides jsonb NOT NULL DEFAULT '{"front":{"fields":{}},"back":{"fields":{}}}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_overrides TO authenticated;
GRANT ALL ON public.member_overrides TO service_role;

ALTER TABLE public.member_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view member overrides" ON public.member_overrides FOR SELECT USING (true);
CREATE POLICY "Public can insert member overrides" ON public.member_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update member overrides" ON public.member_overrides FOR UPDATE USING (true);
CREATE POLICY "Public can delete member overrides" ON public.member_overrides FOR DELETE USING (true);

CREATE TRIGGER update_member_overrides_updated_at
BEFORE UPDATE ON public.member_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
