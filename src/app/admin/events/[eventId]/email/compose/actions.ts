"use server";

import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { sendEmail, rateLimitDelay } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { getSiteUrl } from "@/lib/format";
import { formatGameDate } from "@/lib/format";

export type EmailTarget =
  | "in"
  | "out"
  | "not_sure_no_response"
  | "waitlisted"
  | "everyone";

export type EmailTemplate =
  | "extra_spots"
  | "weather_advisory"
  | "course_update"
  | "complete_profile"
  | "custom";

export type ProfileField = "phone" | "ghin" | "playing_partners" | "handicap";

/** Shared email header with FRCC branding (matches lib/email.ts) */
function emailHeader(title: string, subtitle?: string) {
  return `
    <div style="border-bottom: 3px solid #3d7676; padding-bottom: 16px; margin-bottom: 20px;">
      <h2 style="font-family: Georgia, 'Times New Roman', serif; color: #1b2a4a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; font-size: 20px;">${title}</h2>
      ${subtitle ? `<p style="color: #6b7280; font-size: 16px; margin: 0;">${subtitle}</p>` : ""}
    </div>`;
}

export async function sendTargetedEmail(
  eventId: string,
  scheduleId: string,
  target: EmailTarget,
  subject: string,
  body: string
) {
  const { supabase, profile, adminEvents } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized for this event" };
  }

  if (!subject.trim() || !body.trim()) {
    return { error: "Subject and body are required" };
  }

  const siteUrl = getSiteUrl();

  // Get the event for reply-to setup
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();

  if (!event) return { error: "Event not found" };

  // Get the schedule for game date
  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("id, game_date")
    .eq("id", scheduleId)
    .single();

  const formattedDate = schedule ? formatGameDate(schedule.game_date) : null;

  // Get primary admin for reply-to
  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("role, profile:profiles(email)")
    .eq("event_id", eventId);

  const primaryAdmin = eventAdmins?.find(
    (a: Record<string, unknown>) => a.role === "primary"
  );
  const replyTo = (primaryAdmin?.profile as unknown as { email: string } | null)?.email;

  // Get recipients based on target — now including token for RSVP links
  let statusFilter: string[];
  switch (target) {
    case "in":
      statusFilter = ["in"];
      break;
    case "out":
      statusFilter = ["out"];
      break;
    case "not_sure_no_response":
      statusFilter = ["not_sure", "no_response"];
      break;
    case "waitlisted":
      statusFilter = ["waitlisted"];
      break;
    case "everyone":
      statusFilter = ["in", "out", "not_sure", "no_response", "waitlisted"];
      break;
    default:
      return { error: "Invalid target audience" };
  }

  const { data: rsvps } = await supabase
    .from("rsvps")
    .select("token, status, profile:profiles(email, first_name)")
    .eq("schedule_id", scheduleId)
    .in("status", statusFilter);

  if (!rsvps || rsvps.length === 0) {
    return { error: "No recipients found for this target audience" };
  }

  const validRsvps = rsvps.filter((r: Record<string, unknown>) => {
    const p = r.profile as { email: string; first_name: string } | null;
    return !!p?.email;
  });

  if (validRsvps.length === 0) {
    return { error: "No valid email addresses found" };
  }

  const bodyHtml = body
    .split("\n")
    .map(
      (line: string) =>
        `<p style="color: #374151; margin: 0 0 12px 0;">${line}</p>`
    )
    .join("");

  try {
    // Send individually so each golfer gets their personalized RSVP link
    let sentCount = 0;
    for (const rsvp of validRsvps) {
      const rsvpProfile = rsvp.profile as unknown as {
        email: string;
        first_name: string;
      };
      const token = rsvp.token as string;
      const rsvpUrl = `${siteUrl}/rsvp/${token}`;

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          ${emailHeader(event.name, formattedDate || undefined)}

          ${bodyHtml}

          <div style="margin: 24px 0; text-align: center;">
            <a href="${rsvpUrl}" style="display: inline-block; background: #3d7676; color: white; text-align: center; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">View RSVP &amp; Respond</a>
          </div>

          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            <a href="${siteUrl}/home" style="color: #3d7676;">Go to FRCC Golf Games</a>
          </p>
        </div>
      `;

      const result = await sendEmail({
        to: rsvpProfile.email,
        replyTo: replyTo || undefined,
        subject,
        html: emailHtml,
      });
      if (result.success) sentCount++;
      await rateLimitDelay();
    }

    // Log to email_log
    await supabase.from("email_log").insert({
      event_id: eventId,
      schedule_id: scheduleId,
      email_type: "custom",
      subject,
      recipient_count: sentCount,
      sent_by: profile.id,
    });

    revalidatePath(`/admin/events/${eventId}/email/compose`);

    return {
      success: true,
      recipientCount: sentCount,
    };
  } catch (err) {
    console.error("Failed to send targeted email:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

export async function sendProfileCompletionEmail(
  eventId: string,
  profileFields: ProfileField[],
  subject: string,
  body: string
) {
  const { supabase, profile, adminEvents } = await requireAdmin();
  if (!hasEventAccess(profile, adminEvents, eventId)) {
    return { error: "Not authorized for this event" };
  }

  if (!subject.trim() || !body.trim()) {
    return { error: "Subject and body are required" };
  }

  if (profileFields.length === 0) {
    return { error: "Select at least one profile field" };
  }

  const siteUrl = getSiteUrl();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();

  if (!event) return { error: "Event not found" };

  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("role, profile:profiles(email)")
    .eq("event_id", eventId);

  const primaryAdmin = eventAdmins?.find(
    (a: Record<string, unknown>) => a.role === "primary"
  );
  const replyTo = (primaryAdmin?.profile as unknown as { email: string } | null)?.email;

  // Fetch all active subscribers with profile data
  const { data: subscriptions } = await supabase
    .from("event_subscriptions")
    .select(
      "profile_id, profile:profiles(id, email, first_name, phone, ghin_number, manual_handicap_index, handicap_index)"
    )
    .eq("event_id", eventId)
    .eq("status", "active");

  if (!subscriptions || subscriptions.length === 0) {
    return { error: "No active subscribers found for this event" };
  }

  // If checking playing_partners, find which profile_ids already have preferences
  const profilesWithPartnerPrefs = new Set<string>();
  if (profileFields.includes("playing_partners")) {
    const { data: prefs } = await supabase
      .from("playing_partner_preferences")
      .select("profile_id")
      .eq("event_id", eventId);
    if (prefs) {
      prefs.forEach((p: { profile_id: string }) =>
        profilesWithPartnerPrefs.add(p.profile_id)
      );
    }
  }

  type ProfileRow = {
    id: string;
    email: string;
    first_name: string;
    phone: string | null;
    ghin_number: string | null;
    manual_handicap_index: number | null;
    handicap_index: number | null;
  };

  // Include golfer if missing ANY of the selected fields
  const recipients = subscriptions.filter((sub) => {
    const p = sub.profile as unknown as ProfileRow | null;
    if (!p?.email) return false;

    return profileFields.some((field) => {
      if (field === "phone") return !p.phone || p.phone.trim() === "";
      if (field === "ghin") return !p.ghin_number || p.ghin_number.trim() === "";
      if (field === "playing_partners") return !profilesWithPartnerPrefs.has(p.id);
      if (field === "handicap")
        return p.manual_handicap_index === null && p.handicap_index === null;
      return false;
    });
  });

  if (recipients.length === 0) {
    return {
      error:
        "No golfers found with incomplete profile fields — everyone is up to date!",
    };
  }

  const profileUrl = `${siteUrl}/profile`;

  try {
    let sentCount = 0;
    for (const sub of recipients) {
      const p = sub.profile as unknown as ProfileRow;

      // Replace [FIRST_NAME] with the golfer's actual first name
      const personalizedBody = body.replace(/\[FIRST_NAME\]/g, p.first_name || "");
      const bodyHtml = personalizedBody
        .split("\n")
        .map(
          (line: string) =>
            `<p style="color: #374151; margin: 0 0 12px 0;">${line}</p>`
        )
        .join("");

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          ${emailHeader(event.name)}

          ${bodyHtml}

          <div style="margin: 24px 0; text-align: center;">
            <a href="${profileUrl}" style="display: inline-block; background: #3d7676; color: white; text-align: center; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Complete Your Profile</a>
          </div>

          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            <a href="${siteUrl}/home" style="color: #3d7676;">Go to FRCC Golf Games</a>
          </p>
        </div>
      `;

      const result = await sendEmail({
        to: p.email,
        replyTo: replyTo || undefined,
        subject,
        html: emailHtml,
      });
      if (result.success) sentCount++;
      await rateLimitDelay();
    }

    await supabase.from("email_log").insert({
      event_id: eventId,
      schedule_id: null,
      email_type: "custom",
      subject,
      recipient_count: sentCount,
      sent_by: profile.id,
    });

    revalidatePath(`/admin/events/${eventId}/email/compose`);

    return { success: true, recipientCount: sentCount };
  } catch (err) {
    console.error("Failed to send profile completion email:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}
