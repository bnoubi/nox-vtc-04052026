ALTER TABLE recurring_contracts
ADD COLUMN IF NOT EXISTS billing_frequency
text DEFAULT 'monthly'
CHECK (billing_frequency IN (
  'monthly', 'weekly', 'manual'
));
