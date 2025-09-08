-- Troubleshoot CSV Tables
-- Run this to see what's missing and what exists

-- Check what tables exist in public schema
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check what views exist
SELECT 
    schemaname,
    viewname,
    viewowner
FROM pg_views 
WHERE schemaname = 'public'
ORDER BY viewname;

-- Check if csv_uploads exists and its structure
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'csv_uploads')
        THEN 'csv_uploads table EXISTS'
        ELSE 'csv_uploads table MISSING'
    END as csv_uploads_status;

-- Check if csv_data_rows exists and its structure
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'csv_data_rows')
        THEN 'csv_data_rows table EXISTS'
        ELSE 'csv_data_rows table MISSING'
    END as csv_data_rows_status;

-- Check if csv_data_view exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'csv_data_view')
        THEN 'csv_data_view EXISTS'
        ELSE 'csv_data_view MISSING'
    END as csv_data_view_status;

-- If csv_uploads exists, show its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'csv_uploads'
ORDER BY ordinal_position;

-- If csv_data_rows exists, show its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'csv_data_rows'
ORDER BY ordinal_position;

