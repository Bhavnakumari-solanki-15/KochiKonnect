-- Add unique constraint to train_data.train_id if it doesn't exist
-- This will prevent duplicate train entries and enable proper upsert operations

-- First, remove any duplicate entries (keep the latest one)
WITH duplicates AS (
  SELECT train_id, MAX(created_at) as latest_created_at
  FROM public.train_data
  GROUP BY train_id
  HAVING COUNT(*) > 1
)
DELETE FROM public.train_data
WHERE (train_id, created_at) NOT IN (
  SELECT train_id, latest_created_at
  FROM duplicates
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    -- Check if the unique constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'train_data_train_id_key'
    ) THEN
        -- Add unique constraint
        ALTER TABLE public.train_data 
        ADD CONSTRAINT train_data_train_id_key UNIQUE (train_id);
    END IF;
END $$;

