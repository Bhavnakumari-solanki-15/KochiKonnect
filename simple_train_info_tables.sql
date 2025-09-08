-- Simple Train Info Tables
-- Run this in your Supabase SQL Editor

-- Create train_info_uploads table
CREATE TABLE public.train_info_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    total_rows INTEGER DEFAULT 0
);

-- Create train_info_data table
CREATE TABLE public.train_info_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.train_info_uploads(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    csv_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.train_info_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.train_info_data ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on train_info_uploads" 
    ON public.train_info_uploads FOR ALL USING (true);

CREATE POLICY "Allow all operations on train_info_data" 
    ON public.train_info_data FOR ALL USING (true);

-- Create indexes
CREATE INDEX idx_train_info_data_upload_id ON public.train_info_data(upload_id);
CREATE INDEX idx_train_info_data_jsonb ON public.train_info_data USING GIN (csv_data);

-- Create view
CREATE VIEW public.train_info_view AS
SELECT 
    t.id as upload_id,
    t.filename,
    t.uploaded_at,
    t.notes,
    t.total_rows,
    d.id as data_id,
    d.row_number,
    d.csv_data,
    d.created_at
FROM public.train_info_uploads t
LEFT JOIN public.train_info_data d ON t.id = d.upload_id
ORDER BY t.uploaded_at DESC, d.row_number ASC;

-- Test
SELECT 'Train info tables created successfully!' as result;

