ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS motorisation text,
ADD COLUMN IF NOT EXISTS co2 integer,
ADD COLUMN IF NOT EXISTS cylindree integer;
