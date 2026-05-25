-- Add archived column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_customers_archived ON public.customers(archived);

-- Update RLS policies to ensure users can only see/update their own archived status (if applicable)
-- Since user_id is already in customers, existing policies should cover it, 
-- but we make sure the schema is updated for the client.
