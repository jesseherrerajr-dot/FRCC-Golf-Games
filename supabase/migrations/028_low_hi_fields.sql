-- Migration 028: Add Low H.I. (12-month low handicap index) fields to profiles
-- These values are synced from GHIN alongside the current handicap_index.
-- Used for Thursday League scoring (admin decided to use Low H.I. this season).

ALTER TABLE profiles
  ADD COLUMN low_hi_value numeric(4,1) DEFAULT NULL,
  ADD COLUMN low_hi_date date DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.low_hi_value IS '12-month Low Handicap Index from GHIN. NULL = never synced or no data on file.';
COMMENT ON COLUMN profiles.low_hi_date IS 'Effective date of the Low H.I. value. NULL = no Low H.I. on file.';
