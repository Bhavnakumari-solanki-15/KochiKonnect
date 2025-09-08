-- Step-by-Step CSV Tables Setup
-- Run each section one by one in Supabase SQL Editor

-- STEP 1: Create csv_uploads table
CREATE TABLE public.csv_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    total_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed'
);

-- STEP 2: Create csv_data_rows table
CREATE TABLE public.csv_data_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.csv_uploads(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    csv_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STEP 3: Enable Row Level Security
ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_data_rows ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create policies
CREATE POLICY "Allow all operations on csv_uploads" 
    ON public.csv_uploads FOR ALL USING (true);

CREATE POLICY "Allow all operations on csv_data_rows" 
    ON public.csv_data_rows FOR ALL USING (true);

-- STEP 5: Create indexes
CREATE INDEX idx_csv_data_rows_upload_id ON public.csv_data_rows(upload_id);
CREATE INDEX idx_csv_data_rows_jsonb ON public.csv_data_rows USING GIN (csv_data);

-- STEP 6: Create the view
CREATE VIEW public.csv_data_view AS
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

-- STEP 7: Test
SELECT 'Setup complete! All tables and view created successfully.' as result;

