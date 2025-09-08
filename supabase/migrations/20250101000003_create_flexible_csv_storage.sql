-- Create flexible CSV storage tables
-- This allows storing any CSV data structure

-- Create table to store CSV uploads
CREATE TABLE IF NOT EXISTS public.csv_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    total_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('uploading', 'completed', 'failed'))
);

-- Create table to store CSV data rows
CREATE TABLE IF NOT EXISTS public.csv_data_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.csv_uploads(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    -- Store all CSV data as JSONB for maximum flexibility
    csv_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_data_rows ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
DO $$ BEGIN
    CREATE POLICY "Allow all operations on csv_uploads" 
        ON public.csv_uploads FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow all operations on csv_data_rows" 
        ON public.csv_data_rows FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_upload_id ON public.csv_data_rows(upload_id);
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_jsonb ON public.csv_data_rows USING GIN (csv_data);

-- Create a view to easily query CSV data
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

-- Add comments
COMMENT ON TABLE public.csv_uploads IS 'Stores metadata about CSV file uploads';
COMMENT ON TABLE public.csv_data_rows IS 'Stores individual rows from CSV files as JSONB for maximum flexibility';
COMMENT ON VIEW public.csv_data_view IS 'View for easy querying of CSV data with upload metadata';

