/**
 * Grouping DB Layer — Fetch inputs for the grouping engine, store outputs.
 *
 * Separated from the pure algorithm (grouping-engine.ts) to keep
 * the engine fully testable in isolation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GroupingGolfer,
  PartnerPreference,
  GroupingResult,
  TeeTimePreference,
} from "../types/events";

// ============================================================
// Fetch Inputs
// ============================================================

/**
 * Fetch confirmed golfers for a schedule with their per-week tee time preference.
 */
export async function fetchConfirmedGolfers(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<GroupingGolfer[]> {
  const { data, error } = await supabase
    .from("rsvps")
    .select("profile_id, tee_time_preference")
    .eq("schedule_id", scheduleId)
    .eq("status", "in")
    .order("responded_at", { ascending: true });

  if (error) {
    console.error("Error fetching confirmed golfers for grouping:", error);
    return [];
  }

  return (data || []).map((r: { profile_id: string; tee_time_preference: string }) => ({
    profileId: r.profile_id,
    teeTimePreference: (r.tee_time_preference || "no_preference") as TeeTimePreference,
  }));
}

/**
 * Fetch all playing partner preferences for an event.
 * The engine will filter to only confirmed golfers internally.
 */
export async function fetchPartnerPreferences(
  supabase: SupabaseClient,
  eventId: string
): Promise<PartnerPreference[]> {
  const { data, error } = await supabase
    .from("playing_partner_preferences")
    .select("profile_id, preferred_partner_id, rank")
    .eq("event_id", eventId);

  if (error) {
    console.error("Error fetching partner preferences for grouping:", error);
    return [];
  }

  return (data || []).map((p: { profile_id: string; preferred_partner_id: string; rank: number }) => ({
    profileId: p.profile_id,
    preferredPartnerId: p.preferred_partner_id,
    rank: p.rank,
  }));
}

// ============================================================
// Store Outputs
// ============================================================

/**
 * Store grouping results in the database.
 * Deletes any existing groupings for this schedule first (idempotent).
 */
export async function storeGroupings(
  supabase: SupabaseClient,
  scheduleId: string,
  result: GroupingResult
): Promise<{ success: boolean; error?: string }> {
  // Delete existing groupings for this schedule (idempotent re-runs)
  const { error: deleteError } = await supabase
    .from("groupings")
    .delete()
    .eq("schedule_id", scheduleId);

  if (deleteError) {
    console.error("Error deleting old groupings:", deleteError);
    return { success: false, error: deleteError.message };
  }

  // Build rows to insert
  const rows = result.groups.flatMap((group) =>
    group.members.map((profileId) => ({
      schedule_id: scheduleId,
      group_number: group.groupNumber,
      tee_order: group.teeOrder,
      profile_id: profileId,
      guest_request_id: null,
      harmony_score: group.harmonyScore,
    }))
  );

  if (rows.length === 0) {
    return { success: true };
  }

  const { error: insertError } = await supabase
    .from("groupings")
    .insert(rows);

  if (insertError) {
    console.error("Error inserting groupings:", insertError);
    return { success: false, error: insertError.message };
  }

  return { success: true };
}

// ============================================================
// Fetch Stored Groupings (for email templates / admin display)
// ============================================================

export interface StoredGrouping {
  groupNumber: number;
  teeOrder: number;
  harmonyScore: number | null;
  members: {
    profileId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    ghinNumber: string;
    isGuest: boolean;
  }[];
}

/**
 * Fetch stored groupings for a schedule, with profile details.
 * Returns groups sorted by tee_order, members sorted by name within each group.
 */
export async function fetchStoredGroupings(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<StoredGrouping[]> {
  const { data, error } = await supabase
    .from("groupings")
    .select(
      `
      group_number,
      tee_order,
      harmony_score,
      profile:profiles(id, first_name, last_name, phone, email, ghin_number)
    `
    )
    .eq("schedule_id", scheduleId)
    .order("tee_order", { ascending: true })
    .order("group_number", { ascending: true });

  if (error) {
    console.error("Error fetching stored groupings:", error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Group rows by group_number
  const groupMap = new Map<number, StoredGrouping>();

  for (const row of data as unknown as Array<{
    group_number: number;
    tee_order: number;
    harmony_score: number | null;
    profile: {
      id: string;
      first_name: string;
      last_name: string;
      phone: string;
      email: string;
      ghin_number: string;
    } | null;
  }>) {
    if (!groupMap.has(row.group_number)) {
      groupMap.set(row.group_number, {
        groupNumber: row.group_number,
        teeOrder: row.tee_order,
        harmonyScore: row.harmony_score,
        members: [],
      });
    }

    const group = groupMap.get(row.group_number)!;
    if (row.profile) {
      group.members.push({
        profileId: row.profile.id,
        firstName: row.profile.first_name,
        lastName: row.profile.last_name,
        phone: row.profile.phone || "",
        email: row.profile.email || "",
        ghinNumber: row.profile.ghin_number || "",
        isGuest: false,
      });
    }
  }

  // Sort members within each group by last name
  const groups = [...groupMap.values()].sort((a, b) => a.teeOrder - b.teeOrder);
  for (const g of groups) {
    g.members.sort((a, b) =>
      a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    );
  }

  return groups;
}
