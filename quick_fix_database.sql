-- Quick Fix Database Setup
-- Run this in Supabase SQL Editor to fix most common issues

-- 1. Create trains table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create train_data table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.train_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id TEXT NOT NULL,
    fitness_certificate_status TEXT,
    job_card_status TEXT,
    branding_priority TEXT,
    mileage INTEGER,
    cleaning_status TEXT,
    stabling_position TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable Row Level Security
ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.train_data ENABLE ROW LEVEL SECURITY;

-- 4. Create policies (ignore errors if they already exist)
DO $$ BEGIN
    CREATE POLICY "Allow all operations on trains" 
        ON public.trains FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow all operations on train_data" 
        ON public.train_data FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_trains_train_id ON public.trains(train_id);
CREATE INDEX IF NOT EXISTS idx_train_data_train_id ON public.train_data(train_id);

-- 6. Test the setup
SELECT 'Database setup completed successfully!' as status;

-- 7. Check what we created
SELECT 
    'trains' as table_name, 
    COUNT(*) as row_count 
FROM public.trains
UNION ALL
SELECT 
    'train_data' as table_name, 
    COUNT(*) as row_count 
FROM public.train_data;

