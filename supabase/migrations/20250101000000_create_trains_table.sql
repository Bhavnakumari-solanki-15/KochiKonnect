-- Create trains table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(100),
    status train_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY IF NOT EXISTS "Allow all operations on trains" ON public.trains FOR ALL USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_trains_updated_at') THEN
        CREATE TRIGGER update_trains_updated_at 
            BEFORE UPDATE ON public.trains 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
