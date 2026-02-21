-- Make phone optional on profiles table.
-- Supports bulk import of golfers where phone numbers may not be available.
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
