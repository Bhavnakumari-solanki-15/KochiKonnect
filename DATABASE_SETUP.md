# Database Setup Instructions

## Issue
The `trains` table is missing from your Supabase database, causing the error: "Could not find the table 'public.trains' in the schema cache"

## Quick Fix (Temporary)
The application now has fallback logic to use the `train_data` table instead, so it should work immediately.

## Permanent Fix
To create the missing `trains` table, follow these steps:

### Option 1: Supabase Dashboard (Recommended)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Copy and paste this SQL:

```sql
-- Create the trains table
CREATE TABLE IF NOT EXISTS public.trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY IF NOT EXISTS "Allow all operations on trains" ON public.trains FOR ALL USING (true);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_trains_updated_at ON public.trains;
CREATE TRIGGER update_trains_updated_at 
    BEFORE UPDATE ON public.trains 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

5. Click **Run** to execute the SQL

### Option 2: Command Line (if you have Supabase CLI)
```bash
npx supabase db push
```

## After Setup
Once the `trains` table is created:
- The application will use the proper `trains` table
- Train information will be stored correctly
- CSV uploads will work as intended
- The dashboard will show proper train rankings

## Current Status
✅ Application works with fallback to `train_data` table
⏳ `trains` table needs to be created for full functionality
