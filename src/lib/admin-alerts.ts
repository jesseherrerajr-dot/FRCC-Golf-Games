import { createAdminClient } from "@/lib/schedule";
import { sendEmail } from "@/lib/email";

type AlertType =
  | "new_registration"
  | "capacity_reached"
  | "spot_opened"
  | "low_response";

interface AlertContext {
  eventId: string;
  eventName: string;
  // For new_registration
  golferName?: string;
  golferEmail?: string;
  // For capacity_reached / spot_opened
  gameDate?: string;
  currentCount?: number;
  capacity?: number;
  // For low_response
  respondedCount?: number;
  totalSubscribers?: number;
}

/**
 * Send an admin alert email for a specific event.
 * Checks event_alert_settings to see if the alert type is enabled.
 * Sends TO primary event admin, CC secondary admins + super admins.
 */
export async function sendAdminAlert(
  alertType: AlertType,
  context: AlertContext
) {
  const supabase = createAdminClient();

  // Check if this alert type is enabled for this event
  const { data: alertSetting } = await supabase
    .from("event_alert_settings")
    .select("*")
    .eq("event_id", context.eventId)
    .eq("alert_type", alertType)
    .maybeSingle();

  // If no setting found, use defaults: new_registration ON, capacity_reached ON, others OFF
  const isEnabled =
    alertSetting?.is_enabled ??
    (alertType === "new_registration" || alertType === "capacity_reached");

  if (!isEnabled) {
    console.log(
      `Alert ${alertType} is disabled for event ${context.eventName}`
    );
    return;
  }

  // Get admin recipients
  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("role, profile:profiles(email, first_name, last_name)")
    .eq("event_id", context.eventId);

  const { data: superAdmins } = await supabase
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("is_super_admin", true);

  const primaryAdmin = eventAdmins?.find(
    (a: Record<string, unknown>) => a.role === "primary"
  );
  const primaryAdminEmail = (
    primaryAdmin?.profile as unknown as { email: string } | null
  )?.email;

  // CC: secondary admins + super admins
  const ccEmails = [
    ...(superAdmins || []).map((a: { email: string }) => a.email),
    ...(eventAdmins || [])
      .filter((a: Record<string, unknown>) => a.role === "secondary")
      .map(
        (a: Record<string, unknown>) =>
          (a.profile as unknown as { email: string })?.email
      ),
  ].filter((e): e is string => !!e);

  const uniqueCcEmails = [...new Set(ccEmails)].filter(
    (e) => e !== primaryAdminEmail
  );

  // Determine TO address — primary admin, or first super admin if no primary
  const toEmail =
    primaryAdminEmail ||
    (superAdmins && superAdmins.length > 0 ? superAdmins[0].email : null);

  if (!toEmail) {
    console.error(
      `No admin email found for alert ${alertType} on event ${context.eventName}`
    );
    return;
  }

  // Generate email content based on alert type
  const { subject, html } = generateAlertEmail(alertType, context);

  try {
    await sendEmail({
      to: toEmail,
      cc: uniqueCcEmails.length > 0 ? uniqueCcEmails : undefined,
      subject,
      html,
    });

    console.log(
      `Sent ${alertType} alert for ${context.eventName} to ${toEmail}`
    );
  } catch (err) {
    console.error(`Failed to send ${alertType} alert:`, err);
  }
}

/**
 * Generate alert email subject and HTML based on type.
 */
function generateAlertEmail(
  alertType: AlertType,
  context: AlertContext
): { subject: string; html: string } {
  switch (alertType) {
    case "new_registration":
      return {
        subject: `[${context.eventName}] New Registration: ${context.golferName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 20px;">
              <h2 style="color: #1e40af; margin: 0 0 8px 0; font-size: 18px;">New Registration Pending</h2>
              <p style="margin: 0; color: #374151;">${context.eventName}</p>
            </div>
            <p style="color: #374151;">A new golfer has registered and is awaiting approval:</p>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 4px 0;"><strong>${context.golferName}</strong></p>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">${context.golferEmail}</p>
            </div>
            <p style="color: #374151; font-size: 14px;">Please review and approve/deny this registration in the admin dashboard.</p>
          </div>
        `,
      };

    case "capacity_reached":
      return {
        subject: `[${context.eventName}] Capacity Reached for ${formatDate(context.gameDate)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 20px;">
              <h2 style="color: #92400e; margin: 0 0 8px 0; font-size: 18px;">Capacity Reached</h2>
              <p style="margin: 0; color: #374151;">${context.eventName} — ${formatDate(context.gameDate)}</p>
            </div>
            <p style="color: #374151;">The game is now full with <strong>${context.currentCount}/${context.capacity}</strong> confirmed players.</p>
            <p style="color: #374151; font-size: 14px;">Any additional RSVPs will be added to the waitlist.</p>
          </div>
        `,
      };

    case "spot_opened":
      return {
        subject: `[${context.eventName}] Spot Opened for ${formatDate(context.gameDate)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 20px;">
              <h2 style="color: #065f46; margin: 0 0 8px 0; font-size: 18px;">Spot Opened Up</h2>
              <p style="margin: 0; color: #374151;">${context.eventName} — ${formatDate(context.gameDate)}</p>
            </div>
            <p style="color: #374151;">A player has changed from "In" to "Out." Current count: <strong>${context.currentCount}/${context.capacity}</strong>.</p>
            <p style="color: #374151; font-size: 14px;">Check the waitlist in the admin dashboard to see if anyone should be moved up.</p>
          </div>
        `,
      };

    case "low_response":
      return {
        subject: `[${context.eventName}] Low Response Alert for ${formatDate(context.gameDate)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 20px;">
              <h2 style="color: #991b1b; margin: 0 0 8px 0; font-size: 18px;">Low Response Warning</h2>
              <p style="margin: 0; color: #374151;">${context.eventName} — ${formatDate(context.gameDate)}</p>
            </div>
            <p style="color: #374151;">Only <strong>${context.respondedCount}</strong> out of <strong>${context.totalSubscribers}</strong> members have responded so far.</p>
            <p style="color: #374151; font-size: 14px;">Consider sending a custom reminder or reaching out to members who haven't responded.</p>
          </div>
        `,
      };

    default:
      return {
        subject: `[${context.eventName}] Admin Alert`,
        html: `<p>An alert was triggered for ${context.eventName}.</p>`,
      };
  }
}

function formatDate(dateString?: string): string {
  if (!dateString) return "upcoming game";
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
