"use server";

import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

export type EmailTarget =
  | "in"
  | "out"
  | "not_sure_no_response"
  | "waitlisted"
  | "everyone";

export type EmailTemplate =
  | "game_cancelled"
  | "extra_spots"
  | "weather_advisory"
  | "course_update"
  | "custom";

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

  // Get the event for reply-to setup
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();

  if (!event) return { error: "Event not found" };

  // Get primary admin for reply-to
  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("role, profile:profiles(email)")
    .eq("event_id", eventId);

  const primaryAdmin = eventAdmins?.find(
    (a: Record<string, unknown>) => a.role === "primary"
  );
  const replyTo = (primaryAdmin?.profile as unknown as { email: string } | null)?.email;

  // Get recipients based on target
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
    .select("profile:profiles(email, first_name)")
    .eq("schedule_id", scheduleId)
    .in("status", statusFilter);

  if (!rsvps || rsvps.length === 0) {
    return { error: "No recipients found for this target audience" };
  }

  const recipients = rsvps
    .map((r: Record<string, unknown>) => {
      const p = r.profile as { email: string; first_name: string } | null;
      return p?.email;
    })
    .filter((e): e is string => !!e);

  if (recipients.length === 0) {
    return { error: "No valid email addresses found" };
  }

  // Build email HTML
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #065f46; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">${event.name}</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
        ${body.split("\n").map((line: string) => `<p style="color: #374151; margin: 0 0 12px 0;">${line}</p>`).join("")}
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 16px; text-align: center;">
        FRCC Golf Games — Fairbanks Ranch Country Club
      </p>
    </div>
  `;

  try {
    await sendEmail({
      to: recipients,
      replyTo: replyTo || undefined,
      subject,
      html: emailHtml,
    });

    // Log to email_log
    await supabase.from("email_log").insert({
      event_id: eventId,
      schedule_id: scheduleId,
      email_type: "custom",
      subject,
      recipient_count: recipients.length,
      sent_by: profile.id,
    });

    revalidatePath(`/admin/events/${eventId}/email/compose`);

    return {
      success: true,
      recipientCount: recipients.length,
    };
  } catch (err) {
    console.error("Failed to send targeted email:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}
