
CREATE TABLE public.bulk_pdf_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL DEFAULT 'queued',
  total integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  pdf_path text,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_pdf_jobs TO anon, authenticated;
GRANT ALL ON public.bulk_pdf_jobs TO service_role;

ALTER TABLE public.bulk_pdf_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view bulk pdf jobs" ON public.bulk_pdf_jobs
  FOR SELECT USING (true);
CREATE POLICY "Public can insert bulk pdf jobs" ON public.bulk_pdf_jobs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update bulk pdf jobs" ON public.bulk_pdf_jobs
  FOR UPDATE USING (true);

CREATE TRIGGER bulk_pdf_jobs_set_updated_at
  BEFORE UPDATE ON public.bulk_pdf_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_pdf_jobs;
ALTER TABLE public.bulk_pdf_jobs REPLICA IDENTITY FULL;
