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
// Store Outputs
// ============================================================

/**
 * Store grouping results in the database, including approved guests.
 * Each guest is placed in the same group as their host member.
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
  const memberGroupMap = new Map<string, { groupNumber: number; teeOrder: number; harmonyScore: number }>();
  for (const group of result.groups) {
    for (const profileId of group.members) {
      memberGroupMap.set(profileId, {
        groupNumber: group.groupNumber,
        teeOrder: group.teeOrder,
        harmonyScore: group.harmonyScore,
      });
    }
  }

  // Build member rows
  const rows: Array<{
    schedule_id: string;
    group_number: number;
    tee_order: number;
    profile_id: string | null;
    guest_request_id: string | null;
    harmony_score: number;
  }> = result.groups.flatMap((group) =>
    group.members.map((profileId) => ({
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
    const hostGroup = memberGroupMap.get(guest.hostProfileId);
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

export interface StoredGroupMember {
  profileId: string | null;
  guestRequestId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  ghinNumber: string;
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
  members: StoredGroupMember[];
}

/**
 * Fetch stored groupings for a schedule, with profile and guest details.
 * Returns groups sorted by tee_order. Within each group, members are sorted
 * alphabetically but guests are placed immediately after their host.
 */
export async function fetchStoredGroupings(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<StoredGrouping[]> {
  // Fetch member groupings
  const { data: memberData, error: memberError } = await supabase
    .from("groupings")
    .select(
      `
      group_number,
      tee_order,
      harmony_score,
      profile_id,
      guest_request_id,
      profile:profiles(id, first_name, last_name, phone, email, ghin_number)
    `
    )
    .eq("schedule_id", scheduleId)
    .not("profile_id", "is", null)
    .order("tee_order", { ascending: true })
    .order("group_number", { ascending: true });

  if (memberError) {
    console.error("Error fetching member groupings:", memberError);
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

  if ((!memberData || memberData.length === 0) && (!guestData || guestData.length === 0)) {
    return [];
  }

  // Collect all profile IDs for batch lookups
  const allProfileIds: string[] = [];
  for (const row of (memberData || []) as unknown as Array<{ profile_id: string }>) {
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

  // Fetch partner preferences for members in this schedule's event
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
  for (const row of (memberData || []) as unknown as Array<{
    profile: { id: string; first_name: string; last_name: string } | null;
  }>) {
    if (row.profile) {
      profileNameMap.set(
        row.profile.id,
        `${row.profile.first_name.charAt(0)}. ${row.profile.last_name}`
      );
    }
  }

  // Group members by group_number
  const groupMap = new Map<number, StoredGrouping>();

  for (const row of (memberData || []) as unknown as Array<{
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
        guestRequestId: null,
        firstName: row.profile.first_name,
        lastName: row.profile.last_name,
        phone: row.profile.phone || "",
        email: row.profile.email || "",
        ghinNumber: row.profile.ghin_number || "",
        isGuest: false,
        hostName: null,
        hostProfileId: null,
        teeTimePreference: teeTimeMap.get(row.profile.id) || null,
        preferredPartnersInGroup: [], // populated below after all members are placed
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
      const hostName = profileNameMap.get(row.guest.requested_by) || "Member";
      group.members.push({
        profileId: null,
        guestRequestId: row.guest.id,
        firstName: row.guest.guest_first_name,
        lastName: row.guest.guest_last_name,
        phone: row.guest.guest_phone || "",
        email: row.guest.guest_email || "",
        ghinNumber: row.guest.guest_ghin_number || "",
        isGuest: true,
        hostName,
        hostProfileId: row.guest.requested_by,
        teeTimePreference: null,
        preferredPartnersInGroup: [],
      });
    }
  }

  // Populate preferredPartnersInGroup: for each member, check which of their
  // preferred partners ended up in the same group, and list their display names.
  const allGroups = Array.from(groupMap.values());
  for (const group of allGroups) {
    const groupProfileIds = new Set(group.members.filter((m) => m.profileId).map((m) => m.profileId!));
    for (const member of group.members) {
      if (!member.profileId || member.isGuest) continue;
      const prefs = partnerPrefsMap.get(member.profileId);
      if (!prefs) continue;
      // Find which preferred partners are in this group
      const prefArray = Array.from(prefs);
      for (const partnerId of prefArray) {
        if (groupProfileIds.has(partnerId)) {
          const partnerName = profileNameMap.get(partnerId);
          if (partnerName) {
            member.preferredPartnersInGroup.push(partnerName);
          }
        }
      }
    }
  }

  // Sort groups by tee order, then sort members within each group:
  // Members sorted by last name, but guests placed immediately after their host.
  const groups = allGroups.sort((a, b) => a.teeOrder - b.teeOrder);
  for (const g of groups) {
    // First sort all members alphabetically
    const members = g.members.filter((m) => !m.isGuest);
    members.sort((a, b) =>
      a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    );

    // Insert guests right after their host
    const guestsInGroup = g.members.filter((m) => m.isGuest);
    const orderedMembers: StoredGroupMember[] = [];
    for (const member of members) {
      orderedMembers.push(member);
      const memberGuests = guestsInGroup.filter((gst) => gst.hostProfileId === member.profileId);
      memberGuests.sort((a, b) =>
        a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
      );
      orderedMembers.push(...memberGuests);
    }

    // Any orphaned guests
    const placedGuestIds = new Set(orderedMembers.filter((m) => m.isGuest).map((m) => m.guestRequestId));
    const orphans = guestsInGroup.filter((gst) => !placedGuestIds.has(gst.guestRequestId));
    orderedMembers.push(...orphans);

    g.members = orderedMembers;
  }

  return groups;
}
