import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  ghin_number: string;
  is_super_admin: boolean;
  is_guest: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EventAdmin = {
  id: string;
  event_id: string;
  profile_id: string;
  role: "primary" | "secondary";
};

/**
 * Get the current authenticated user and their profile.
 * Redirects to /login if not authenticated.
 */
export async function requireAuth(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
  profile: Profile;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return { supabase, user, profile };
}

/**
 * Get the current user and verify they have admin access.
 * Super admins have access to everything.
 * Event admins have access to their assigned events.
 * Redirects to /dashboard if not an admin.
 */
export async function requireAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
  profile: Profile;
  adminEvents: EventAdmin[];
}> {
  const { supabase, user, profile } = await requireAuth();

  // Super admins have access to everything
  if (profile.is_super_admin) {
    const { data: adminEvents } = await supabase
      .from("event_admins")
      .select("*")
      .eq("profile_id", user.id);

    return { supabase, user, profile, adminEvents: adminEvents || [] };
  }

  // Check if they're a event admin
  const { data: adminEvents } = await supabase
    .from("event_admins")
    .select("*")
    .eq("profile_id", user.id);

  if (!adminEvents || adminEvents.length === 0) {
    redirect("/dashboard");
  }

  return { supabase, user, profile, adminEvents };
}

/**
 * Require super admin access. Redirects to /dashboard if not a super admin.
 * Used for event creation, admin assignments, feature flag toggles.
 */
export async function requireSuperAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
  profile: Profile;
}> {
  const { supabase, user, profile } = await requireAuth();

  if (!profile.is_super_admin) {
    redirect("/dashboard");
  }

  return { supabase, user, profile };
}

/**
 * Check if the current admin user has access to a specific event.
 * Super admins always have access. Event admins only have access to their assigned events.
 */
export function hasEventAccess(
  profile: Profile,
  adminEvents: EventAdmin[],
  eventId: string
): boolean {
  if (profile.is_super_admin) return true;
  return adminEvents.some((e) => e.event_id === eventId);
}
