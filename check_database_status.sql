-- Check Database Status
-- Run this to see what tables and views exist

-- Check if tables exist
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('csv_uploads', 'csv_data_rows')
ORDER BY tablename;

-- Check if views exist
SELECT 
    schemaname,
    viewname,
    viewowner
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname = 'csv_data_view';

-- Check table structure if csv_uploads exists
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'csv_uploads'
ORDER BY ordinal_position;

-- Check table structure if csv_data_rows exists
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'csv_data_rows'
ORDER BY ordinal_position;

-- Check if there's any data
SELECT 'csv_uploads' as table_name, COUNT(*) as row_count FROM public.csv_uploads
UNION ALL
SELECT 'csv_data_rows' as table_name, COUNT(*) as row_count FROM public.csv_data_rows;

