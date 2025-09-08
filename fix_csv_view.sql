-- Fix CSV View Error
-- Run this in your Supabase SQL Editor

-- First, check if the tables exist
-- If they don't exist, create them first

-- Create csv_uploads table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.csv_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    total_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('uploading', 'completed', 'failed'))
);

-- Create csv_data_rows table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.csv_data_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.csv_uploads(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    csv_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_data_rows ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$ BEGIN
    CREATE POLICY "Allow all operations on csv_uploads" 
        ON public.csv_uploads FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow all operations on csv_data_rows" 
        ON public.csv_data_rows FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_upload_id ON public.csv_data_rows(upload_id);
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_jsonb ON public.csv_data_rows USING GIN (csv_data);

-- Now create the view
CREATE OR REPLACE VIEW public.csv_data_view AS
SELECT 
    c.id as upload_id,
    c.filename,
    c.uploaded_at,
    c.notes,
    c.total_rows,
    c.status as upload_status,
    r.id as row_id,
    r.row_number,
    r.csv_data,
    r.created_at
FROM public.csv_uploads c
LEFT JOIN public.csv_data_rows r ON c.id = r.upload_id
ORDER BY c.uploaded_at DESC, r.row_number ASC;

-- Test the view
SELECT 'View created successfully!' as status;
SELECT COUNT(*) as table_count FROM public.csv_uploads;
SELECT COUNT(*) as rows_count FROM public.csv_data_rows;

