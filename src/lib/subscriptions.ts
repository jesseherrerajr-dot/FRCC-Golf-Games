import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Subscribe a golfer to a specific event.
 * Uses upsert to handle re-subscribing (sets is_active = true).
 */
export async function subscribeToEvent(
  supabase: SupabaseClient,
  profileId: string,
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("event_subscriptions")
    .upsert(
      { event_id: eventId, profile_id: profileId, is_active: true },
      { onConflict: "event_id,profile_id" }
    );

  if (error) {
    console.error("Subscribe error:", error);
    return { success: false, error: "Failed to subscribe to event." };
  }
  return { success: true };
}

/**
 * Unsubscribe a golfer from a specific event.
 * Sets is_active = false (preserves the row for history).
 */
export async function unsubscribeFromEvent(
  supabase: SupabaseClient,
  profileId: string,
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("event_subscriptions")
    .update({ is_active: false })
    .eq("profile_id", profileId)
    .eq("event_id", eventId);

  if (error) {
    console.error("Unsubscribe error:", error);
    return { success: false, error: "Failed to unsubscribe from event." };
  }
  return { success: true };
}

/**
 * Subscribe a golfer to all active events.
 * Used by approval flow (generic registration) and reactivation.
 */
export async function subscribeToAllActiveEvents(
  supabase: SupabaseClient,
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: activeEvents } = await supabase
    .from("events")
    .select("id")
    .eq("is_active", true);

  if (!activeEvents || activeEvents.length === 0) {
    return { success: true };
  }

  const subscriptions = activeEvents.map((event) => ({
    event_id: event.id,
    profile_id: profileId,
    is_active: true,
  }));

  const { error } = await supabase
    .from("event_subscriptions")
    .upsert(subscriptions, {
      onConflict: "event_id,profile_id",
    });

  if (error) {
    console.error("Subscribe to all events error:", error);
    return { success: false, error: "Failed to subscribe to events." };
  }
  return { success: true };
}

/**
 * Get a golfer's event subscriptions with event details.
 * Returns all events with subscription status for the golfer.
 */
export async function getSubscriptionsForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<{
  subscribed: Array<{ id: string; event_id: string; event_name: string; day_of_week: number; frequency: string }>;
  available: Array<{ id: string; name: string; day_of_week: number; frequency: string }>;
}> {
  // Get all active events
  const { data: allEvents } = await supabase
    .from("events")
    .select("id, name, day_of_week, frequency")
    .eq("is_active", true)
    .order("name");

  // Get this golfer's active subscriptions
  const { data: subs } = await supabase
    .from("event_subscriptions")
    .select("id, event_id")
    .eq("profile_id", profileId)
    .eq("is_active", true);

  const subscribedEventIds = new Set((subs || []).map((s) => s.event_id));

  const subscribed = (subs || [])
    .map((s) => {
      const event = (allEvents || []).find((e) => e.id === s.event_id);
      if (!event) return null;
      return {
        id: s.id,
        event_id: s.event_id,
        event_name: event.name,
        day_of_week: event.day_of_week,
        frequency: event.frequency,
      };
    })
    .filter(Boolean) as Array<{ id: string; event_id: string; event_name: string; day_of_week: number; frequency: string }>;

  const available = (allEvents || [])
    .filter((e) => !subscribedEventIds.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      day_of_week: e.day_of_week,
      frequency: e.frequency,
    }));

  return { subscribed, available };
}
