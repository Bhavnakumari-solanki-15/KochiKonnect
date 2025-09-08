-- Train Info Tables Usage Examples
-- Use these queries to work with your train_info tables

-- 1. Insert a new CSV upload
INSERT INTO public.train_info_uploads (filename, notes, total_rows) 
VALUES ('my_trains.csv', 'Train data upload', 3);

-- 2. Get the upload ID (replace with actual ID from step 1)
-- SELECT id FROM public.train_info_uploads WHERE filename = 'my_trains.csv';

-- 3. Insert CSV data rows (replace 'your-upload-id' with actual ID)
INSERT INTO public.train_info_data (upload_id, row_number, csv_data) VALUES
('your-upload-id', 1, '{"train_id": "TR001", "model": "Siemens", "status": "active", "color": "blue"}'),
('your-upload-id', 2, '{"train_id": "TR002", "model": "Alstom", "status": "maintenance", "color": "red"}'),
('your-upload-id', 3, '{"train_id": "TR003", "model": "Bombardier", "status": "active", "color": "green"}');

-- 4. Query all train info data
SELECT * FROM public.train_info_view;

-- 5. Get specific upload data
SELECT * FROM public.train_info_view WHERE upload_id = 'your-upload-id';

-- 6. Search for specific train
SELECT * FROM public.train_info_view 
WHERE csv_data->>'train_id' = 'TR001';

-- 7. Get all unique columns from CSV data
SELECT DISTINCT jsonb_object_keys(csv_data) as column_name
FROM public.train_info_data;

-- 8. Count rows by upload
SELECT 
    filename, 
    COUNT(*) as row_count,
    uploaded_at
FROM public.train_info_view
GROUP BY filename, upload_id, uploaded_at
ORDER BY uploaded_at DESC;

-- 9. Find all active trains
SELECT 
    filename,
    row_number,
    csv_data->>'train_id' as train_id,
    csv_data->>'model' as model,
    csv_data->>'status' as status
FROM public.train_info_view 
WHERE csv_data->>'status' = 'active';

-- 10. Get all unique models
SELECT DISTINCT csv_data->>'model' as model
FROM public.train_info_data
WHERE csv_data->>'model' IS NOT NULL
ORDER BY model;

