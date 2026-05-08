"use server";

import { requireAdmin, hasEventAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import { formatGameDate, formatFullName } from "@/lib/format";

export async function approveGuestRequest(
  guestRequestId: string,
  scheduleId: string
) {
  const { profile, adminEvents } = await requireAdmin();
  const supabase = createAdminClient();

  // Verify event access via the schedule
  const { data: scheduleCheck } = await supabase
    .from("event_schedules")
    .select("event_id")
    .eq("id", scheduleId)
    .single();

  if (scheduleCheck && !hasEventAccess(profile, adminEvents, scheduleCheck.event_id)) {
    return { error: "Not authorized for this event" };
  }

  // Fetch the guest request
  const { data: guestRequest, error: fetchError } = await supabase
    .from("guest_requests")
    .select("*")
    .eq("id", guestRequestId)
    .single();

  if (fetchError || !guestRequest) {
    return { error: "Guest request not found" };
  }

  // Check if already actioned
  if (guestRequest.status !== "pending") {
    return { error: `This guest request has already been ${guestRequest.status}` };
  }

  // Check if guest is also a golfer (by email)
  let guestProfileId = null;
  if (guestRequest.guest_email) {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, is_guest, status")
      .eq("email", guestRequest.guest_email)
      .eq("is_guest", false)
      .eq("status", "active")
      .single();
    guestProfileId = existingProfile?.id || null;
  }

  // Update the guest request to approved
  const { error: updateError } = await supabase
    .from("guest_requests")
    .update({
      status: "approved",
      approved_by: profile.id,
      guest_profile_id: guestProfileId,
    })
    .eq("id", guestRequestId);

  if (updateError) {
    console.error("Error approving guest request:", updateError);
    return { error: "Failed to approve guest request" };
  }

  // Fetch golfer and schedule info for email
  const { data: golferProfile } = await supabase
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", guestRequest.requested_by)
    .single();

  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("game_date, event:events(name, id)")
    .eq("id", scheduleId)
    .single();

  // Send approval notification emails
  if (golferProfile && schedule) {
    const event = schedule.event as unknown as { name: string; id: string };
    const eventName = event.name;
    const gameDate = formatGameDate(schedule.game_date);
    const guestName = `${guestRequest.guest_first_name} ${guestRequest.guest_last_name}`;
    const actingAdminName = formatFullName(profile.first_name, profile.last_name);

    // Get all admin emails
    const adminEmails = await getAllAdminEmails(supabase, event.id);

    // Build CC list: all admins + guest (if email provided)
    const ccList = [...adminEmails];
    if (guestRequest.guest_email) {
      ccList.push(guestRequest.guest_email);
    }

    // If GHIN is missing, also CC pro shop contacts for reply-all workflow
    let ghinPrompt = "";
    if (!guestRequest.guest_ghin_number) {
      const proShopEmails = await getProShopContactEmails(supabase, event.id);
      ccList.push(...proShopEmails);

      ghinPrompt = `
        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">GHIN Number Needed</p>
          <p style="margin: 8px 0 0 0; color: #92400e;">Please reply-all with ${guestName}'s GHIN number so the pro shop can get them set up.</p>
        </div>
      `;
    }

    // Remove duplicates and golfer's own email from CC
    const uniqueCc = [...new Set(ccList)].filter((e) => e !== golferProfile.email);

    await sendEmail({
      to: golferProfile.email,
      cc: uniqueCc.length > 0 ? uniqueCc : undefined,
      subject: `${eventName}: Guest Approved for ${gameDate}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #15803d; margin-bottom: 4px;">${eventName}</h2>
          <p style="color: #6b7280; font-size: 16px; margin-top: 0;">${gameDate}</p>

          <p style="color: #374151;">Great news, ${golferProfile.first_name}!</p>
          <p style="color: #374151;">Your guest request for <strong>${guestName}</strong> has been approved by ${actingAdminName} for ${gameDate}.</p>
          ${guestRequest.guest_ghin_number ? `<p style="color: #374151;">GHIN: ${guestRequest.guest_ghin_number}</p>` : ""}
          <p style="color: #374151;">Your guest will be included in the confirmation email and suggested groupings.</p>

          ${ghinPrompt}

          <p style="color: #9ca3af; font-size: 12px;">See you on the course!</p>
        </div>
      `,
    });

    // Log the email
    await supabase.from("email_log").insert({
      event_id: event.id,
      schedule_id: scheduleId,
      email_type: "guest_approved",
      subject: `${eventName}: Guest Approved for ${gameDate}`,
      recipient_count: 1 + uniqueCc.length,
      sent_by: profile.id,
    });
  }

  revalidatePath(`/admin/rsvp/${scheduleId}`);
  return { success: true };
}

export async function denyGuestRequest(
  guestRequestId: string,
  scheduleId: string
) {
  const { profile, adminEvents } = await requireAdmin();
  const supabase = createAdminClient();

  // Verify event access via the schedule
  const { data: scheduleCheck } = await supabase
    .from("event_schedules")
    .select("event_id")
    .eq("id", scheduleId)
    .single();

  if (scheduleCheck && !hasEventAccess(profile, adminEvents, scheduleCheck.event_id)) {
    return { error: "Not authorized for this event" };
  }

  // Fetch the guest request first
  const { data: guestRequest, error: fetchError } = await supabase
    .from("guest_requests")
    .select("*")
    .eq("id", guestRequestId)
    .single();

  if (fetchError || !guestRequest) {
    return { error: "Guest request not found" };
  }

  // Check if already actioned
  if (guestRequest.status !== "pending") {
    return { error: `This guest request has already been ${guestRequest.status}` };
  }

  // Update the guest request to denied
  const { error: updateError } = await supabase
    .from("guest_requests")
    .update({
      status: "denied",
      approved_by: profile.id,
    })
    .eq("id", guestRequestId);

  if (updateError) {
    console.error("Error denying guest request:", updateError);
    return { error: "Failed to deny guest request" };
  }

  // Fetch golfer and schedule info for email
  const { data: golferProfile } = await supabase
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", guestRequest.requested_by)
    .single();

  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("game_date, event:events(name, id)")
    .eq("id", scheduleId)
    .single();

  // Send denial notification — to golfer, CC all admins (NOT guest)
  if (golferProfile && schedule) {
    const event = schedule.event as unknown as { name: string; id: string };
    const eventName = event.name;
    const gameDate = formatGameDate(schedule.game_date);
    const guestName = `${guestRequest.guest_first_name} ${guestRequest.guest_last_name}`;
    const actingAdminName = formatFullName(profile.first_name, profile.last_name);

    // Get all admin emails
    const adminEmails = await getAllAdminEmails(supabase, event.id);
    const uniqueCc = [...new Set(adminEmails)].filter((e) => e !== golferProfile.email);

    await sendEmail({
      to: golferProfile.email,
      cc: uniqueCc.length > 0 ? uniqueCc : undefined,
      subject: `${eventName}: Guest Request Update`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #15803d; margin-bottom: 4px;">${eventName}</h2>
          <p style="color: #6b7280; font-size: 16px; margin-top: 0;">${gameDate}</p>

          <p style="color: #374151;">Hi ${golferProfile.first_name},</p>
          <p style="color: #374151;">Unfortunately, we were unable to accommodate your guest request for <strong>${guestName}</strong> for ${gameDate}. (Reviewed by ${actingAdminName})</p>
          <p style="color: #374151;">If you have questions, please contact an event admin.</p>

          <p style="color: #9ca3af; font-size: 12px;">We look forward to seeing you on the course!</p>
        </div>
      `,
    });

    // Log the email
    await supabase.from("email_log").insert({
      event_id: event.id,
      schedule_id: scheduleId,
      email_type: "guest_denied",
      subject: `${eventName}: Guest Request Update`,
      recipient_count: 1 + uniqueCc.length,
      sent_by: profile.id,
    });
  }

  revalidatePath(`/admin/rsvp/${scheduleId}`);
  return { success: true };
}

/**
 * Get all admin emails for an event (primary + secondary + super admins)
 */
async function getAllAdminEmails(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string
): Promise<string[]> {
  const { data: superAdmins } = await supabase
    .from("profiles")
    .select("email")
    .eq("is_super_admin", true);

  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("profile:profiles(email)")
    .eq("event_id", eventId);

  return [
    ...(superAdmins || []).map((a: { email: string }) => a.email),
    ...(eventAdmins || []).map(
      (a: Record<string, unknown>) =>
        (a.profile as unknown as { email: string })?.email
    ),
  ].filter((e): e is string => !!e);
}

/**
 * Get pro shop contact emails for an event
 */
async function getProShopContactEmails(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string
): Promise<string[]> {
  const { data: links } = await supabase
    .from("event_pro_shop_contact_links")
    .select("contact:pro_shop_contacts_directory(email)")
    .eq("event_id", eventId);

  return (links || [])
    .map(
      (l: Record<string, unknown>) =>
        (l.contact as unknown as { email: string })?.email
    )
    .filter((e): e is string => !!e);
}
