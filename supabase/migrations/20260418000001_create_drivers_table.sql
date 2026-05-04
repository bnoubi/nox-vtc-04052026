CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    name TEXT,
    initials TEXT,
    online BOOLEAN DEFAULT false,
    carte_pro_expiration DATE,
    carte_pro_number TEXT,
    apac_expiration DATE,
    rc_pro_expiration DATE,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
