import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { formatGameDate, getSiteUrl, formatFullName } from "@/lib/format";

/**
 * GET /api/guest-approve/[token]?action=approve|deny
 *
 * Tokenized endpoint for admins to approve/deny guest requests via email links.
 * Returns an HTML page showing the result (not JSON — opened from email).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const action = request.nextUrl.searchParams.get("action");

  if (!action || !["approve", "deny"].includes(action)) {
    return htmlResponse("Invalid Request", "Missing or invalid action parameter.", "error");
  }

  const supabase = createAdminClient();

  // Look up guest request by approval token
  const { data: guestRequest, error: fetchError } = await supabase
    .from("guest_requests")
    .select("*, schedule:event_schedules(id, game_date, event:events(id, name))")
    .eq("approval_token", token)
    .single();

  if (fetchError || !guestRequest) {
    return htmlResponse("Invalid Link", "This guest approval link is invalid or has expired.", "error");
  }

  const schedule = guestRequest.schedule as unknown as {
    id: string;
    game_date: string;
    event: { id: string; name: string };
  };

  const guestName = `${guestRequest.guest_first_name} ${guestRequest.guest_last_name}`;
  const eventName = schedule.event.name;
  const gameDate = formatGameDate(schedule.game_date);

  // Check if already actioned
  if (guestRequest.status !== "pending") {
    const actionLabel = guestRequest.status === "approved" ? "approved" : "declined";

    // Try to find who actioned it
    let actionedByName = "an admin";
    if (guestRequest.approved_by) {
      const { data: actionedBy } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", guestRequest.approved_by)
        .single();
      if (actionedBy) {
        actionedByName = formatFullName(actionedBy.first_name, actionedBy.last_name);
      }
    }

    return htmlResponse(
      "Already Handled",
      `This guest request for <strong>${guestName}</strong> has already been <strong>${actionLabel}</strong> by ${actionedByName}.`,
      "info"
    );
  }

  // Perform the action
  const newStatus = action === "approve" ? "approved" : "denied";

  const { error: updateError } = await supabase
    .from("guest_requests")
    .update({
      status: newStatus,
      // approved_by is NULL for email-based approvals since we can't verify identity
      // The action is tracked via email_log and notification emails
    })
    .eq("id", guestRequest.id);

  if (updateError) {
    console.error("Error updating guest request:", updateError);
    return htmlResponse("Error", "Something went wrong. Please try again or use the admin dashboard.", "error");
  }

  // Send notification emails
  try {
    if (action === "approve") {
      await sendApprovalNotifications(supabase, guestRequest, schedule);
    } else {
      await sendDenialNotifications(supabase, guestRequest, schedule);
    }
  } catch (err) {
    console.error("Error sending guest notification emails:", err);
    // Don't fail the action if email fails — the status was already updated
  }

  const actionLabel = action === "approve" ? "Approved" : "Declined";
  const actionColor = action === "approve" ? "#0d9488" : "#dc2626";

  return htmlResponse(
    `Guest ${actionLabel}`,
    `<strong>${guestName}</strong> has been <strong style="color: ${actionColor}">${actionLabel.toLowerCase()}</strong> for ${eventName} on ${gameDate}. Notification emails have been sent.`,
    action === "approve" ? "success" : "info"
  );
}

/**
 * Send approval notification emails:
 * TO: requesting golfer
 * CC: all event admins, super admins, guest (if email provided)
 * If GHIN missing: also CC pro shop contacts with reply-all prompt
 */
async function sendApprovalNotifications(
  supabase: ReturnType<typeof createAdminClient>,
  guestRequest: Record<string, unknown>,
  schedule: { id: string; game_date: string; event: { id: string; name: string } }
) {
  const guestName = `${guestRequest.guest_first_name} ${guestRequest.guest_last_name}`;
  const guestEmail = guestRequest.guest_email as string | null;
  const guestGhin = guestRequest.guest_ghin_number as string | null;
  const gameDate = formatGameDate(schedule.game_date);
  const eventName = schedule.event.name;

  // Fetch requesting golfer
  const { data: golfer } = await supabase
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", guestRequest.requested_by as string)
    .single();

  if (!golfer) return;

  // Get all event admins + super admins
  const adminEmails = await getAllAdminEmails(supabase, schedule.event.id);

  // Build CC list: all admins + guest (if email provided)
  const ccList = [...adminEmails];
  if (guestEmail) {
    ccList.push(guestEmail);
  }

  // If GHIN is missing, also CC pro shop contacts so they can receive the reply-all
  let ghinPrompt = "";
  if (!guestGhin) {
    const proShopEmails = await getProShopContactEmails(supabase, schedule.event.id);
    ccList.push(...proShopEmails);

    ghinPrompt = `
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #92400e; font-weight: 600;">GHIN Number Needed</p>
        <p style="margin: 8px 0 0 0; color: #92400e;">Please reply-all with ${guestName}'s GHIN number so the pro shop can get them set up.</p>
      </div>
    `;
  }

  // Remove duplicates and the golfer's own email from CC
  const uniqueCc = [...new Set(ccList)].filter((e) => e !== golfer.email);

  await sendEmail({
    to: golfer.email,
    cc: uniqueCc.length > 0 ? uniqueCc : undefined,
    subject: `${eventName}: Guest Approved for ${gameDate}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #15803d; margin-bottom: 4px;">${eventName}</h2>
        <p style="color: #6b7280; font-size: 16px; margin-top: 0;">${gameDate}</p>

        <p style="color: #374151;">Great news, ${golfer.first_name}!</p>
        <p style="color: #374151;">Your guest request for <strong>${guestName}</strong> has been approved for ${gameDate}.</p>
        ${guestGhin ? `<p style="color: #374151;">GHIN: ${guestGhin}</p>` : ""}
        <p style="color: #374151;">Your guest will be included in the confirmation email and suggested groupings.</p>

        ${ghinPrompt}

        <p style="color: #9ca3af; font-size: 12px;">See you on the course!</p>
      </div>
    `,
  });

  // Log the email
  await supabase.from("email_log").insert({
    event_id: schedule.event.id,
    schedule_id: schedule.id,
    email_type: "guest_approved",
    subject: `${eventName}: Guest Approved for ${gameDate}`,
    recipient_count: 1 + uniqueCc.length,
  });
}

/**
 * Send denial notification emails:
 * TO: requesting golfer
 * CC: all event admins, super admins
 * NOT sent to guest
 */
async function sendDenialNotifications(
  supabase: ReturnType<typeof createAdminClient>,
  guestRequest: Record<string, unknown>,
  schedule: { id: string; game_date: string; event: { id: string; name: string } }
) {
  const guestName = `${guestRequest.guest_first_name} ${guestRequest.guest_last_name}`;
  const gameDate = formatGameDate(schedule.game_date);
  const eventName = schedule.event.name;

  // Fetch requesting golfer
  const { data: golfer } = await supabase
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", guestRequest.requested_by as string)
    .single();

  if (!golfer) return;

  // Get all event admins + super admins
  const adminEmails = await getAllAdminEmails(supabase, schedule.event.id);
  const uniqueCc = [...new Set(adminEmails)].filter((e) => e !== golfer.email);

  await sendEmail({
    to: golfer.email,
    cc: uniqueCc.length > 0 ? uniqueCc : undefined,
    subject: `${eventName}: Guest Request Update`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #15803d; margin-bottom: 4px;">${eventName}</h2>
        <p style="color: #6b7280; font-size: 16px; margin-top: 0;">${gameDate}</p>

        <p style="color: #374151;">Hi ${golfer.first_name},</p>
        <p style="color: #374151;">Unfortunately, we were unable to accommodate your guest request for <strong>${guestName}</strong> for ${gameDate}.</p>
        <p style="color: #374151;">If you have questions, please contact an event admin.</p>

        <p style="color: #9ca3af; font-size: 12px;">We look forward to seeing you on the course!</p>
      </div>
    `,
  });

  // Log the email
  await supabase.from("email_log").insert({
    event_id: schedule.event.id,
    schedule_id: schedule.id,
    email_type: "guest_denied",
    subject: `${eventName}: Guest Request Update`,
    recipient_count: 1 + uniqueCc.length,
  });
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

/**
 * Generate an HTML response page for the approval/denial result
 */
function htmlResponse(title: string, message: string, type: "success" | "error" | "info") {
  const colors = {
    success: { bg: "#f0fdf4", border: "#10b981", text: "#065f46", icon: "✓" },
    error: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b", icon: "✗" },
    info: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", icon: "ℹ" },
  };
  const c = colors[type];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - FRCC Golf Games</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 24px;">
  <div style="max-width: 480px; margin: 48px auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: ${c.bg}; border-bottom: 3px solid ${c.border}; padding: 24px; text-align: center;">
      <span style="font-size: 48px;">${c.icon}</span>
      <h1 style="color: ${c.text}; margin: 12px 0 0 0; font-size: 24px;">${title}</h1>
    </div>
    <div style="padding: 24px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.5;">${message}</p>
      <p style="margin-top: 24px; text-align: center;">
        <a href="${getSiteUrl()}/admin" style="color: #0d9488; text-decoration: none; font-weight: 600;">Go to Admin Dashboard →</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}
