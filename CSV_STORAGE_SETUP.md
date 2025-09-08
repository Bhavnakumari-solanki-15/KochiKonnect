# CSV Storage Database Setup

This document provides SQL code to create tables that can store and display any CSV data uploaded by users.

## Files Included

1. **`create_csv_storage_table.sql`** - Complete solution with functions and advanced features
2. **`simple_csv_table.sql`** - Simple version for immediate use
3. **`supabase/migrations/20250101000003_create_flexible_csv_storage.sql`** - Migration file for Supabase

## Quick Setup (Recommended)

### Option 1: Use the Migration File
1. Copy the contents of `supabase/migrations/20250101000003_create_flexible_csv_storage.sql`
2. Go to your Supabase dashboard
3. Navigate to SQL Editor
4. Paste and run the SQL code

### Option 2: Use Simple Setup
1. Copy the contents of `simple_csv_table.sql`
2. Go to your Supabase dashboard
3. Navigate to SQL Editor
4. Paste and run the SQL code

## What These Tables Do

### `csv_uploads` Table
- Stores metadata about each CSV file upload
- Tracks filename, upload time, notes, and row count

### `csv_data_rows` Table
- Stores each row from CSV files as JSONB
- Flexible structure that can handle any CSV format
- Links to the upload record

### `csv_data_view` View
- Combines both tables for easy querying
- Shows all CSV data with upload metadata

## How to Use

### Insert CSV Data
```sql
-- 1. Create upload record
INSERT INTO public.csv_uploads (filename, notes, total_rows) 
VALUES ('my_trains.csv', 'Train data upload', 3);

-- 2. Insert CSV rows (replace 'your-upload-id' with actual ID)
INSERT INTO public.csv_data_rows (upload_id, row_number, csv_data) VALUES
('your-upload-id', 1, '{"train_id": "TR001", "model": "Siemens", "status": "active", "color": "blue"}'),
('your-upload-id', 2, '{"train_id": "TR002", "model": "Alstom", "status": "maintenance", "color": "red"}'),
('your-upload-id', 3, '{"train_id": "TR003", "model": "Bombardier", "status": "active", "color": "green"}');
```

### Query CSV Data
```sql
-- Get all CSV data
SELECT * FROM public.csv_data_view;

-- Get specific upload
SELECT * FROM public.csv_data_view WHERE upload_id = 'your-upload-id';

-- Search for specific values
SELECT * FROM public.csv_data_view 
WHERE csv_data->>'train_id' = 'TR001';

-- Get all unique columns from CSV data
SELECT DISTINCT jsonb_object_keys(csv_data) as column_name
FROM public.csv_data_rows;
```

### Update Your Application Code

To use these tables in your application, update your CSV upload logic:

```typescript
// 1. Create upload record
const { data: uploadData, error: uploadError } = await supabase
  .from('csv_uploads')
  .insert({
    filename: file.name,
    notes: notes || null,
    total_rows: csvData.length
  })
  .select()
  .single();

// 2. Insert CSV rows
for (let i = 0; i < csvData.length; i++) {
  const row = csvData[i];
  await supabase
    .from('csv_data_rows')
    .insert({
      upload_id: uploadData.id,
      row_number: i + 1,
      csv_data: row // Store complete row as JSONB
    });
}
```

## Benefits

1. **Flexible Structure**: Can store any CSV format without schema changes
2. **Complete Data Preservation**: All original CSV data is preserved
3. **Easy Querying**: JSONB allows powerful queries on any field
4. **Scalable**: Handles large CSV files efficiently
5. **Searchable**: Full-text search across all CSV data

## Example Queries

```sql
-- Find all trains with status 'active'
SELECT * FROM public.csv_data_view 
WHERE csv_data->>'status' = 'active';

-- Find all CSV files uploaded today
SELECT DISTINCT filename, uploaded_at 
FROM public.csv_uploads 
WHERE DATE(uploaded_at) = CURRENT_DATE;

-- Get all unique values for a specific column
SELECT DISTINCT csv_data->>'model' as model
FROM public.csv_data_rows
WHERE csv_data->>'model' IS NOT NULL;

-- Count rows by upload
SELECT filename, COUNT(*) as row_count
FROM public.csv_data_view
GROUP BY filename, upload_id;
```

## Troubleshooting

If you get permission errors:
1. Make sure RLS policies are created correctly
2. Check that your Supabase user has the right permissions
3. Verify the policies allow your operations

If you get JSONB errors:
1. Ensure your data is valid JSON
2. Check that you're using proper JSON syntax in queries
3. Use `->` for JSON object access and `->>` for text values

