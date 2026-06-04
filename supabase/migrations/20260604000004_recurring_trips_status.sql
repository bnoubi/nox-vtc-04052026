ALTER TABLE recurring_trips
DROP CONSTRAINT IF EXISTS recurring_trips_status_check;

ALTER TABLE recurring_trips
ADD CONSTRAINT recurring_trips_status_check
CHECK (status IN (
  'upcoming',
  'pending_confirmation',
  'confirmed',
  'completed',
  'cancelled',
  'missed'
));
