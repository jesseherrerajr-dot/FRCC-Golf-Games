-- Migration 035: repair stale admin RLS helper functions.
-- During the programs -> events refactor the `program_admins` table was renamed
-- to `event_admins`, but is_program_admin() and is_program_admin_for() were left
-- pointing at the dropped table. Any RLS evaluation that reached these functions
-- (e.g. anonymous reads of `events` on the /join/[slug] page, which cascade into
-- the profiles "program admin read all" policy) threw
-- `relation "public.program_admins" does not exist`, causing the query to abort
-- and the page to 404 for every logged-out visitor. Repoint both functions at
-- event_admins.

CREATE OR REPLACE FUNCTION public.is_program_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.event_admins WHERE profile_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_program_admin_for(p_program_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.event_admins
    WHERE profile_id = auth.uid() AND event_id = p_program_id
  );
$function$;
