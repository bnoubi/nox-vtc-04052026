-- Add two_factor_email_enabled column to user_accounts
ALTER TABLE user_accounts
  ADD COLUMN IF NOT EXISTS two_factor_email_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Create two_factor_codes table
CREATE TABLE IF NOT EXISTS two_factor_codes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash       TEXT        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  failed_attempts INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user_id
  ON two_factor_codes(user_id);

-- Only the service role (admin client) accesses this table
ALTER TABLE two_factor_codes ENABLE ROW LEVEL SECURITY;
