CREATE TABLE public.id_card_settings (
  id text PRIMARY KEY,
  front_layout jsonb NOT NULL,
  back_layout jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.id_card_settings TO anon, authenticated;
GRANT ALL ON public.id_card_settings TO service_role;
ALTER TABLE public.id_card_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view layout" ON public.id_card_settings FOR SELECT USING (true);
CREATE POLICY "Public can insert layout" ON public.id_card_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update layout" ON public.id_card_settings FOR UPDATE USING (true);