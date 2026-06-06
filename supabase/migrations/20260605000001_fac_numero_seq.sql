CREATE SEQUENCE IF NOT EXISTS fac_numero_seq START 1;

CREATE OR REPLACE FUNCTION generate_fac_numero()
RETURNS text AS $$
DECLARE
  v_year text;
  v_seq  int;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_seq  := nextval('fac_numero_seq');
  RETURN 'F-' || v_year || '-' || lpad(v_seq::text, 3, '0');
END;
$$ LANGUAGE plpgsql;
