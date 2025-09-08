-- SQL Code to Create Table for CSV Data Storage
-- This table can store any CSV data uploaded by users

-- Create the main CSV uploads table
CREATE TABLE IF NOT EXISTS public.csv_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    total_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('uploading', 'completed', 'failed'))
);

-- Create the CSV data rows table to store all CSV data
CREATE TABLE IF NOT EXISTS public.csv_data_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.csv_uploads(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    -- Store all CSV data as JSONB for maximum flexibility
    csv_data JSONB NOT NULL,
    -- Individual columns for common fields (optional, for easier querying)
    train_id TEXT GENERATED ALWAYS AS (csv_data->>'train_id') STORED,
    model TEXT GENERATED ALWAYS AS (csv_data->>'model') STORED,
    manufacturer TEXT GENERATED ALWAYS AS (csv_data->>'manufacturer') STORED,
    status TEXT GENERATED ALWAYS AS (csv_data->>'status') STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_upload_id ON public.csv_data_rows(upload_id);
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_train_id ON public.csv_data_rows(train_id);
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_model ON public.csv_data_rows(model);
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_status ON public.csv_data_rows(status);
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_created_at ON public.csv_data_rows(created_at);

-- Create GIN index for JSONB data for fast JSON queries
CREATE INDEX IF NOT EXISTS idx_csv_data_rows_jsonb ON public.csv_data_rows USING GIN (csv_data);

-- Enable Row Level Security
ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_data_rows ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for prototype)
CREATE POLICY IF NOT EXISTS "Allow all operations on csv_uploads" 
    ON public.csv_uploads FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "Allow all operations on csv_data_rows" 
    ON public.csv_data_rows FOR ALL USING (true);

-- Create a view for easy querying of CSV data
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
    r.train_id,
    r.model,
    r.manufacturer,
    r.status,
    r.created_at
FROM public.csv_uploads c
LEFT JOIN public.csv_data_rows r ON c.id = r.upload_id
ORDER BY c.uploaded_at DESC, r.row_number ASC;

-- Create a function to insert CSV data
CREATE OR REPLACE FUNCTION public.insert_csv_data(
    p_filename TEXT,
    p_notes TEXT DEFAULT NULL,
    p_csv_rows JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_upload_id UUID;
    v_row JSONB;
    v_row_number INTEGER := 1;
BEGIN
    -- Insert the upload record
    INSERT INTO public.csv_uploads (filename, notes, total_rows, status)
    VALUES (p_filename, p_notes, jsonb_array_length(p_csv_rows), 'completed')
    RETURNING id INTO v_upload_id;
    
    -- Insert each CSV row
    FOR v_row IN SELECT * FROM jsonb_array_elements(p_csv_rows)
    LOOP
        INSERT INTO public.csv_data_rows (upload_id, row_number, csv_data)
        VALUES (v_upload_id, v_row_number, v_row);
        
        v_row_number := v_row_number + 1;
    END LOOP;
    
    RETURN v_upload_id;
END;
$$;

-- Create a function to get CSV data by upload ID
CREATE OR REPLACE FUNCTION public.get_csv_data(p_upload_id UUID)
RETURNS TABLE (
    row_number INTEGER,
    csv_data JSONB,
    train_id TEXT,
    model TEXT,
    manufacturer TEXT,
    status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.row_number,
        r.csv_data,
        r.train_id,
        r.model,
        r.manufacturer,
        r.status
    FROM public.csv_data_rows r
    WHERE r.upload_id = p_upload_id
    ORDER BY r.row_number;
END;
$$;

-- Create a function to search CSV data by any field
CREATE OR REPLACE FUNCTION public.search_csv_data(
    p_search_term TEXT DEFAULT NULL,
    p_upload_id UUID DEFAULT NULL
)
RETURNS TABLE (
    upload_id UUID,
    filename TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE,
    row_number INTEGER,
    csv_data JSONB,
    train_id TEXT,
    model TEXT,
    manufacturer TEXT,
    status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as upload_id,
        c.filename,
        c.uploaded_at,
        r.row_number,
        r.csv_data,
        r.train_id,
        r.model,
        r.manufacturer,
        r.status
    FROM public.csv_uploads c
    JOIN public.csv_data_rows r ON c.id = r.upload_id
    WHERE 
        (p_upload_id IS NULL OR c.id = p_upload_id)
        AND (
            p_search_term IS NULL 
            OR r.csv_data::text ILIKE '%' || p_search_term || '%'
            OR r.train_id ILIKE '%' || p_search_term || '%'
            OR r.model ILIKE '%' || p_search_term || '%'
            OR r.manufacturer ILIKE '%' || p_search_term || '%'
            OR r.status ILIKE '%' || p_search_term || '%'
        )
    ORDER BY c.uploaded_at DESC, r.row_number ASC;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE public.csv_uploads IS 'Stores metadata about CSV file uploads';
COMMENT ON TABLE public.csv_data_rows IS 'Stores individual rows from CSV files as JSONB for maximum flexibility';
COMMENT ON VIEW public.csv_data_view IS 'View for easy querying of CSV data with upload metadata';
COMMENT ON FUNCTION public.insert_csv_data IS 'Function to insert CSV data from JSONB array';
COMMENT ON FUNCTION public.get_csv_data IS 'Function to retrieve CSV data by upload ID';
COMMENT ON FUNCTION public.search_csv_data IS 'Function to search CSV data by any field';

-- Example usage queries (commented out)
/*
-- Insert CSV data example:
SELECT public.insert_csv_data(
    'my_trains.csv',
    'Train data upload',
    '[
        {"train_id": "TR001", "model": "Siemens", "status": "active", "color": "blue"},
        {"train_id": "TR002", "model": "Alstom", "status": "maintenance", "color": "red"}
    ]'::jsonb
);

-- Get all CSV data:
SELECT * FROM public.csv_data_view;

-- Search CSV data:
SELECT * FROM public.search_csv_data('TR001');

-- Get specific upload:
SELECT * FROM public.get_csv_data('your-upload-id-here');
*/

