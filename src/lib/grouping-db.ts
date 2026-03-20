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
  TeeTimeHistoryEntry,
} from "../types/events";
import { pairKey } from "./grouping-engine";
import { formatInitialLastName } from "./format";

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

/**
 * Fetch approved guests for a schedule, with their host's profile_id.
 */
export async function fetchApprovedGuests(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<Array<{
  guestRequestId: string;
  hostProfileId: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  guestGhinNumber: string;
}>> {
  const { data, error } = await supabase
    .from("guest_requests")
    .select("id, requested_by, guest_first_name, guest_last_name, guest_email, guest_phone, guest_ghin_number")
    .eq("schedule_id", scheduleId)
    .eq("status", "approved");

  if (error) {
    console.error("Error fetching approved guests for grouping:", error);
    return [];
  }

  return (data || []).map((g: {
    id: string;
    requested_by: string;
    guest_first_name: string;
    guest_last_name: string;
    guest_email: string;
    guest_phone: string;
    guest_ghin_number: string;
  }) => ({
    guestRequestId: g.id,
    hostProfileId: g.requested_by,
    guestFirstName: g.guest_first_name,
    guestLastName: g.guest_last_name,
    guestEmail: g.guest_email || "",
    guestPhone: g.guest_phone || "",
    guestGhinNumber: g.guest_ghin_number || "",
  }));
}

// ============================================================
// Fetch Historical Data (for grouping option modifiers)
// ============================================================

/**
 * Fetch tee time preference history for all golfers in an event over the last N weeks.
 * Returns a map of profileId → { earlyCount, lateCount, totalWeeks }.
 *
 * Used by the engine to calculate tee time priority scores
 * (infrequent requesters get priority over habitual ones).
 */
export async function fetchTeeTimeHistory(
  supabase: SupabaseClient,
  eventId: string,
  lookbackWeeks: number = 8
): Promise<Map<string, TeeTimeHistoryEntry>> {
  const result = new Map<string, TeeTimeHistoryEntry>();

  // Get the last N scheduled game dates for this event (excluding cancelled)
  const { data: schedules, error: schedError } = await supabase
    .from("event_schedules")
    .select("id, game_date")
    .eq("event_id", eventId)
    .eq("status", "scheduled")
    .order("game_date", { ascending: false })
    .limit(lookbackWeeks);

  if (schedError || !schedules || schedules.length === 0) {
    if (schedError) console.error("Error fetching schedule history for tee time:", schedError);
    return result;
  }

  const scheduleIds = schedules.map((s: { id: string }) => s.id);

  // Fetch all RSVPs for those schedules (only confirmed "in" golfers)
  const { data: rsvps, error: rsvpError } = await supabase
    .from("rsvps")
    .select("profile_id, tee_time_preference, schedule_id")
    .in("schedule_id", scheduleIds)
    .eq("status", "in");

  if (rsvpError || !rsvps) {
    if (rsvpError) console.error("Error fetching RSVP history for tee time:", rsvpError);
    return result;
  }

  // Track which schedules each golfer participated in (to count totalWeeks correctly)
  const golferSchedules = new Map<string, Set<string>>();

  for (const rsvp of rsvps as Array<{ profile_id: string; tee_time_preference: string; schedule_id: string }>) {
    const pid = rsvp.profile_id;
    if (!result.has(pid)) {
      result.set(pid, { earlyCount: 0, lateCount: 0, totalWeeks: 0 });
      golferSchedules.set(pid, new Set());
    }

    const entry = result.get(pid)!;
    const schedSet = golferSchedules.get(pid)!;

    // Only count each schedule once per golfer
    if (!schedSet.has(rsvp.schedule_id)) {
      schedSet.add(rsvp.schedule_id);
      entry.totalWeeks++;
    }

    const pref = rsvp.tee_time_preference || "no_preference";
    if (pref === "early") entry.earlyCount++;
    else if (pref === "late") entry.lateCount++;
  }

  return result;
}

/**
 * Fetch recent pairing history for all golfers in an event over the last N weeks.
 * Returns a map of pairKey → [weeksAgo values].
 *
 * Example: if golfers A and B were in the same group 1 week ago and 3 weeks ago,
 * the map entry would be: "A:B" → [1, 3]
 *
 * Used by the engine to apply variety penalties (more recent = heavier penalty).
 */
export async function fetchRecentPairings(
  supabase: SupabaseClient,
  eventId: string,
  lookbackWeeks: number = 8
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();

  // Get the last N scheduled game dates (excluding cancelled), ordered newest first
  const { data: schedules, error: schedError } = await supabase
    .from("event_schedules")
    .select("id, game_date")
    .eq("event_id", eventId)
    .eq("status", "scheduled")
    .order("game_date", { ascending: false })
    .limit(lookbackWeeks);

  if (schedError || !schedules || schedules.length === 0) {
    if (schedError) console.error("Error fetching schedule history for pairings:", schedError);
    return result;
  }

  // For each past schedule, fetch groupings and build pair co-occurrences
  for (let weekIdx = 0; weekIdx < schedules.length; weekIdx++) {
    const schedule = schedules[weekIdx] as { id: string; game_date: string };
    const weeksAgo = weekIdx + 1; // 1-based: most recent = 1

    const { data: groupings, error: groupError } = await supabase
      .from("groupings")
      .select("group_number, profile_id")
      .eq("schedule_id", schedule.id)
      .not("profile_id", "is", null);

    if (groupError || !groupings) {
      if (groupError) console.error(`Error fetching groupings for schedule ${schedule.id}:`, groupError);
      continue;
    }

    // Group profile_ids by group_number
    const groupMap = new Map<number, string[]>();
    for (const row of groupings as Array<{ group_number: number; profile_id: string }>) {
      if (!groupMap.has(row.group_number)) groupMap.set(row.group_number, []);
      groupMap.get(row.group_number)!.push(row.profile_id);
    }

    // For each group, record all pairs with their weeksAgo value
    for (const [, members] of groupMap) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = pairKey(members[i], members[j]);
          if (!result.has(key)) result.set(key, []);
          result.get(key)!.push(weeksAgo);
        }
      }
    }
  }

  return result;
}

// ============================================================
// Store Outputs
// ============================================================

/**
 * Store grouping results in the database, including approved guests.
 * Each guest is placed in the same group as their host golfer.
 * Deletes any existing groupings for this schedule first (idempotent).
 */
export async function storeGroupings(
  supabase: SupabaseClient,
  scheduleId: string,
  result: GroupingResult,
  guests: Array<{ guestRequestId: string; hostProfileId: string }> = []
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

  // Build a lookup: profileId → groupNumber/teeOrder
  const golferGroupMap = new Map<string, { groupNumber: number; teeOrder: number; harmonyScore: number }>();
  for (const group of result.groups) {
    for (const profileId of group.golfers) {
      golferGroupMap.set(profileId, {
        groupNumber: group.groupNumber,
        teeOrder: group.teeOrder,
        harmonyScore: group.harmonyScore,
      });
    }
  }

  // Build golfer rows
  const rows: Array<{
    schedule_id: string;
    group_number: number;
    tee_order: number;
    profile_id: string | null;
    guest_request_id: string | null;
    harmony_score: number;
  }> = result.groups.flatMap((group) =>
    group.golfers.map((profileId) => ({
      schedule_id: scheduleId,
      group_number: group.groupNumber,
      tee_order: group.teeOrder,
      profile_id: profileId,
      guest_request_id: null,
      harmony_score: group.harmonyScore,
    }))
  );

  // Build guest rows — place each guest in their host's group
  for (const guest of guests) {
    const hostGroup = golferGroupMap.get(guest.hostProfileId);
    if (hostGroup) {
      rows.push({
        schedule_id: scheduleId,
        group_number: hostGroup.groupNumber,
        tee_order: hostGroup.teeOrder,
        profile_id: null,
        guest_request_id: guest.guestRequestId,
        harmony_score: hostGroup.harmonyScore,
      });
    } else {
      console.warn(`Guest ${guest.guestRequestId} host ${guest.hostProfileId} not found in any group`);
    }
  }

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

export interface StoredGroupGolfer {
  profileId: string | null;
  guestRequestId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  ghinNumber: string;
  handicapIndex: number | null;
  isGuest: boolean;
  hostName: string | null; // "J. Herrera" format for guests
  hostProfileId: string | null;
  // Preference annotations (for admin/pro shop visibility)
  teeTimePreference: 'early' | 'late' | null; // null = no preference
  preferredPartnersInGroup: string[]; // Names of preferred partners in same group ("J. Herrera" format)
}

export interface StoredGrouping {
  groupNumber: number;
  teeOrder: number;
  harmonyScore: number | null;
  golfers: StoredGroupGolfer[];
}

/**
 * Fetch stored groupings for a schedule, with profile and guest details.
 * Returns groups sorted by tee_order. Within each group, golfers are sorted
 * alphabetically but guests are placed immediately after their host.
 */
export async function fetchStoredGroupings(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<StoredGrouping[]> {
  // Fetch golfer groupings
  const { data: golferData, error: golferError } = await supabase
    .from("groupings")
    .select(
      `
      group_number,
      tee_order,
      harmony_score,
      profile_id,
      guest_request_id,
      profile:profiles(id, first_name, last_name, phone, email, ghin_number, handicap_index)
    `
    )
    .eq("schedule_id", scheduleId)
    .not("profile_id", "is", null)
    .order("tee_order", { ascending: true })
    .order("group_number", { ascending: true });

  if (golferError) {
    console.error("Error fetching golfer groupings:", golferError);
    return [];
  }

  // Fetch guest groupings
  const { data: guestData, error: guestError } = await supabase
    .from("groupings")
    .select(
      `
      group_number,
      tee_order,
      harmony_score,
      guest_request_id,
      guest:guest_requests(id, requested_by, guest_first_name, guest_last_name, guest_email, guest_phone, guest_ghin_number)
    `
    )
    .eq("schedule_id", scheduleId)
    .not("guest_request_id", "is", null)
    .order("group_number", { ascending: true });

  if (guestError) {
    console.error("Error fetching guest groupings:", guestError);
    // Continue without guests — don't fail the whole thing
  }

  if ((!golferData || golferData.length === 0) && (!guestData || guestData.length === 0)) {
    return [];
  }

  // Collect all profile IDs for batch lookups
  const allProfileIds: string[] = [];
  for (const row of (golferData || []) as unknown as Array<{ profile_id: string }>) {
    if (row.profile_id) allProfileIds.push(row.profile_id);
  }

  // Fetch tee time preferences for this schedule's RSVPs
  const teeTimeMap = new Map<string, 'early' | 'late' | null>();
  if (allProfileIds.length > 0) {
    const { data: rsvpData } = await supabase
      .from("rsvps")
      .select("profile_id, tee_time_preference")
      .eq("schedule_id", scheduleId)
      .in("profile_id", allProfileIds);

    for (const r of (rsvpData || []) as Array<{ profile_id: string; tee_time_preference: string }>) {
      const pref = r.tee_time_preference;
      teeTimeMap.set(r.profile_id, pref === 'early' || pref === 'late' ? pref : null);
    }
  }

  // Fetch partner preferences for golfers in this schedule's event
  // We need the event_id — get it from the schedule
  const { data: scheduleRow } = await supabase
    .from("event_schedules")
    .select("event_id")
    .eq("id", scheduleId)
    .single();

  // Build a map: profileId → Set of preferredPartnerIds (who are also in this grouping)
  const partnerPrefsMap = new Map<string, Set<string>>();
  if (scheduleRow?.event_id && allProfileIds.length > 0) {
    const { data: prefData } = await supabase
      .from("playing_partner_preferences")
      .select("profile_id, preferred_partner_id")
      .eq("event_id", scheduleRow.event_id)
      .in("profile_id", allProfileIds);

    const confirmedSet = new Set(allProfileIds);
    for (const p of (prefData || []) as Array<{ profile_id: string; preferred_partner_id: string }>) {
      // Only include if the preferred partner is also confirmed this week
      if (confirmedSet.has(p.preferred_partner_id)) {
        if (!partnerPrefsMap.has(p.profile_id)) {
          partnerPrefsMap.set(p.profile_id, new Set());
        }
        partnerPrefsMap.get(p.profile_id)!.add(p.preferred_partner_id);
      }
    }
  }

  // Build a profileId → "F. Last" name map for display
  const profileNameMap = new Map<string, string>();
  for (const row of (golferData || []) as unknown as Array<{
    profile: { id: string; first_name: string; last_name: string } | null;
  }>) {
    if (row.profile) {
      profileNameMap.set(
        row.profile.id,
        formatInitialLastName(row.profile.first_name, row.profile.last_name)
      );
    }
  }

  // Group golfers by group_number
  const groupMap = new Map<number, StoredGrouping>();

  for (const row of (golferData || []) as unknown as Array<{
    group_number: number;
    tee_order: number;
    harmony_score: number | null;
    profile_id: string;
    profile: {
      id: string;
      first_name: string;
      last_name: string;
      phone: string;
      email: string;
      ghin_number: string;
      handicap_index: number | null;
    } | null;
  }>) {
    if (!groupMap.has(row.group_number)) {
      groupMap.set(row.group_number, {
        groupNumber: row.group_number,
        teeOrder: row.tee_order,
        harmonyScore: row.harmony_score,
        golfers: [],
      });
    }

    const group = groupMap.get(row.group_number)!;
    if (row.profile) {
      group.golfers.push({
        profileId: row.profile.id,
        guestRequestId: null,
        firstName: row.profile.first_name,
        lastName: row.profile.last_name,
        phone: row.profile.phone || "",
        email: row.profile.email || "",
        ghinNumber: row.profile.ghin_number || "",
        handicapIndex: row.profile.handicap_index ?? null,
        isGuest: false,
        hostName: null,
        hostProfileId: null,
        teeTimePreference: teeTimeMap.get(row.profile.id) || null,
        preferredPartnersInGroup: [], // populated below after all golfers are placed
      });
    }
  }

  // Add guests to their host's group
  for (const row of (guestData || []) as unknown as Array<{
    group_number: number;
    guest_request_id: string;
    guest: {
      id: string;
      requested_by: string;
      guest_first_name: string;
      guest_last_name: string;
      guest_email: string;
      guest_phone: string;
      guest_ghin_number: string;
    } | null;
  }>) {
    const group = groupMap.get(row.group_number);
    if (group && row.guest) {
      const hostName = profileNameMap.get(row.guest.requested_by) || "Golfer";
      group.golfers.push({
        profileId: null,
        guestRequestId: row.guest.id,
        firstName: row.guest.guest_first_name,
        lastName: row.guest.guest_last_name,
        phone: row.guest.guest_phone || "",
        email: row.guest.guest_email || "",
        ghinNumber: row.guest.guest_ghin_number || "",
        handicapIndex: null, // Guests don't have synced handicaps
        isGuest: true,
        hostName,
        hostProfileId: row.guest.requested_by,
        teeTimePreference: null,
        preferredPartnersInGroup: [],
      });
    }
  }

  // Populate preferredPartnersInGroup: for each golfer, check which of their
  // preferred partners ended up in the same group, and list their display names.
  const allGroups = Array.from(groupMap.values());
  for (const group of allGroups) {
    const groupProfileIds = new Set(group.golfers.filter((g) => g.profileId).map((g) => g.profileId!));
    for (const golfer of group.golfers) {
      if (!golfer.profileId || golfer.isGuest) continue;
      const prefs = partnerPrefsMap.get(golfer.profileId);
      if (!prefs) continue;
      // Find which preferred partners are in this group
      const prefArray = Array.from(prefs);
      for (const partnerId of prefArray) {
        if (groupProfileIds.has(partnerId)) {
          const partnerName = profileNameMap.get(partnerId);
          if (partnerName) {
            golfer.preferredPartnersInGroup.push(partnerName);
          }
        }
      }
    }
  }

  // Sort groups by tee order, then sort golfers within each group:
  // Golfers sorted by last name, but guests placed immediately after their host.
  const groups = allGroups.sort((a, b) => a.teeOrder - b.teeOrder);
  for (const g of groups) {
    // First sort all golfers alphabetically
    const golfers = g.golfers.filter((gf) => !gf.isGuest);
    golfers.sort((a, b) =>
      a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    );

    // Insert guests right after their host
    const guestsInGroup = g.golfers.filter((gf) => gf.isGuest);
    const orderedGolfers: StoredGroupGolfer[] = [];
    for (const golfer of golfers) {
      orderedGolfers.push(golfer);
      const golferGuests = guestsInGroup.filter((gst) => gst.hostProfileId === golfer.profileId);
      golferGuests.sort((a, b) =>
        a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
      );
      orderedGolfers.push(...golferGuests);
    }

    // Any orphaned guests
    const placedGuestIds = new Set(orderedGolfers.filter((gf) => gf.isGuest).map((gf) => gf.guestRequestId));
    const orphans = guestsInGroup.filter((gst) => !placedGuestIds.has(gst.guestRequestId));
    orderedGolfers.push(...orphans);

    g.golfers = orderedGolfers;
  }

  return groups;
}
