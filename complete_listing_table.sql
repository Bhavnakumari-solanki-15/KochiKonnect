-- Create the complete listing table with all required columns
-- This table stores the final ranked train scheduling results from NSGA-II algorithm

-- First, drop the existing table if it exists
DROP TABLE IF EXISTS public.listing CASCADE;

-- Create the complete listing table with all columns
CREATE TABLE public.listing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) NOT NULL,
    pareto_rank INTEGER,
    fitness_certificate_status TEXT,
    job_card_status TEXT,
    branding_priority TEXT,
    mileage INTEGER,
    cleaning_status TEXT,
    stabling_position TEXT,
    category TEXT,
    explanation TEXT,
    alerts TEXT,
    conflicts TEXT,
    upload_batch_id UUID,
    upload_count INTEGER DEFAULT 1,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on train_id for faster queries (not unique since we allow multiple rows per train)
CREATE INDEX idx_listing_train_id ON public.listing(train_id);

-- Create indexes for better performance
CREATE INDEX idx_listing_pareto_rank ON public.listing(pareto_rank);
CREATE INDEX idx_listing_fitness ON public.listing(fitness_certificate_status);
CREATE INDEX idx_listing_job_cards ON public.listing(job_card_status);
CREATE INDEX idx_listing_branding ON public.listing(branding_priority);
CREATE INDEX idx_listing_mileage ON public.listing(mileage);
CREATE INDEX idx_listing_cleaning ON public.listing(cleaning_status);
CREATE INDEX idx_listing_stabling ON public.listing(stabling_position);
CREATE INDEX idx_listing_category ON public.listing(category);
CREATE INDEX idx_listing_upload_batch ON public.listing(upload_batch_id);
CREATE INDEX idx_listing_upload_count ON public.listing(upload_count);
CREATE INDEX idx_listing_processed_at ON public.listing(processed_at);
CREATE INDEX idx_listing_updated_at ON public.listing(updated_at);

-- Enable Row Level Security
ALTER TABLE public.listing ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (since this is a prototype)
CREATE POLICY "Allow all operations on listing" ON public.listing FOR ALL USING (true);

-- Add comments for documentation
COMMENT ON TABLE public.listing IS 'Stores the final ranked train scheduling results from NSGA-II algorithm';
COMMENT ON COLUMN public.listing.train_id IS 'Unique identifier for the train';
COMMENT ON COLUMN public.listing.pareto_rank IS 'NSGA-II Pareto rank (1 = best)';
COMMENT ON COLUMN public.listing.fitness_certificate_status IS 'Fitness certificate status of the train';
COMMENT ON COLUMN public.listing.job_card_status IS 'Current job card status';
COMMENT ON COLUMN public.listing.branding_priority IS 'Branding priority level';
COMMENT ON COLUMN public.listing.mileage IS 'Train mileage in kilometers';
COMMENT ON COLUMN public.listing.cleaning_status IS 'Current cleaning status of the train';
COMMENT ON COLUMN public.listing.stabling_position IS 'Assigned stabling position/bay';
COMMENT ON COLUMN public.listing.category IS 'Train category: Revenue Service, Cleaning/Detailing, Inspection Bay (Maintenance)';
COMMENT ON COLUMN public.listing.explanation IS 'Detailed explanation of the train status and ranking';
COMMENT ON COLUMN public.listing.alerts IS 'Alert flags for the train (JSON format)';
COMMENT ON COLUMN public.listing.conflicts IS 'Conflict messages for the train';
COMMENT ON COLUMN public.listing.upload_batch_id IS 'Unique identifier for this upload batch';
COMMENT ON COLUMN public.listing.upload_count IS 'Number of times this train has been processed';
COMMENT ON COLUMN public.listing.processed_at IS 'When this train was last processed';
COMMENT ON COLUMN public.listing.updated_at IS 'Last update timestamp';
