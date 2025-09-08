-- Tables to store CSV upload snapshots
CREATE TABLE IF NOT EXISTS public.csv_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  filename TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.csv_upload_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES public.csv_uploads(id) ON DELETE CASCADE,
  row_index INTEGER,
  row_data JSONB
);

ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_upload_rows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all on csv_uploads" ON public.csv_uploads FOR ALL USING (true);
  CREATE POLICY "Allow all on csv_upload_rows" ON public.csv_upload_rows FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

