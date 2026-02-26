"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Get all active members (for search dropdown)
 */
export async function getActiveMembers() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("status", "active")
    .eq("is_guest", false)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) {
    console.error("Error fetching active members:", error);
    return [];
  }

  return data || [];
}

/**
 * Get all events (for displaying preferences per event)
 */
export async function getEvents() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select("id, name, allow_playing_partner_preferences")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching events:", error);
    return [];
  }

  return data || [];
}

/**
 * Get current user's playing partner preferences for an event
 */
export async function getPlayingPartnerPreferences(eventId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("playing_partner_preferences")
    .select(
      `
      id,
      preferred_partner_id,
      profiles!playing_partner_preferences_preferred_partner_id_fkey(
        id,
        first_name,
        last_name,
        email
      )
    `
    )
    .eq("profile_id", user.id)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching preferences:", error);
    return [];
  }

  return data || [];
}

/**
 * Add a playing partner preference
 */
export async function addPlayingPartner(
  eventId: string,
  partnerId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in" };
  }

  // Check if user is trying to add themselves
  if (user.id === partnerId) {
    return { error: "You cannot add yourself as a playing partner" };
  }

  // Check current count (max 10)
  const { count } = await supabase
    .from("playing_partner_preferences")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("event_id", eventId);

  if ((count || 0) >= 10) {
    return { error: "Maximum 10 playing partners allowed per event" };
  }

  // Determine next rank (1-based, sequential)
  const { data: existingPrefs } = await supabase
    .from("playing_partner_preferences")
    .select("rank")
    .eq("profile_id", user.id)
    .eq("event_id", eventId)
    .order("rank", { ascending: false })
    .limit(1);

  const nextRank = existingPrefs && existingPrefs.length > 0 ? existingPrefs[0].rank + 1 : 1;

  // Add preference
  const { error } = await supabase.from("playing_partner_preferences").insert({
    profile_id: user.id,
    event_id: eventId,
    preferred_partner_id: partnerId,
    rank: nextRank,
  });

  if (error) {
    // Handle unique constraint violation
    if (error.code === "23505") {
      return { error: "This partner is already in your list" };
    }
    console.error("Error adding partner:", error);
    return { error: "Failed to add playing partner" };
  }

  revalidatePath("/preferences");
  return { success: true };
}

/**
 * Remove a playing partner preference
 */
export async function removePlayingPartner(
  preferenceId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in" };
  }

  const { error } = await supabase
    .from("playing_partner_preferences")
    .delete()
    .eq("id", preferenceId)
    .eq("profile_id", user.id); // Ensure user can only delete their own

  if (error) {
    console.error("Error removing partner:", error);
    return { error: "Failed to remove playing partner" };
  }

  revalidatePath("/preferences");
  return { success: true };
}

// Tee time preferences are now per-week on the RSVP page (not standing preferences)
