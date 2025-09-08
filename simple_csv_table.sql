-- Simple SQL to Create CSV Storage Table
-- Run this in your Supabase SQL Editor

-- Create table to store CSV uploads
CREATE TABLE IF NOT EXISTS public.csv_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    total_rows INTEGER DEFAULT 0
);

-- Create table to store CSV data rows
CREATE TABLE IF NOT EXISTS public.csv_data_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.csv_uploads(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    -- Store all CSV data as JSONB (flexible for any CSV structure)
    csv_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_data_rows ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY IF NOT EXISTS "Allow all operations on csv_uploads" 
    ON public.csv_uploads FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "Allow all operations on csv_data_rows" 
    ON public.csv_data_rows FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_upload_id ON public.csv_data_rows(upload_id);
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_jsonb ON public.csv_data_rows USING GIN (csv_data);

-- Create a simple view to see all CSV data
CREATE OR REPLACE VIEW public.csv_data_view AS
SELECT 
    c.id as upload_id,
    c.filename,
    c.uploaded_at,
    c.notes,
    c.total_rows,
    r.id as row_id,
    r.row_number,
    r.csv_data,
    r.created_at
FROM public.csv_uploads c
LEFT JOIN public.csv_data_rows r ON c.id = r.upload_id
ORDER BY c.uploaded_at DESC, r.row_number ASC;

-- Example: How to insert CSV data
/*
INSERT INTO public.csv_uploads (filename, notes, total_rows) 
VALUES ('my_trains.csv', 'Train data', 2);

INSERT INTO public.csv_data_rows (upload_id, row_number, csv_data) VALUES
('your-upload-id', 1, '{"train_id": "TR001", "model": "Siemens", "status": "active", "color": "blue"}'),
('your-upload-id', 2, '{"train_id": "TR002", "model": "Alstom", "status": "maintenance", "color": "red"}');
*/

-- Example: How to query CSV data
/*
-- Get all data
SELECT * FROM public.csv_data_view;

-- Get specific upload
SELECT * FROM public.csv_data_view WHERE upload_id = 'your-upload-id';

-- Search in JSON data
SELECT * FROM public.csv_data_view 
WHERE csv_data->>'train_id' = 'TR001';

-- Get all unique columns from CSV data
SELECT DISTINCT jsonb_object_keys(csv_data) as column_name
FROM public.csv_data_rows;
*/

