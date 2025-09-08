# Troubleshooting Guide - Common CSV Upload Errors

## 🔍 Common Error Scenarios & Solutions

### 1. "Table not found" Errors

**Error**: `relation "public.trains" does not exist` or similar

**Solution**: Run the database setup first
```sql
-- Copy and paste this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on trains" 
    ON public.trains FOR ALL USING (true);
```

### 2. "Permission denied" Errors

**Error**: `permission denied for table trains`

**Solution**: Check RLS policies
```sql
-- Check if policies exist
SELECT * FROM pg_policies WHERE tablename = 'trains';

-- Create policy if missing
CREATE POLICY "Allow all operations on trains" 
    ON public.trains FOR ALL USING (true);
```

### 3. "ON CONFLICT" Errors

**Error**: `there is no unique or exclusion constraint matching the ON CONFLICT specification`

**Solution**: The code now handles this automatically, but if you still get it:
```sql
-- Add unique constraint
ALTER TABLE public.trains ADD CONSTRAINT trains_train_id_key UNIQUE (train_id);
```

### 4. "Network" or "Connection" Errors

**Error**: `Failed to fetch` or network timeout

**Solution**: 
- Check your internet connection
- Verify Supabase URL and API key in `.env` file
- Check Supabase service status

### 5. "File not selected" Errors

**Error**: `Please select a valid CSV file first`

**Solution**: 
- Make sure you've selected a CSV file
- Check that the file is actually a CSV format
- Try refreshing the page and selecting the file again

### 6. "CSV parsing" Errors

**Error**: `CSV file must have at least a header and one data row`

**Solution**: 
- Ensure your CSV has headers
- Make sure there's at least one data row
- Check for empty lines at the end of the file

## 🛠️ Quick Fix Commands

### Reset Everything
```sql
-- Drop and recreate trains table
DROP TABLE IF EXISTS public.trains CASCADE;
CREATE TABLE public.trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on trains" 
    ON public.trains FOR ALL USING (true);
```

### Check Database Status
```sql
-- Check what tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check table structure
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'trains' AND table_schema = 'public';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'trains';
```

## 🔧 Environment Setup

Make sure your `.env` file has:
```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 📞 Still Having Issues?

If you're still getting errors, please share:
1. The exact error message
2. What you were doing when it happened
3. Your CSV file format (first few rows)
4. Your database setup status

This will help me provide a more specific solution!

