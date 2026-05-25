/**
 * Penalty Box — Database queries and business logic
 *
 * Manages penalty records, character witnesses, escape flow,
 * and apology mechanics for the Penalty Box feature.
 */

import { createAdminClient } from "@/lib/supabase/server";
import type {
  PenaltyRecord,
  PenaltyRecordWithProfiles,
  PenaltyWitness,
  PenaltyWitnessWithProfile,
  PenaltyStatus,
} from "@/types/events";

// ============================================================
// Constants
// ============================================================

/** How long a witness has to respond before auto-expiry (hours) */
const WITNESS_EXPIRY_HOURS = 24;

/** Number of "no" votes before the apology flow triggers */
const NO_VOTE_THRESHOLD = 3;

/** Witnesses required per offense number */
export function getWitnessesRequired(offenseNumber: number): number {
  if (offenseNumber <= 1) return 3;
  if (offenseNumber === 2) return 5;
  return 7; // 3rd+ offense
}

/** Random clown taunts for hole 3 */
export const CLOWN_TAUNTS = [
  "{adminName} says: 'Did you really think it would be that easy?'",
  "The clown chews thoughtfully, then spits. 'Nah.'",
  "'Nice stroke. Terrible behavior. Find witnesses.'",
  "{adminName} says: 'I've seen better putts from the beverage cart driver.'",
  "'You've been found guilty in the court of golf. Appeal denied.'",
  "'That putt was perfect. Your behavior? Not so much.'",
  "{adminName} says: 'Come back with 3 friends who'll lie for you.'",
  "'The Penalty Box doesn't accept putts as currency. Try character witnesses.'",
  "{adminName} says: 'Maybe try texting me LESS and putting MORE.'",
  "'Putt: A+. Character: Under review. Find 3 witnesses.'",
  "{adminName} says: 'I admire the confidence. Now find witnesses.'",
  "'That ball had more roll than your excuses. Find 3 witnesses.'",
];

/** Get a random clown taunt with admin name substituted */
export function getRandomClownTaunt(adminName: string): string {
  const taunt = CLOWN_TAUNTS[Math.floor(Math.random() * CLOWN_TAUNTS.length)];
  return taunt.replace(/{adminName}/g, adminName);
}

// ============================================================
// Read Operations
// ============================================================

/**
 * Look up event by slug (for penalty box pages).
 * Returns null if event doesn't exist, is inactive, or penalty box is disabled.
 */
export async function getPenaltyBoxEventBySlug(slug: string): Promise<{
  id: string;
  name: string;
  slug: string;
  penalty_box_enabled: boolean;
} | null> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, slug, penalty_box_enabled")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!event || !event.penalty_box_enabled) return null;

  return event;
}

/**
 * Fetch all active penalties for an event (not released).
 */
export async function getActivePenalties(eventId: string): Promise<PenaltyRecordWithProfiles[]> {
  const supabase = createAdminClient();

  const { data: penalties } = await supabase
    .from("penalty_box")
    .select(`
      *,
      profile:profiles!penalty_box_profile_id_fkey(id, first_name, last_name),
      charged_by_profile:profiles!penalty_box_charged_by_fkey(id, first_name, last_name)
    `)
    .eq("event_id", eventId)
    .neq("status", "released")
    .order("created_at", { ascending: false });

  if (!penalties) return [];

  // Fetch witnesses for each penalty
  const penaltyIds = penalties.map((p) => p.id);
  const { data: witnesses } = await supabase
    .from("penalty_witnesses")
    .select(`
      *,
      witness_profile:profiles!penalty_witnesses_witness_profile_id_fkey(id, first_name, last_name)
    `)
    .in("penalty_id", penaltyIds)
    .order("created_at", { ascending: true });

  const witnessMap = new Map<string, PenaltyWitnessWithProfile[]>();
  for (const w of witnesses || []) {
    const list = witnessMap.get(w.penalty_id) || [];
    list.push(w as PenaltyWitnessWithProfile);
    witnessMap.set(w.penalty_id, list);
  }

  return penalties.map((p) => ({
    ...p,
    witnesses: witnessMap.get(p.id) || [],
  })) as PenaltyRecordWithProfiles[];
}

/**
 * Fetch penalty history for an event (released penalties).
 */
export async function getPenaltyHistory(
  eventId: string,
  limit = 20
): Promise<PenaltyRecordWithProfiles[]> {
  const supabase = createAdminClient();

  const { data: penalties } = await supabase
    .from("penalty_box")
    .select(`
      *,
      profile:profiles!penalty_box_profile_id_fkey(id, first_name, last_name),
      charged_by_profile:profiles!penalty_box_charged_by_fkey(id, first_name, last_name),
      released_by_profile:profiles!penalty_box_released_by_fkey(id, first_name, last_name)
    `)
    .eq("event_id", eventId)
    .eq("status", "released")
    .order("released_at", { ascending: false })
    .limit(limit);

  if (!penalties) return [];

  // Fetch witnesses for each penalty
  const penaltyIds = penalties.map((p) => p.id);
  const { data: witnesses } = await supabase
    .from("penalty_witnesses")
    .select(`
      *,
      witness_profile:profiles!penalty_witnesses_witness_profile_id_fkey(id, first_name, last_name)
    `)
    .in("penalty_id", penaltyIds)
    .order("created_at", { ascending: true });

  const witnessMap = new Map<string, PenaltyWitnessWithProfile[]>();
  for (const w of witnesses || []) {
    const list = witnessMap.get(w.penalty_id) || [];
    list.push(w as PenaltyWitnessWithProfile);
    witnessMap.set(w.penalty_id, list);
  }

  return penalties.map((p) => ({
    ...p,
    witnesses: witnessMap.get(p.id) || [],
  })) as PenaltyRecordWithProfiles[];
}

/**
 * Fetch a single penalty by ID with full joined data.
 */
export async function getPenaltyById(
  penaltyId: string
): Promise<PenaltyRecordWithProfiles | null> {
  const supabase = createAdminClient();

  const { data: penalty } = await supabase
    .from("penalty_box")
    .select(`
      *,
      profile:profiles!penalty_box_profile_id_fkey(id, first_name, last_name),
      charged_by_profile:profiles!penalty_box_charged_by_fkey(id, first_name, last_name),
      released_by_profile:profiles!penalty_box_released_by_fkey(id, first_name, last_name)
    `)
    .eq("id", penaltyId)
    .single();

  if (!penalty) return null;

  const { data: witnesses } = await supabase
    .from("penalty_witnesses")
    .select(`
      *,
      witness_profile:profiles!penalty_witnesses_witness_profile_id_fkey(id, first_name, last_name)
    `)
    .eq("penalty_id", penaltyId)
    .order("created_at", { ascending: true });

  return {
    ...penalty,
    witnesses: (witnesses || []) as PenaltyWitnessWithProfile[],
  } as PenaltyRecordWithProfiles;
}

/**
 * Fetch a witness record by token (for tokenized witness pages).
 */
export async function getWitnessByToken(token: string): Promise<{
  witness: PenaltyWitnessWithProfile;
  penalty: PenaltyRecordWithProfiles;
  event: { id: string; name: string; slug: string };
  eventAdmin: { first_name: string; last_name: string };
} | null> {
  const supabase = createAdminClient();

  const { data: witness } = await supabase
    .from("penalty_witnesses")
    .select(`
      *,
      witness_profile:profiles!penalty_witnesses_witness_profile_id_fkey(id, first_name, last_name)
    `)
    .eq("token", token)
    .single();

  if (!witness) return null;

  const penalty = await getPenaltyById(witness.penalty_id);
  if (!penalty) return null;

  const { data: event } = await supabase
    .from("events")
    .select("id, name, slug")
    .eq("id", penalty.event_id)
    .single();

  if (!event) return null;

  // Get the primary event admin name for the clown
  const { data: adminAssignment } = await supabase
    .from("event_admins")
    .select("profile:profiles(first_name, last_name)")
    .eq("event_id", event.id)
    .eq("role", "primary")
    .single();

  const eventAdmin = adminAssignment?.profile || { first_name: "The", last_name: "Admin" };

  return {
    witness: witness as PenaltyWitnessWithProfile,
    penalty,
    event,
    eventAdmin: eventAdmin as { first_name: string; last_name: string },
  };
}

/**
 * Get the offense count for a golfer in a specific event.
 */
export async function getOffenseCount(
  eventId: string,
  profileId: string
): Promise<number> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from("penalty_box")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("profile_id", profileId);

  return count || 0;
}

/**
 * Check if a golfer is currently in the penalty box for an event.
 */
export async function isInPenaltyBox(
  eventId: string,
  profileId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from("penalty_box")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("profile_id", profileId)
    .neq("status", "released");

  return (count || 0) > 0;
}

/**
 * Get the primary event admin for an event (for clown naming and email attribution).
 */
export async function getEventAdmin(eventId: string): Promise<{
  id: string;
  first_name: string;
  last_name: string;
  email: string;
} | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("event_admins")
    .select("profile:profiles(id, first_name, last_name, email)")
    .eq("event_id", eventId)
    .eq("role", "primary")
    .single();

  return data?.profile as unknown as { id: string; first_name: string; last_name: string; email: string } | null;
}

/**
 * Get eligible witnesses for a penalty — active subscribers who are not:
 * - The penalized golfer
 * - Event admins
 * - Currently in the penalty box themselves
 * - Already asked for this penalty (any status)
 */
export async function getEligibleWitnesses(
  eventId: string,
  penaltyId: string,
  penalizedProfileId: string
): Promise<Array<{ id: string; first_name: string; last_name: string }>> {
  const supabase = createAdminClient();

  // Get event admin IDs
  const { data: admins } = await supabase
    .from("event_admins")
    .select("profile_id")
    .eq("event_id", eventId);
  const adminIds = (admins || []).map((a) => a.profile_id);

  // Get currently penalized golfer IDs
  const { data: inmates } = await supabase
    .from("penalty_box")
    .select("profile_id")
    .eq("event_id", eventId)
    .neq("status", "released");
  const inmateIds = (inmates || []).map((i) => i.profile_id);

  // Get already-asked witness IDs for this penalty
  const { data: askedWitnesses } = await supabase
    .from("penalty_witnesses")
    .select("witness_profile_id")
    .eq("penalty_id", penaltyId);
  const askedIds = (askedWitnesses || []).map((w) => w.witness_profile_id);

  // Combine all excluded IDs
  const excludeIds = new Set([
    penalizedProfileId,
    ...adminIds,
    ...inmateIds,
    ...askedIds,
  ]);

  // Get all active subscribers for the event
  const { data: subscribers } = await supabase
    .from("event_subscriptions")
    .select("profile:profiles(id, first_name, last_name, status)")
    .eq("event_id", eventId);

  if (!subscribers) return [];

  return subscribers
    .filter((s) => {
      const profile = s.profile as unknown as { id: string; first_name: string; last_name: string; status: string } | null;
      return (
        profile &&
        profile.status === "active" &&
        !excludeIds.has(profile.id)
      );
    })
    .map((s) => {
      const profile = s.profile as unknown as { id: string; first_name: string; last_name: string };
      return {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
      };
    })
    .sort((a, b) => a.last_name.localeCompare(b.last_name));
}

// ============================================================
// Write Operations
// ============================================================

/**
 * Send a golfer to the Penalty Box.
 */
export async function createPenalty(params: {
  eventId: string;
  profileId: string;
  chargedBy: string;
  charge: string;
}): Promise<PenaltyRecord> {
  const supabase = createAdminClient();

  // Calculate offense number
  const offenseCount = await getOffenseCount(params.eventId, params.profileId);
  const offenseNumber = offenseCount + 1;
  const witnessesRequired = getWitnessesRequired(offenseNumber);

  const { data, error } = await supabase
    .from("penalty_box")
    .insert({
      event_id: params.eventId,
      profile_id: params.profileId,
      charged_by: params.chargedBy,
      charge: params.charge,
      offense_number: offenseNumber,
      witnesses_required: witnessesRequired,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create penalty: ${error.message}`);
  return data as PenaltyRecord;
}

/**
 * Mark the escape game as completed and advance to "awaiting_witnesses".
 */
export async function completeEscape(penaltyId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("penalty_box")
    .update({
      status: "awaiting_witnesses" as PenaltyStatus,
      escape_completed_at: new Date().toISOString(),
    })
    .eq("id", penaltyId)
    .eq("status", "incarcerated");

  if (error) throw new Error(`Failed to complete escape: ${error.message}`);
}

/**
 * Select character witnesses for a penalty.
 */
export async function selectWitnesses(
  penaltyId: string,
  witnessProfileIds: string[]
): Promise<PenaltyWitness[]> {
  const supabase = createAdminClient();

  const expiresAt = new Date(
    Date.now() + WITNESS_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();

  const rows = witnessProfileIds.map((witnessProfileId) => ({
    penalty_id: penaltyId,
    witness_profile_id: witnessProfileId,
    expires_at: expiresAt,
  }));

  const { data, error } = await supabase
    .from("penalty_witnesses")
    .insert(rows)
    .select();

  if (error) throw new Error(`Failed to select witnesses: ${error.message}`);
  return data as PenaltyWitness[];
}

/**
 * Record a witness vote (yes/no with testimony).
 * Returns the updated penalty record to check if release threshold is met.
 */
export async function recordWitnessVote(params: {
  witnessId: string;
  vote: "yes" | "no";
  testimony: string;
}): Promise<{ penalty: PenaltyRecordWithProfiles; triggered: "released" | "apology_required" | "replacement_needed" | null }> {
  const supabase = createAdminClient();

  // Update the witness record
  const { data: witness, error: witnessError } = await supabase
    .from("penalty_witnesses")
    .update({
      status: "completed",
      vote: params.vote,
      testimony: params.testimony,
      game_completed_at: new Date().toISOString(),
      voted_at: new Date().toISOString(),
    })
    .eq("id", params.witnessId)
    .eq("status", "pending")
    .select()
    .single();

  if (witnessError || !witness) {
    throw new Error(`Failed to record vote: ${witnessError?.message || "Witness not found or already voted"}`);
  }

  // If "no" vote, increment the total_no_votes counter on the penalty
  if (params.vote === "no") {
    const { data: current } = await supabase
      .from("penalty_box")
      .select("total_no_votes")
      .eq("id", witness.penalty_id)
      .single();
    if (current) {
      await supabase
        .from("penalty_box")
        .update({ total_no_votes: (current.total_no_votes || 0) + 1 })
        .eq("id", witness.penalty_id);
    }
  }

  // Fetch the updated penalty to check state
  const penalty = await getPenaltyById(witness.penalty_id);
  if (!penalty) throw new Error("Penalty not found after vote");

  // Count yes votes
  const yesVotes = penalty.witnesses.filter(
    (w) => w.status === "completed" && w.vote === "yes"
  ).length;

  // Check if released (enough yes votes)
  if (yesVotes >= penalty.witnesses_required) {
    await supabase
      .from("penalty_box")
      .update({
        status: "released" as PenaltyStatus,
        released_at: new Date().toISOString(),
      })
      .eq("id", penalty.id);
    return { penalty: { ...penalty, status: "released" }, triggered: "released" };
  }

  // Refresh no vote count
  const updatedPenalty = await getPenaltyById(witness.penalty_id);
  if (!updatedPenalty) throw new Error("Penalty not found");

  // Check if apology required (3 total no votes)
  if (params.vote === "no" && updatedPenalty.total_no_votes >= NO_VOTE_THRESHOLD) {
    await supabase
      .from("penalty_box")
      .update({ status: "apology_required" as PenaltyStatus })
      .eq("id", penalty.id);
    return { penalty: { ...updatedPenalty, status: "apology_required" }, triggered: "apology_required" };
  }

  // If "no" vote but below threshold, golfer needs a replacement
  if (params.vote === "no") {
    return { penalty: updatedPenalty, triggered: "replacement_needed" };
  }

  return { penalty: updatedPenalty, triggered: null };
}

/**
 * Submit an apology to the event admin.
 */
export async function submitApology(
  penaltyId: string,
  apologyText: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("penalty_box")
    .update({
      apology_text: apologyText,
      apology_submitted_at: new Date().toISOString(),
    })
    .eq("id", penaltyId)
    .eq("status", "apology_required");

  if (error) throw new Error(`Failed to submit apology: ${error.message}`);
}

/**
 * Admin releases a golfer from the Penalty Box (unilateral release).
 */
export async function adminReleasePenalty(
  penaltyId: string,
  releasedBy: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("penalty_box")
    .update({
      status: "released" as PenaltyStatus,
      released_at: new Date().toISOString(),
      released_by: releasedBy,
    })
    .eq("id", penaltyId)
    .neq("status", "released");

  if (error) throw new Error(`Failed to release penalty: ${error.message}`);
}

/**
 * Check and expire any witness requests past their 24-hour deadline.
 * Called on page load (no cron needed).
 */
export async function expireOverdueWitnesses(penaltyId: string): Promise<string[]> {
  const supabase = createAdminClient();

  const now = new Date().toISOString();

  const { data: expired } = await supabase
    .from("penalty_witnesses")
    .update({ status: "expired" })
    .eq("penalty_id", penaltyId)
    .eq("status", "pending")
    .lt("expires_at", now)
    .select("witness_profile_id");

  return (expired || []).map((w) => w.witness_profile_id);
}

/**
 * Get all active subscribers for an event (for penalty email blasts).
 */
export async function getEventSubscribers(eventId: string): Promise<
  Array<{ id: string; first_name: string; last_name: string; email: string }>
> {
  const supabase = createAdminClient();

  const { data: subscribers } = await supabase
    .from("event_subscriptions")
    .select("profile:profiles(id, first_name, last_name, email, status)")
    .eq("event_id", eventId);

  if (!subscribers) return [];

  return subscribers
    .filter((s) => {
      const profile = s.profile as unknown as { status: string } | null;
      return profile && profile.status === "active";
    })
    .map((s) => s.profile as unknown as { id: string; first_name: string; last_name: string; email: string });
}

// ============================================================
// Formatting Helpers
// ============================================================

/**
 * Format elapsed time between two dates as "X days, Y hours, Z minutes, W seconds".
 */
export function formatTimeServed(startDate: string, endDate?: string | null): string {
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);

  const seconds = Math.floor(diffMs / 1000) % 60;
  const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
  const hours = Math.floor(diffMs / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);

  return parts.join(", ");
}
