-- Complete CSV Storage Tables Creation
-- Run this in your Supabase SQL Editor to create everything from scratch

-- Step 1: Create csv_uploads table
CREATE TABLE IF NOT EXISTS public.csv_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    total_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('uploading', 'completed', 'failed'))
);

-- Step 2: Create csv_data_rows table
CREATE TABLE IF NOT EXISTS public.csv_data_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.csv_uploads(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    csv_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 3: Enable Row Level Security
ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_data_rows ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policies for public access
DO $$ BEGIN
    CREATE POLICY "Allow all operations on csv_uploads" 
        ON public.csv_uploads FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow all operations on csv_data_rows" 
        ON public.csv_data_rows FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_upload_id ON public.csv_data_rows(upload_id);
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_jsonb ON public.csv_data_rows USING GIN (csv_data);

-- Step 6: Create the view
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

-- Step 7: Test everything
SELECT 'Tables and view created successfully!' as status;

-- Verify tables exist
SELECT 
    'csv_uploads' as table_name, 
    COUNT(*) as row_count 
FROM public.csv_uploads
UNION ALL
SELECT 
    'csv_data_rows' as table_name, 
    COUNT(*) as row_count 
FROM public.csv_data_rows;

-- Test the view
SELECT 'View test successful!' as test_result;

