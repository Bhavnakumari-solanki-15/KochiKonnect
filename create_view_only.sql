-- Create CSV Data View Only
-- Run this if the tables already exist but the view is missing

-- Drop the view if it exists (to avoid conflicts)
DROP VIEW IF EXISTS public.csv_data_view;

-- Create the view
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

-- Test the view
SELECT 'View created successfully!' as status;

