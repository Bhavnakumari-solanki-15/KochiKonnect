-- Create train_data table for Kochi Metro Train Induction Planning
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

-- Enable RLS and allow all for prototype
ALTER TABLE public.train_data ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Allow all operations on train_data" ON public.train_data FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

