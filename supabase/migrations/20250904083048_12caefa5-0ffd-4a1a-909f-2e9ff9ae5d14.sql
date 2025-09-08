-- Create enum for job card priority
CREATE TYPE job_card_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Create enum for branding priority  
CREATE TYPE branding_priority AS ENUM ('low', 'medium', 'high');

-- Create enum for train status
CREATE TYPE train_status AS ENUM ('active', 'maintenance', 'retired');

-- Create trains table
CREATE TABLE public.trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(100),
    status train_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create fitness_certificates table
CREATE TABLE public.fitness_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) REFERENCES public.trains(train_id) ON DELETE CASCADE,
    certificate_type VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create job_cards table
CREATE TABLE public.job_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) REFERENCES public.trains(train_id) ON DELETE CASCADE,
    job_description TEXT,
    priority job_card_priority DEFAULT 'medium',
    is_open BOOLEAN DEFAULT true,
    created_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create branding_priorities table
CREATE TABLE public.branding_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) REFERENCES public.trains(train_id) ON DELETE CASCADE,
    priority branding_priority DEFAULT 'medium',
    campaign_name VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create mileage_logs table
CREATE TABLE public.mileage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) REFERENCES public.trains(train_id) ON DELETE CASCADE,
    current_mileage INTEGER,
    target_mileage INTEGER,
    needs_balancing BOOLEAN DEFAULT false,
    log_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create cleaning_slots table
CREATE TABLE public.cleaning_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) REFERENCES public.trains(train_id) ON DELETE CASCADE,
    cleaning_type VARCHAR(100),
    is_pending BOOLEAN DEFAULT false,
    scheduled_date DATE,
    completed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create stabling_positions table
CREATE TABLE public.stabling_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) REFERENCES public.trains(train_id) ON DELETE CASCADE,
    position_name VARCHAR(100),
    requires_shunting BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ranking_data JSONB,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stabling_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a prototype)
CREATE POLICY "Allow all operations on trains" ON public.trains FOR ALL USING (true);
CREATE POLICY "Allow all operations on fitness_certificates" ON public.fitness_certificates FOR ALL USING (true);
CREATE POLICY "Allow all operations on job_cards" ON public.job_cards FOR ALL USING (true);
CREATE POLICY "Allow all operations on branding_priorities" ON public.branding_priorities FOR ALL USING (true);
CREATE POLICY "Allow all operations on mileage_logs" ON public.mileage_logs FOR ALL USING (true);
CREATE POLICY "Allow all operations on cleaning_slots" ON public.cleaning_slots FOR ALL USING (true);
CREATE POLICY "Allow all operations on stabling_positions" ON public.stabling_positions FOR ALL USING (true);
CREATE POLICY "Allow all operations on audit_logs" ON public.audit_logs FOR ALL USING (true);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for trains table
CREATE TRIGGER update_trains_updated_at 
    BEFORE UPDATE ON public.trains 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();