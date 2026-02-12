"use server";

import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";

export async function approveGuestRequest(
  guestRequestId: string,
  scheduleId: string
) {
  const { supabase, profile } = await requireAdmin();

  // Fetch the guest request
  const { data: guestRequest, error: fetchError } = await supabase
    .from("guest_requests")
    .select("*")
    .eq("id", guestRequestId)
    .single();

  if (fetchError || !guestRequest) {
    return { error: "Guest request not found" };
  }

  // Check if guest is also a member (by email)
  // This is rare but possible - a member might bring another member as a guest
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, is_guest, status")
    .eq("email", guestRequest.guest_email)
    .eq("is_guest", false)
    .eq("status", "active")
    .single();

  // Update the guest request to approved
  // If the guest is also a member, link to their profile
  const { error: updateError } = await supabase
    .from("guest_requests")
    .update({
      status: "approved",
      approved_by: profile.id,
      guest_profile_id: existingProfile?.id || null,
    })
    .eq("id", guestRequestId);

  if (updateError) {
    console.error("Error approving guest request:", updateError);
    return { error: "Failed to approve guest request" };
  }

  // Fetch member and schedule info for email
  const { data: memberProfile } = await supabase
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", guestRequest.requested_by)
    .single();

  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("game_date, event:events(name, id)")
    .eq("id", scheduleId)
    .single();

  // Send email notification to the member
  if (memberProfile && schedule) {
    const formattedDate = new Date(
      schedule.game_date + "T12:00:00"
    ).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const guestName = `${guestRequest.guest_first_name} ${guestRequest.guest_last_name}`;
    const event = schedule.event as unknown as { name: string; id: string };
    const eventName = event.name;

    await sendEmail({
      to: memberProfile.email,
      subject: `${eventName}: Guest Request Approved`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #15803d; margin-bottom: 4px;">${eventName}</h2>
          <p style="color: #6b7280; font-size: 16px; margin-top: 0;">${formattedDate}</p>

          <p style="color: #374151;">Great news, ${memberProfile.first_name}!</p>
          <p style="color: #374151;">Your guest request for <strong>${guestName}</strong> has been approved for ${formattedDate}.</p>
          <p style="color: #374151;">Your guest will be included in the confirmation email and pro shop details.</p>

          <p style="color: #9ca3af; font-size: 12px;">See you on the course!</p>
        </div>
      `,
    });

    // Log the email
    await supabase.from("email_log").insert({
      event_id: event.id,
      schedule_id: scheduleId,
      email_type: "guest_approved",
      subject: `${eventName}: Guest Request Approved`,
      recipient_count: 1,
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
  const { supabase, profile } = await requireAdmin();

  // Fetch the guest request first
  const { data: guestRequest, error: fetchError } = await supabase
    .from("guest_requests")
    .select("*")
    .eq("id", guestRequestId)
    .single();

  if (fetchError || !guestRequest) {
    return { error: "Guest request not found" };
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

  // Fetch member and schedule info for email
  const { data: memberProfile } = await supabase
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", guestRequest.requested_by)
    .single();

  const { data: schedule } = await supabase
    .from("event_schedules")
    .select("game_date, event:events(name, id)")
    .eq("id", scheduleId)
    .single();

  // Send email notification to the member
  if (memberProfile && schedule) {
    const formattedDate = new Date(
      schedule.game_date + "T12:00:00"
    ).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const guestName = `${guestRequest.guest_first_name} ${guestRequest.guest_last_name}`;
    const event = schedule.event as unknown as { name: string; id: string };
    const eventName = event.name;

    await sendEmail({
      to: memberProfile.email,
      subject: `${eventName}: Guest Request Update`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #15803d; margin-bottom: 4px;">${eventName}</h2>
          <p style="color: #6b7280; font-size: 16px; margin-top: 0;">${formattedDate}</p>

          <p style="color: #374151;">Hi ${memberProfile.first_name},</p>
          <p style="color: #374151;">Unfortunately, we were unable to accommodate your guest request for <strong>${guestName}</strong> for ${formattedDate}.</p>
          <p style="color: #374151;">If you have questions, please contact a event admin.</p>

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
      recipient_count: 1,
      sent_by: profile.id,
    });
  }

  revalidatePath(`/admin/rsvp/${scheduleId}`);
  return { success: true };
}
