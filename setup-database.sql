-- Run this SQL in your Supabase Dashboard > SQL Editor

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

-- Create policy for public access (since this is a prototype)
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

-- Insert some sample data
INSERT INTO public.trains (train_id, model, status) VALUES
('TR001', 'Siemens Desiro', 'active'),
('TR002', 'Alstom Coradia', 'active'),
('TR003', 'Bombardier Movia', 'maintenance')
ON CONFLICT (train_id) DO NOTHING;
