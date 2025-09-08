-- Create Train Info Tables for CSV Storage
-- Run this in your Supabase SQL Editor

-- Step 1: Create train_info_uploads table (main table for file metadata)
CREATE TABLE public.train_info_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    total_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('uploading', 'completed', 'failed'))
);

-- Step 2: Create train_info_data table (stores CSV data rows)
CREATE TABLE public.train_info_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.train_info_uploads(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    csv_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 3: Enable Row Level Security
ALTER TABLE public.train_info_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.train_info_data ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policies for public access
DO $$ BEGIN
    CREATE POLICY "Allow all operations on train_info_uploads" 
        ON public.train_info_uploads FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow all operations on train_info_data" 
        ON public.train_info_data FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_train_info_data_upload_id ON public.train_info_data(upload_id);
CREATE INDEX IF NOT EXISTS idx_train_info_data_jsonb ON public.train_info_data USING GIN (csv_data);
CREATE INDEX IF NOT EXISTS idx_train_info_uploads_filename ON public.train_info_uploads(filename);
CREATE INDEX IF NOT EXISTS idx_train_info_uploads_uploaded_at ON public.train_info_uploads(uploaded_at);

-- Step 6: Create the main view
CREATE OR REPLACE VIEW public.train_info_view AS
SELECT 
    t.id as upload_id,
    t.filename,
    t.uploaded_at,
    t.notes,
    t.total_rows,
    t.status as upload_status,
    d.id as data_id,
    d.row_number,
    d.csv_data,
    d.created_at
FROM public.train_info_uploads t
LEFT JOIN public.train_info_data d ON t.id = d.upload_id
ORDER BY t.uploaded_at DESC, d.row_number ASC;

-- Step 7: Create a simplified view for just the data
CREATE OR REPLACE VIEW public.train_data_view AS
SELECT 
    d.id,
    d.upload_id,
    d.row_number,
    d.csv_data,
    d.created_at,
    t.filename,
    t.uploaded_at
FROM public.train_info_data d
JOIN public.train_info_uploads t ON d.upload_id = t.id
ORDER BY t.uploaded_at DESC, d.row_number ASC;

-- Step 8: Test everything
SELECT 'Train info tables created successfully!' as status;

-- Verify tables exist
SELECT 
    'train_info_uploads' as table_name, 
    COUNT(*) as row_count 
FROM public.train_info_uploads
UNION ALL
SELECT 
    'train_info_data' as table_name, 
    COUNT(*) as row_count 
FROM public.train_info_data;

-- Test the views
SELECT 'Views created successfully!' as view_status;

