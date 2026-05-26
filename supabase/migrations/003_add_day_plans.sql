-- Create table for Day Plans
CREATE TABLE IF NOT EXISTS day_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  title TEXT NOT NULL,
  plan_date DATE NOT NULL,
  plan_time TEXT NOT NULL,
  details TEXT,
  notification_id TEXT,
  notification_early_id TEXT,
  plan_type TEXT DEFAULT 'Other'
);

-- Enable RLS
ALTER TABLE day_plans ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists and recreate
DROP POLICY IF EXISTS "Allow all" ON day_plans;

CREATE POLICY "Allow all" ON day_plans 
FOR ALL USING (true);
