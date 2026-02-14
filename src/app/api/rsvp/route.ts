import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendAdminAlert } from "@/lib/admin-alerts";

// Use the service role or direct connection for token-based RSVP
// Since RSVP tokens don't require auth, we use the anon key with
// a direct query approach. We'll use a server-side admin client
// for token lookups to bypass RLS.
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const action = searchParams.get("action"); // in, out, not_sure

  if (!token) {
    return NextResponse.redirect(
      new URL("/?error=missing_token", request.url)
    );
  }

  const supabase = createAdminClient();

  // Look up the RSVP by token
  const { data: rsvp, error: rsvpError } = await supabase
    .from("rsvps")
    .select(
      `*,
       schedule:event_schedules(
         id, game_date, capacity, status,
         event:events(id, name, cutoff_day, cutoff_time, timezone, default_capacity)
       )`
    )
    .eq("token", token)
    .single();

  if (rsvpError || !rsvp) {
    return NextResponse.redirect(
      new URL("/?error=invalid_token", request.url)
    );
  }

  // Check if game is cancelled
  if (rsvp.schedule?.status === "cancelled") {
    return NextResponse.redirect(
      new URL(`/rsvp/${token}?cancelled=true`, request.url)
    );
  }

  // Check if past cutoff
  const schedule = rsvp.schedule;
  const event = schedule?.event;
  if (event && schedule) {
    const gameDate = new Date(schedule.game_date);
    const cutoffDate = new Date(gameDate);
    // Calculate cutoff: game_date's week, on cutoff_day at cutoff_time
    const dayDiff = event.cutoff_day - gameDate.getDay();
    cutoffDate.setDate(
      gameDate.getDate() + (dayDiff <= 0 ? dayDiff : dayDiff - 7)
    );
    const [hours, minutes] = (event.cutoff_time || "10:00").split(":");
    cutoffDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const now = new Date();
    if (now > cutoffDate) {
      // Past cutoff — redirect to the RSVP page showing locked status
      return NextResponse.redirect(
        new URL(`/rsvp/${token}?locked=true`, request.url)
      );
    }
  }

  // If no action specified, just show the RSVP page
  if (!action || !["in", "out", "not_sure"].includes(action)) {
    return NextResponse.redirect(new URL(`/rsvp/${token}`, request.url));
  }

  // Determine capacity
  const capacity =
    schedule?.capacity || event?.default_capacity || 16;

  // Check if capacity is full (only matters for "in" responses)
  let newStatus = action;
  if (action === "in") {
    const { count } = await supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", rsvp.schedule_id)
      .eq("status", "in");

    if ((count || 0) >= capacity && rsvp.status !== "in") {
      // Capacity full — add to waitlist
      newStatus = "waitlisted";

      // Get next waitlist position
      const { data: lastWaitlisted } = await supabase
        .from("rsvps")
        .select("waitlist_position")
        .eq("schedule_id", rsvp.schedule_id)
        .eq("status", "waitlisted")
        .order("waitlist_position", { ascending: false })
        .limit(1)
        .single();

      const nextPosition = (lastWaitlisted?.waitlist_position || 0) + 1;

      await supabase
        .from("rsvps")
        .update({
          status: "waitlisted",
          waitlist_position: nextPosition,
          responded_at: new Date().toISOString(),
        })
        .eq("id", rsvp.id);

      // Log to history
      await supabase.from("rsvp_history").insert({
        rsvp_id: rsvp.id,
        schedule_id: rsvp.schedule_id,
        profile_id: rsvp.profile_id,
        old_status: rsvp.status,
        new_status: "waitlisted",
      });

      return NextResponse.redirect(
        new URL(`/rsvp/${token}?updated=waitlisted`, request.url)
      );
    }
  }

  // Update the RSVP
  const updateData: Record<string, unknown> = {
    status: newStatus,
    responded_at: new Date().toISOString(),
  };

  // Clear waitlist position if changing from waitlisted
  if (rsvp.status === "waitlisted" && newStatus !== "waitlisted") {
    updateData.waitlist_position = null;
  }

  await supabase.from("rsvps").update(updateData).eq("id", rsvp.id);

  // Log to history
  await supabase.from("rsvp_history").insert({
    rsvp_id: rsvp.id,
    schedule_id: rsvp.schedule_id,
    profile_id: rsvp.profile_id,
    old_status: rsvp.status,
    new_status: newStatus,
  });

  // Fire admin alerts (non-blocking — don't delay the redirect)
  if (newStatus === "in" && rsvp.status !== "in" && event) {
    // Check if capacity was just reached
    const { count: newInCount } = await supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", rsvp.schedule_id)
      .eq("status", "in");

    if ((newInCount || 0) >= capacity) {
      sendAdminAlert("capacity_reached", {
        eventId: event.id,
        eventName: event.name,
        gameDate: schedule.game_date,
        currentCount: newInCount || 0,
        capacity,
      }).catch((err) => console.error("Alert error:", err));
    }
  }

  if (rsvp.status === "in" && newStatus !== "in" && event) {
    // Spot opened — someone went from "in" to "out"
    const { count: remainingIn } = await supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", rsvp.schedule_id)
      .eq("status", "in");

    sendAdminAlert("spot_opened", {
      eventId: event.id,
      eventName: event.name,
      gameDate: schedule.game_date,
      currentCount: remainingIn || 0,
      capacity,
    }).catch((err) => console.error("Alert error:", err));
  }

  return NextResponse.redirect(
    new URL(`/rsvp/${token}?updated=${newStatus}`, request.url)
  );
}
