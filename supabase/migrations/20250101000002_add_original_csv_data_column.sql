-- Add original_csv_data column to store complete CSV data
ALTER TABLE public.train_data 
ADD COLUMN IF NOT EXISTS original_csv_data JSONB;

-- Add comment to explain the column
COMMENT ON COLUMN public.train_data.original_csv_data IS 'Stores the complete original CSV row data as uploaded';

