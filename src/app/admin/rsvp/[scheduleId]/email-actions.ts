"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  sendEmail,
  rateLimitDelay,
  generateInviteEmail,
  generateReminderEmail,
  generateConfirmationEmail,
  generateProShopEmail,
} from "@/lib/email";
import { sendPushToUsers } from "@/lib/push";
import { generateGroupings } from "@/lib/grouping-engine";
import {
  fetchConfirmedGolfers,
  fetchPartnerPreferences,
  storeGroupings,
  fetchStoredGroupings,
  fetchApprovedGuests,
} from "@/lib/grouping-db";
import { ensureRsvps } from "@/lib/schedule";

/**
 * Verify the current user is a super admin or event admin.
 */
async function requireAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_super_admin) {
    return { supabase, adminId: user.id };
  }

  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1);

  if (!eventAdmins?.length) {
    throw new Error("Not authorized");
  }

  return { supabase, adminId: user.id };
}

function formatGameDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

/**
 * Manually send invite emails for a schedule.
 */
export async function sendInviteNow(scheduleId: string) {
  try {
    const { supabase } = await requireAdminAccess();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://frccgolfgames.com";

    // Get schedule with event info
    const { data: schedule, error: schedError } = await supabase
      .from("event_schedules")
      .select("*, event:events(*)")
      .eq("id", scheduleId)
      .single();

    if (schedError || !schedule) {
      return { error: "Schedule not found" };
    }

    const event = schedule.event;
    if (!event) return { error: "Event not found" };

    if (schedule.status === "cancelled") {
      return { error: "Game is cancelled" };
    }

    // Ensure RSVP rows exist for all subscribers
    const rsvps = await ensureRsvps(supabase, schedule.id, event.id);

    if (!rsvps || rsvps.length === 0) {
      return { error: "No subscribers found" };
    }

    let sent = 0;

    for (const rsvp of rsvps) {
      const profile = rsvp.profile as {
        first_name: string;
        last_name: string;
        email: string;
      };
      if (!profile?.email) continue;

      const html = generateInviteEmail({
        golferName: profile.first_name,
        eventName: event.name,
        gameDate: schedule.game_date,
        rsvpToken: rsvp.token,
        siteUrl,
        adminNote: schedule.admin_notes,
        cutoffDay: event.cutoff_day,
        cutoffTime: event.cutoff_time,
      });

      await sendEmail({
        to: profile.email,
        subject: `${event.name}: ${formatGameDate(schedule.game_date)} — Are You In?`,
        html,
      });
      await rateLimitDelay();
      sent++;
    }

    // Mark as sent
    await supabase
      .from("event_schedules")
      .update({ invite_sent: true })
      .eq("id", schedule.id);

    await supabase.from("email_log").insert({
      event_id: event.id,
      schedule_id: schedule.id,
      email_type: "invite",
      subject: `${event.name}: Weekly Invite (manual)`,
      recipient_count: sent,
    });

    revalidatePath(`/admin/rsvp/${scheduleId}`);
    return { success: true, sent };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Manually send reminder emails for a schedule.
 */
export async function sendReminderNow(scheduleId: string) {
  try {
    const { supabase } = await requireAdminAccess();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://frccgolfgames.com";

    const { data: schedule, error: schedError } = await supabase
      .from("event_schedules")
      .select("*, event:events(*)")
      .eq("id", scheduleId)
      .single();

    if (schedError || !schedule) return { error: "Schedule not found" };

    const event = schedule.event;
    if (!event) return { error: "Event not found" };

    if (schedule.status === "cancelled") return { error: "Game is cancelled" };

    // Get members who haven't RSVP'd or said "not sure"
    const { data: pendingRsvps } = await supabase
      .from("rsvps")
      .select("*, profile:profiles(id, first_name, last_name, email)")
      .eq("schedule_id", schedule.id)
      .in("status", ["no_response", "not_sure"]);

    if (!pendingRsvps || pendingRsvps.length === 0) {
      return { success: true, sent: 0, message: "Everyone has responded — no reminders needed" };
    }

    // Calculate spots remaining
    const { count: inCount } = await supabase
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .eq("schedule_id", schedule.id)
      .eq("status", "in");

    const capacity = schedule.capacity || event.default_capacity || 16;
    const spotsRemaining = Math.max(0, capacity - (inCount || 0));

    let sent = 0;

    for (const rsvp of pendingRsvps) {
      const profile = rsvp.profile as {
        first_name: string;
        last_name: string;
        email: string;
      };
      if (!profile?.email) continue;

      const html = generateReminderEmail({
        golferName: profile.first_name,
        eventName: event.name,
        gameDate: schedule.game_date,
        rsvpToken: rsvp.token,
        siteUrl,
        spotsRemaining,
        adminNote: schedule.admin_notes,
        cutoffDay: event.cutoff_day,
        cutoffTime: event.cutoff_time,
      });

      await sendEmail({
        to: profile.email,
        subject: `${event.name}: ${formatGameDate(schedule.game_date)} — Last Chance to RSVP`,
        html,
      });
      await rateLimitDelay();
      sent++;
    }

    // Mark reminder as sent
    await supabase
      .from("event_schedules")
      .update({ reminder_sent: true })
      .eq("id", schedule.id);

    await supabase.from("email_log").insert({
      event_id: event.id,
      schedule_id: schedule.id,
      email_type: "reminder",
      subject: `${event.name}: Reminder`,
      recipient_count: sent,
    });

    revalidatePath(`/admin/rsvp/${scheduleId}`);
    return { success: true, sent };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Manually send golfer confirmation email for a schedule.
 */
export async function sendGolferConfirmationNow(scheduleId: string) {
  try {
    const { supabase } = await requireAdminAccess();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://frccgolfgames.com";

    const { data: schedule, error: schedError } = await supabase
      .from("event_schedules")
      .select("*, event:events(*)")
      .eq("id", scheduleId)
      .single();

    if (schedError || !schedule) return { error: "Schedule not found" };

    const event = schedule.event;
    if (!event) return { error: "Event not found" };

    if (schedule.status === "cancelled") return { error: "Game is cancelled" };

    // Get confirmed RSVPs
    const { data: confirmedRsvps } = await supabase
      .from("rsvps")
      .select("*, profile:profiles(id, first_name, last_name, email, phone, ghin_number)")
      .eq("schedule_id", schedule.id)
      .eq("status", "in")
      .order("responded_at", { ascending: true });

    if (!confirmedRsvps || confirmedRsvps.length === 0) {
      return { error: "No confirmed golfers found" };
    }

    // Run grouping engine if enabled
    if (event.allow_auto_grouping) {
      try {
        const golfers = await fetchConfirmedGolfers(supabase, schedule.id);
        const preferences = await fetchPartnerPreferences(supabase, event.id);
        const groupingResult = generateGroupings(golfers, preferences, true);
        const approvedGuestsForGrouping = await fetchApprovedGuests(supabase, schedule.id);
        const guestPairs = approvedGuestsForGrouping.map((g) => ({
          guestRequestId: g.guestRequestId,
          hostProfileId: g.hostProfileId,
        }));
        await storeGroupings(supabase, schedule.id, groupingResult, guestPairs);
      } catch (err) {
        console.error("Grouping engine error (non-fatal):", err);
      }
    }

    // Get approved guests
    const { data: approvedGuests } = await supabase
      .from("guest_requests")
      .select("*, requested_by_profile:profiles!guest_requests_requested_by_fkey(first_name, last_name)")
      .eq("schedule_id", schedule.id)
      .eq("status", "approved");

    // Build player list
    const confirmedPlayers = confirmedRsvps.map((r: Record<string, unknown>) => {
      const profile = r.profile as {
        first_name: string;
        last_name: string;
        email: string;
      };
      return { ...profile, is_guest: false };
    });

    const guestPlayers = (approvedGuests || []).map((g: Record<string, unknown>) => {
      const sponsor = g.requested_by_profile as {
        first_name: string;
        last_name: string;
      };
      return {
        first_name: g.guest_first_name as string,
        last_name: g.guest_last_name as string,
        email: g.guest_email as string,
        is_guest: true,
        sponsor_name: sponsor ? `${sponsor.first_name} ${sponsor.last_name.charAt(0)}.` : "Member",
      };
    });

    const allPlayers = [...confirmedPlayers, ...guestPlayers].sort((a, b) =>
      a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
    );

    // Get admin and pro shop emails for CC
    const { data: eventAdmins } = await supabase
      .from("event_admins")
      .select("role, profile:profiles(email)")
      .eq("event_id", event.id);

    const { data: superAdmins } = await supabase
      .from("profiles")
      .select("email")
      .eq("is_super_admin", true);

    const primaryAdmin = eventAdmins?.find((a: Record<string, unknown>) => a.role === "primary");
    const primaryAdminEmail = (primaryAdmin?.profile as unknown as { email: string })?.email;

    const adminEmails = [
      ...(superAdmins || []).map((a: { email: string }) => a.email),
      ...(eventAdmins || []).map((a: Record<string, unknown>) =>
        (a.profile as unknown as { email: string })?.email
      ),
    ].filter((e): e is string => !!e);

    const { data: proShopContacts } = await supabase
      .from("pro_shop_contacts")
      .select("email")
      .eq("event_id", event.id);

    const proShopEmails = (proShopContacts || []).map((c: { email: string }) => c.email);
    const ccEmails = Array.from(new Set([...adminEmails, ...proShopEmails]));

    const golferEmails = allPlayers.map((p) => p.email).filter(Boolean);

    const confirmationHtml = generateConfirmationEmail({
      eventName: event.name,
      gameDate: schedule.game_date,
      confirmedPlayers: allPlayers,
      adminNote: schedule.admin_notes,
      siteUrl,
    });

    const formattedDate = formatGameDate(schedule.game_date);

    await sendEmail({
      to: golferEmails,
      cc: ccEmails,
      replyTo: primaryAdminEmail,
      subject: `${event.name}: ${formattedDate}: Registration Confirmation`,
      html: confirmationHtml,
    });

    // Mark as sent
    await supabase
      .from("event_schedules")
      .update({ golfer_confirmation_sent: true })
      .eq("id", schedule.id);

    await supabase.from("email_log").insert({
      event_id: event.id,
      schedule_id: schedule.id,
      email_type: "confirmation_golfer",
      subject: `${event.name}: Confirmation (manual)`,
      recipient_count: golferEmails.length,
    });

    // Push notifications (non-fatal)
    try {
      const profileIds = confirmedRsvps
        .map((r: Record<string, unknown>) => (r.profile as { id?: string })?.id)
        .filter((id): id is string => !!id);
      await sendPushToUsers(supabase, profileIds, {
        title: event.name,
        body: `You're confirmed for ${formattedDate}! ${allPlayers.length} golfers playing.`,
        url: `${siteUrl}/dashboard`,
        tag: `confirmation-${schedule.id}`,
      });
    } catch (pushErr) {
      console.error("Push error (non-fatal):", pushErr);
    }

    revalidatePath(`/admin/rsvp/${scheduleId}`);
    return { success: true, sent: golferEmails.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Manually send pro shop detail email for a schedule.
 */
export async function sendProShopDetailNow(scheduleId: string) {
  try {
    const { supabase } = await requireAdminAccess();

    const { data: schedule, error: schedError } = await supabase
      .from("event_schedules")
      .select("*, event:events(*)")
      .eq("id", scheduleId)
      .single();

    if (schedError || !schedule) return { error: "Schedule not found" };

    const event = schedule.event;
    if (!event) return { error: "Event not found" };

    if (schedule.status === "cancelled") return { error: "Game is cancelled" };

    // Get confirmed golfers with full details
    const { data: confirmedRsvps } = await supabase
      .from("rsvps")
      .select("*, profile:profiles(id, first_name, last_name, email, phone, ghin_number)")
      .eq("schedule_id", schedule.id)
      .eq("status", "in")
      .order("responded_at", { ascending: true });

    // Get approved guests
    const { data: approvedGuests } = await supabase
      .from("guest_requests")
      .select("*, requested_by_profile:profiles!guest_requests_requested_by_fkey(first_name, last_name)")
      .eq("schedule_id", schedule.id)
      .eq("status", "approved");

    const confirmedPlayers = (confirmedRsvps || []).map((r: Record<string, unknown>) => {
      const profile = r.profile as {
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        ghin_number: string;
      };
      return { ...profile, is_guest: false };
    });

    const guestPlayers = (approvedGuests || []).map((g: Record<string, unknown>) => {
      const sponsor = g.requested_by_profile as { first_name: string; last_name: string };
      return {
        first_name: g.guest_first_name as string,
        last_name: g.guest_last_name as string,
        email: (g.guest_email as string) || "",
        phone: (g.guest_phone as string) || "",
        ghin_number: (g.guest_ghin_number as string) || "",
        is_guest: true,
        sponsor_name: sponsor ? `${sponsor.first_name} ${sponsor.last_name.charAt(0)}.` : "Member",
      };
    });

    const allPlayers = [...confirmedPlayers, ...guestPlayers].sort((a, b) =>
      a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
    );

    // Get pro shop contacts
    const { data: proShopContacts } = await supabase
      .from("pro_shop_contacts")
      .select("email")
      .eq("event_id", event.id);

    const proShopEmails = (proShopContacts || []).map((c: { email: string }) => c.email);

    if (proShopEmails.length === 0) {
      return { error: "No pro shop contacts configured" };
    }

    // Get admin emails for CC
    const { data: eventAdmins } = await supabase
      .from("event_admins")
      .select("role, profile:profiles(email)")
      .eq("event_id", event.id);

    const { data: superAdmins } = await supabase
      .from("profiles")
      .select("email")
      .eq("is_super_admin", true);

    const primaryAdmin = eventAdmins?.find((a: Record<string, unknown>) => a.role === "primary");
    const primaryAdminEmail = (primaryAdmin?.profile as unknown as { email: string })?.email;

    const adminEmails = [
      ...(superAdmins || []).map((a: { email: string }) => a.email),
      ...(eventAdmins || []).map((a: Record<string, unknown>) =>
        (a.profile as unknown as { email: string })?.email
      ),
    ].filter((e): e is string => !!e);

    const uniqueAdminEmails = Array.from(new Set(adminEmails));

    // Fetch stored groupings if auto-grouping is enabled
    const groupings = event.allow_auto_grouping
      ? await fetchStoredGroupings(supabase, schedule.id)
      : [];

    const proShopHtml = generateProShopEmail({
      eventName: event.name,
      gameDate: schedule.game_date,
      players: allPlayers,
      groupings,
    });

    const formattedDate = formatGameDate(schedule.game_date);

    await sendEmail({
      to: proShopEmails,
      cc: uniqueAdminEmails,
      replyTo: primaryAdminEmail,
      subject: `${event.name}: ${formattedDate}: Player Details & Suggested Groups`,
      html: proShopHtml,
    });

    // Mark as sent
    await supabase
      .from("event_schedules")
      .update({ pro_shop_sent: true })
      .eq("id", schedule.id);

    await supabase.from("email_log").insert({
      event_id: event.id,
      schedule_id: schedule.id,
      email_type: "confirmation_proshop",
      subject: `${event.name}: Pro Shop Detail (manual)`,
      recipient_count: proShopEmails.length,
    });

    revalidatePath(`/admin/rsvp/${scheduleId}`);
    return { success: true, sent: proShopEmails.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}
