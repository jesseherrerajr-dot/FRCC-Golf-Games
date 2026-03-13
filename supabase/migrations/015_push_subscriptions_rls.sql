-- Migration 015: Enable RLS on push_subscriptions
-- Fixes two Supabase security linter findings:
--   - rls_disabled_in_public: table exposed via PostgREST without RLS
--   - sensitive_columns_exposed: auth_key column readable by any anon/authenticated client
--
-- After this migration:
--   - Authenticated users can only read/write their own push subscriptions
--   - Server-side code using the service_role key (createAdminClient) bypasses RLS as before
--   - Anonymous users have no access

-- 1. Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 2. Authenticated users can read their own subscriptions
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- 3. Authenticated users can insert their own subscriptions
CREATE POLICY "Users can create own push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- 4. Authenticated users can update their own subscriptions
CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- 5. Authenticated users can delete their own subscriptions (unsubscribe)
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());
