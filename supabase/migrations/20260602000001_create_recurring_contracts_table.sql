-- Create recurring_contracts if not already created via dashboard
CREATE TABLE IF NOT EXISTS recurring_contracts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label          text,
  passenger_name text,
  departure      text        NOT NULL DEFAULT '',
  arrival        text        NOT NULL DEFAULT '',
  outbound_days  integer[]   NOT NULL DEFAULT '{}',
  outbound_time  text,
  status         text        NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Add all columns idempotently (covers tables created via dashboard with limited columns)
ALTER TABLE recurring_contracts
  ADD COLUMN IF NOT EXISTS numero           text,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS client_id        uuid,
  ADD COLUMN IF NOT EXISTS passenger_phone  text,
  ADD COLUMN IF NOT EXISTS distance_km      integer,
  ADD COLUMN IF NOT EXISTS driver_id        uuid,
  ADD COLUMN IF NOT EXISTS driver_name      text,
  ADD COLUMN IF NOT EXISTS vehicle_id       uuid,
  ADD COLUMN IF NOT EXISTS vehicle_info     text,
  ADD COLUMN IF NOT EXISTS price_per_trip   numeric(10,2),
  ADD COLUMN IF NOT EXISTS billing_mode     text         NOT NULL DEFAULT 'monthly_invoice',
  ADD COLUMN IF NOT EXISTS start_date       date,
  ADD COLUMN IF NOT EXISTS end_date         date,
  ADD COLUMN IF NOT EXISTS no_end_date      boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_type  text         NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS return_enabled   boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_time      text,
  ADD COLUMN IF NOT EXISTS return_days      integer[],
  ADD COLUMN IF NOT EXISTS return_departure text,
  ADD COLUMN IF NOT EXISTS return_arrival   text,
  ADD COLUMN IF NOT EXISTS stops            jsonb,
  ADD COLUMN IF NOT EXISTS exclude_holidays boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS country_code     text                  DEFAULT 'FR',
  ADD COLUMN IF NOT EXISTS excluded_dates   text[];

-- Séquence et fonction pour la numérotation RC
CREATE SEQUENCE IF NOT EXISTS rc_numero_seq START 1;

CREATE OR REPLACE FUNCTION generate_rc_numero()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_seq integer;
BEGIN
  SELECT nextval('rc_numero_seq') INTO v_seq;
  RETURN 'RC-' || to_char(NOW(), 'YYYY-MM') || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- RLS
ALTER TABLE recurring_contracts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recurring_contracts' AND policyname = 'Users manage own recurring contracts'
  ) THEN
    CREATE POLICY "Users manage own recurring contracts"
      ON recurring_contracts
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
