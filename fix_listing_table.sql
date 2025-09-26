-- Fix the listing table to remove score column constraint
-- This resolves the "null value in column score violates not-null constraint" error

-- First, drop the existing table if it exists (since we need to recreate it)
DROP TABLE IF EXISTS public.listing CASCADE;

-- Recreate the listing table without the score column
CREATE TABLE public.listing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) NOT NULL,
    pareto_rank INTEGER,
    mileage INTEGER,
    cleaning_status TEXT,
    stabling_position TEXT,
    category TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint on train_id to prevent duplicates
CREATE UNIQUE INDEX idx_listing_train_id ON public.listing(train_id);

-- Create indexes for better performance
CREATE INDEX idx_listing_pareto_rank ON public.listing(pareto_rank);
CREATE INDEX idx_listing_category ON public.listing(category);
CREATE INDEX idx_listing_updated_at ON public.listing(updated_at);

-- Enable Row Level Security
ALTER TABLE public.listing ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (since this is a prototype)
CREATE POLICY "Allow all operations on listing" ON public.listing FOR ALL USING (true);

-- Add comments for documentation
COMMENT ON TABLE public.listing IS 'Stores the final ranked train scheduling results from NSGA-II algorithm';
COMMENT ON COLUMN public.listing.train_id IS 'Unique identifier for the train';
COMMENT ON COLUMN public.listing.pareto_rank IS 'NSGA-II Pareto rank (1 = best)';
COMMENT ON COLUMN public.listing.mileage IS 'Train mileage in kilometers';
COMMENT ON COLUMN public.listing.cleaning_status IS 'Current cleaning status of the train';
COMMENT ON COLUMN public.listing.stabling_position IS 'Assigned stabling position/bay';
COMMENT ON COLUMN public.listing.category IS 'Train category: Revenue Service, Cleaning/Detailing, Inspection Bay (Maintenance)';
