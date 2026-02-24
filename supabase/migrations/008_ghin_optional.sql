-- Make ghin_number optional on profiles table.
-- Supports bulk import and registration where GHIN may not be known yet.
ALTER TABLE public.profiles ALTER COLUMN ghin_number DROP NOT NULL;
