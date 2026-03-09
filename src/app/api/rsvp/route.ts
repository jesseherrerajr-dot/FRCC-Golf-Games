import { NextResponse } from "next/server";
import { sendAdminAlert } from "@/lib/admin-alerts";
import { isPastCutoffPacific } from "@/lib/timezone";
import { createAdminClient } from "@/lib/supabase/server";
import { isSuspicious, getClientIp } from "@/lib/scanner-detection";

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

  // Check if past cutoff (using Pacific Time — Vercel runs in UTC)
  const schedule = rsvp.schedule;
  const event = schedule?.event;
  if (event && schedule) {
    const pastCutoff = isPastCutoffPacific(
      schedule.game_date,
      event.cutoff_day,
      event.cutoff_time || "10:00"
    );

    if (pastCutoff) {
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

      // Log to history with scanner detection metadata
      const wlUserAgent = request.headers.get("user-agent") || null;
      const wlIpAddress = getClientIp(request.headers);
      const { data: wlRecentHistory } = await supabase
        .from("rsvp_history")
        .select("created_at")
        .eq("profile_id", rsvp.profile_id)
        .eq("schedule_id", rsvp.schedule_id)
        .order("created_at", { ascending: false })
        .limit(5);

      await supabase.from("rsvp_history").insert({
        rsvp_id: rsvp.id,
        schedule_id: rsvp.schedule_id,
        profile_id: rsvp.profile_id,
        old_status: rsvp.status,
        new_status: "waitlisted",
        user_agent: wlUserAgent,
        ip_address: wlIpAddress,
        is_suspicious: isSuspicious(wlUserAgent, wlRecentHistory || []),
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

  // Log to history with scanner detection metadata
  const userAgent = request.headers.get("user-agent") || null;
  const ipAddress = getClientIp(request.headers);
  const { data: recentHistory } = await supabase
    .from("rsvp_history")
    .select("created_at")
    .eq("profile_id", rsvp.profile_id)
    .eq("schedule_id", rsvp.schedule_id)
    .order("created_at", { ascending: false })
    .limit(5);

  await supabase.from("rsvp_history").insert({
    rsvp_id: rsvp.id,
    schedule_id: rsvp.schedule_id,
    profile_id: rsvp.profile_id,
    old_status: rsvp.status,
    new_status: newStatus,
    user_agent: userAgent,
    ip_address: ipAddress,
    is_suspicious: isSuspicious(userAgent, recentHistory || []),
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

    // Fetch golfer name so admin alert can say who dropped out
    const { data: golferProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", rsvp.profile_id)
      .single();

    const golferName = golferProfile
      ? `${golferProfile.first_name} ${golferProfile.last_name}`
      : "A player";

    sendAdminAlert("spot_opened", {
      eventId: event.id,
      eventName: event.name,
      gameDate: schedule.game_date,
      currentCount: remainingIn || 0,
      capacity,
      golferName,
    }).catch((err) => console.error("Alert error:", err));
  }

  return NextResponse.redirect(
    new URL(`/rsvp/${token}?updated=${newStatus}`, request.url)
  );
}
